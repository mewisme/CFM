import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useTheme } from "next-themes";
import { toast } from "sonner";

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

import type { AppSettings } from "./types";

async function pickCloudflaredExecutable(
  currentPath: string | null | undefined
): Promise<string | null> {
  const selected = await open({
    title: "Select cloudflared executable",
    multiple: false,
    directory: false,
    defaultPath: currentPath?.trim() || undefined,
    filters: [
      { name: "Executable", extensions: ["exe"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  return selected ?? null;
}

export function SettingsForm(props: {
  value: AppSettings;
  onChange: (next: AppSettings) => void;
  onSave: () => void;
}) {
  const { value, onChange, onSave } = props;
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
        <div className="text-sm font-medium">Cloudflared executable</div>
        <Input
          readOnly
          className="cursor-pointer truncate font-mono text-xs md:text-sm"
          placeholder="Click to select cloudflared executable…"
          value={value.cloudflared_path ?? ""}
          spellCheck={false}
          autoComplete="off"
          aria-label="Select cloudflared executable"
          onClick={() => void handleSelectExecutable()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              void handleSelectExecutable();
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          Opens the system file dialog. Windows: .exe; other OS: use &quot;All files&quot; if needed.
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
          Launch at login
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Registers CFM with the system to start when you sign in (saved when you click Save
            settings).
          </span>
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
          Start in tray when launched at login
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Only applies if the app was started by login autostart, not when you open it yourself.
          </span>
        </span>
      </label>

      <div className="space-y-2">
        <div className="text-sm font-medium">Appearance</div>
        {themeReady ? (
          <Select value={theme ?? "system"} onValueChange={setTheme}>
            <SelectTrigger className="h-9 w-full max-w-full min-w-0">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div
            className="h-9 w-full max-w-full rounded-lg border border-input bg-muted/40"
            aria-hidden
          />
        )}
        <p className="text-xs text-muted-foreground">
          Matches the rest of the app (saved in the browser session; not part of Save settings).
        </p>
      </div>

      <Button className="w-full sm:w-auto" onClick={onSave}>
        Save settings
      </Button>
    </div>
  );
}
