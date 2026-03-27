import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import type { AppSettings } from "./types";

export function SettingsForm(props: {
  value: AppSettings;
  onChange: (next: AppSettings) => void;
  onSave: () => void;
}) {
  const { value, onChange, onSave } = props;
  return (
    <div className="space-y-3">
      <Input
        placeholder="cloudflared path (auto-detected when installed)"
        value={value.cloudflared_path ?? ""}
        onChange={(e) => onChange({ ...value, cloudflared_path: e.target.value })}
      />
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={value.autostart_minimized}
          onCheckedChange={(checked) =>
            onChange({ ...value, autostart_minimized: Boolean(checked) })
          }
        />
        Autostart minimized
      </label>
      <Button onClick={onSave}>Save settings</Button>
    </div>
  );
}

