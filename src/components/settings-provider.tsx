import { i18n } from "@lingui/core";
import { defineMessage } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SettingsForm } from "@/features/cfm/settings-form";
import { clearCfmDatabase } from "@/lib/database";
import { loadLocaleCatalog } from "@/lib/load-locale-catalog";
import { cfmApi, type AppSettings } from "@/lib/tauri-cfm";
import {
  applyLaunchAtLoginPreference,
  mergeSettingsWithOsAutostart,
} from "@/lib/launch-at-login";

export const INSTALL_CLOUDFLARED_MESSAGE = defineMessage({
  message:
    "cloudflared is not detected. Install Cloudflare Tunnel and reopen the app, or set the binary path in Settings.",
});

const msgSettingsSaved = defineMessage({ message: "Settings saved" });
const msgLocalDataCleared = defineMessage({ message: "Local data cleared" });

const defaultSettings: AppSettings = {
  cloudflared_path: "",
  launch_at_login: false,
  autostart_minimized: false,
  minimize_to_tray: true,
  locale: "en",
};

type AppSettingsContextValue = {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  refreshSettings: () => Promise<void>;
  openSettingsDialog: () => void;
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error("useAppSettings must be used within SettingsProvider");
  }
  return ctx;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [dialogOpen, setDialogOpen] = useState(false);

  const refreshSettings = useCallback(async () => {
    const current = await cfmApi.getSettings();
    const hasConfiguredPath = Boolean(current.cloudflared_path?.trim());
    if (hasConfiguredPath) {
      const merged = await mergeSettingsWithOsAutostart(current);
      setSettings(merged);
      await loadLocaleCatalog(merged.locale);
      await cfmApi.syncMinimizeToTrayPreference(merged.minimize_to_tray);
      return;
    }

    const detectedPath = await cfmApi.detectCloudflaredPath();
    if (!detectedPath) {
      const merged = await mergeSettingsWithOsAutostart(current);
      setSettings(merged);
      await loadLocaleCatalog(merged.locale);
      await cfmApi.syncMinimizeToTrayPreference(merged.minimize_to_tray);
      toast.error(i18n._(INSTALL_CLOUDFLARED_MESSAGE));
      return;
    }

    const normalizedPath = detectedPath.trim();
    const next: AppSettings = {
      ...current,
      cloudflared_path: normalizedPath,
    };
    await cfmApi.setSettings(next);
    const mergedNext = await mergeSettingsWithOsAutostart(next);
    setSettings(mergedNext);
    await loadLocaleCatalog(mergedNext.locale);
    await cfmApi.syncMinimizeToTrayPreference(mergedNext.minimize_to_tray);
  }, []);

  const openSettingsDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const saveSettings = useCallback(async () => {
    try {
      await cfmApi.setSettings(settings);
      await applyLaunchAtLoginPreference(settings.launch_at_login);
      const merged = await mergeSettingsWithOsAutostart(settings);
      setSettings(merged);
      await loadLocaleCatalog(merged.locale);
      await cfmApi.syncMinimizeToTrayPreference(merged.minimize_to_tray);
      toast.success(i18n._(msgSettingsSaved));
      setDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(String(error));
    }
  }, [settings]);

  const clearLocalData = useCallback(async () => {
    try {
      await clearCfmDatabase();
      await refreshSettings();
      toast.success(i18n._(msgLocalDataCleared));
      setDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(String(error));
    }
  }, [refreshSettings]);

  const value = useMemo(
    () => ({
      settings,
      setSettings,
      refreshSettings,
      openSettingsDialog,
    }),
    [settings, refreshSettings, openSettingsDialog]
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-h-[min(85dvh,36rem)] overflow-y-auto sm:max-w-lg"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle>
              <Trans>Settings</Trans>
            </DialogTitle>
            <DialogDescription className="sr-only">
              <Trans>Application and cloudflared preferences</Trans>
            </DialogDescription>
          </DialogHeader>
          <SettingsForm
            value={settings}
            onChange={setSettings}
            onSave={() => void saveSettings()}
            onClearLocalData={() => void clearLocalData()}
          />
        </DialogContent>
      </Dialog>
    </AppSettingsContext.Provider>
  );
}
