import { i18n } from "@lingui/core";
import { defineMessage } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { open } from "@tauri-apps/plugin-dialog";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SUPPORTED_LOCALES, type AppLocale } from "@/lib/app-locale";

import type { AppSettings } from "./types";

const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  vi: "Tiếng Việt",
};

const msgPickCloudflaredTitle = defineMessage({ message: "Select cloudflared executable" });
const msgClickToSelectCloudflared = defineMessage({
  message: "Click to select cloudflared executable…",
});
const msgThemePlaceholder = defineMessage({ message: "Theme" });
const msgFilterExecutable = defineMessage({ message: "Executable" });
const msgFilterAllFiles = defineMessage({ message: "All files" });

async function pickCloudflaredExecutable(
  currentPath: string | null | undefined
): Promise<string | null> {
  const selected = await open({
    title: i18n._(msgPickCloudflaredTitle),
    multiple: false,
    directory: false,
    defaultPath: currentPath?.trim() || undefined,
    filters: [
      { name: i18n._(msgFilterExecutable), extensions: ["exe"] },
      { name: i18n._(msgFilterAllFiles), extensions: ["*"] },
    ],
  });
  return selected ?? null;
}

export function SettingsForm(props: {
  value: AppSettings;
  onChange: (next: AppSettings) => void;
  onSave: () => void;
  onClearLocalData: () => void | Promise<void>;
}) {
  const { value, onChange, onSave, onClearLocalData } = props;
  const { theme, setTheme } = useTheme();
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    setThemeReady(true);
  }, []);

  async function handleSelectExecutable(): Promise<void> {
    try {
      const path = await pickCloudflaredExecutable(value.cloudflared_path);
      if (path == null) {
        return;
      }
      onChange({ ...value, cloudflared_path: path });
    } catch (error) {
      console.error(error);
      toast.error(String(error));
    }
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="min-w-0 space-y-2">
        <div className="text-sm font-medium">
          <Trans>Cloudflared executable</Trans>
        </div>
        <Input
          readOnly
          className="cursor-pointer truncate font-mono text-xs md:text-sm"
          placeholder={i18n._(msgClickToSelectCloudflared)}
          value={value.cloudflared_path ?? ""}
          spellCheck={false}
          autoComplete="off"
          aria-label={i18n._(msgPickCloudflaredTitle)}
          onClick={() => void handleSelectExecutable()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              void handleSelectExecutable();
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          <Trans>
            Opens the system file dialog. Windows: .exe; other OS: use &quot;All files&quot; if
            needed.
          </Trans>
        </p>
      </div>

      <label className="flex gap-3 text-sm">
        <Switch
          className="mt-0.5 shrink-0"
          checked={value.launch_at_login}
          onCheckedChange={(checked) =>
            onChange({ ...value, launch_at_login: Boolean(checked) })
          }
        />
        <span className="min-w-0 flex-1 leading-snug">
          <Trans>Launch at login</Trans>
        </span>
      </label>

      <label className="flex gap-3 text-sm">
        <Switch
          className="mt-0.5 shrink-0"
          checked={value.autostart_minimized}
          onCheckedChange={(checked) =>
            onChange({ ...value, autostart_minimized: Boolean(checked) })
          }
        />
        <span className="min-w-0 flex-1 leading-snug">
          <Trans>Start in tray when launched at login</Trans>
        </span>
      </label>

      <label className="flex gap-3 text-sm">
        <Switch
          className="mt-0.5 shrink-0"
          checked={value.minimize_to_tray}
          onCheckedChange={(checked) =>
            onChange({ ...value, minimize_to_tray: Boolean(checked) })
          }
        />
        <span className="min-w-0 flex-1 leading-snug">
          <Trans>Minimize to tray when closing window</Trans>
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        <Trans>
          When off, closing the window quits the app and stops running tunnels. You can still use
          Quit from the tray icon to exit.
        </Trans>
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <div className="text-sm font-medium">
            <Trans>Appearance</Trans>
          </div>
          {themeReady ? (
            <Select value={theme ?? "system"} onValueChange={setTheme}>
              <SelectTrigger className="h-9 w-full max-w-full min-w-0">
                <SelectValue placeholder={i18n._(msgThemePlaceholder)} />
              </SelectTrigger>
              <SelectContent position="popper" className="z-50">
                <SelectItem value="light">
                  <Trans>Light</Trans>
                </SelectItem>
                <SelectItem value="dark">
                  <Trans>Dark</Trans>
                </SelectItem>
                <SelectItem value="system">
                  <Trans>System</Trans>
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div
              className="h-9 w-full max-w-full rounded-lg border border-input bg-muted/40"
              aria-hidden
            />
          )}
        </div>

        <div className="min-w-0 space-y-2">
          <div className="text-sm font-medium">
            <Trans>Language</Trans>
          </div>
          <Select
            value={value.locale}
            onValueChange={(next) => onChange({ ...value, locale: next as AppLocale })}
          >
            <SelectTrigger className="h-9 w-full max-w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="z-50">
              {SUPPORTED_LOCALES.map((code) => (
                <SelectItem key={code} value={code}>
                  {LOCALE_LABELS[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button className="w-full sm:w-auto" onClick={onSave}>
        <Trans>Save settings</Trans>
      </Button>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="space-y-1">
          <div className="text-sm font-medium">
            <Trans>Local data</Trans>
          </div>
          <p className="text-xs text-muted-foreground">
            <Trans>
              Remove all saved entries and settings from this device and recreate an empty database.
              Restart the app if tunnels were running.
            </Trans>
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" className="w-full sm:w-auto">
              <Trans>Clear local data</Trans>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                <Trans>Clear all local data?</Trans>
              </AlertDialogTitle>
              <AlertDialogDescription>
                <Trans>
                  This deletes the tunnel entries and app settings stored in CFM&apos;s database on
                  this device. This cannot be undone. If any tunnels are running, close them or
                  restart the app afterward.
                </Trans>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <Trans>Cancel</Trans>
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => void onClearLocalData()}
              >
                <Trans>Clear data</Trans>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
