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
import { cfmApi, type AppSettings } from "@/lib/tauri-cfm";
import {
  applyLaunchAtLoginPreference,
  mergeSettingsWithOsAutostart,
} from "@/lib/launch-at-login";

export const INSTALL_CLOUDFLARED_MESSAGE =
  "cloudflared is not detected. Install Cloudflare Tunnel and reopen the app, or set the binary path in Settings.";

const defaultSettings: AppSettings = {
  cloudflared_path: "",
  launch_at_login: false,
  autostart_minimized: false,
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
      setSettings(await mergeSettingsWithOsAutostart(current));
      return;
    }

    const detectedPath = await cfmApi.detectCloudflaredPath();
    if (!detectedPath) {
      setSettings(await mergeSettingsWithOsAutostart(current));
      toast.error(INSTALL_CLOUDFLARED_MESSAGE);
      return;
    }

    const normalizedPath = detectedPath.trim();
    const next: AppSettings = {
      ...current,
      cloudflared_path: normalizedPath,
    };
    await cfmApi.setSettings(next);
    setSettings(await mergeSettingsWithOsAutostart(next));
  }, []);

  const openSettingsDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const saveSettings = useCallback(async () => {
    try {
      await cfmApi.setSettings(settings);
      await applyLaunchAtLoginPreference(settings.launch_at_login);
      setSettings(await mergeSettingsWithOsAutostart(settings));
      toast.success("Settings saved");
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
      toast.success("Local data cleared");
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
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription className="sr-only">
              Application and cloudflared preferences
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
