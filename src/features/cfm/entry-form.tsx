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

import type { AccessEntryInput } from "./types";
import type { AccessType, RestartPolicy } from "@/lib/tauri-cfm";

export function EntryForm(props: {
  title: string;
  value: AccessEntryInput;
  isEditMode: boolean;
  canEdit: boolean;
  onChange: (next: AccessEntryInput) => void;
  onEdit: () => void;
  onSubmit: () => void;
  onReset: () => void;
  submitLabel: string;
}) {
  const { title, value, isEditMode, canEdit, onChange, onEdit, onSubmit, onReset, submitLabel } = props;

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">{title}</div>
      <Input
        placeholder="Name"
        value={value.name}
        disabled={!canEdit}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select
          value={value.access_type}
          disabled={!canEdit}
          onValueChange={(v) => onChange({ ...value, access_type: v as AccessType })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Access type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="http">HTTP</SelectItem>
            <SelectItem value="tcp">TCP</SelectItem>
            <SelectItem value="ssh">SSH</SelectItem>
            <SelectItem value="rdp">RDP</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={value.restart_policy}
          disabled={!canEdit}
          onValueChange={(v) => onChange({ ...value, restart_policy: v as RestartPolicy })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Restart" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="never">Never</SelectItem>
            <SelectItem value="on_failure">On failure</SelectItem>
            <SelectItem value="always">Always</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input
        placeholder="Hostname (example.com)"
        value={value.hostname}
        disabled={!canEdit}
        onChange={(e) => onChange({ ...value, hostname: e.target.value })}
      />
      <Input
        placeholder="Target (127.0.0.1:3000)"
        value={value.target}
        disabled={!canEdit}
        onChange={(e) => onChange({ ...value, target: e.target.value })}
      />
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <label className="flex items-center gap-2">
          <Switch
            checked={value.enabled}
            disabled={!canEdit}
            onCheckedChange={(checked) => onChange({ ...value, enabled: Boolean(checked) })}
          />
          Enabled
        </label>
        <label className="flex items-center gap-2">
          <Switch
            checked={value.autostart}
            disabled={!canEdit}
            onCheckedChange={(checked) => onChange({ ...value, autostart: Boolean(checked) })}
          />
          Autostart
        </label>
        <label className="flex items-center gap-2">
          <Switch
            checked={value.tray_pinned}
            disabled={!canEdit}
            onCheckedChange={(checked) =>
              onChange({ ...value, tray_pinned: Boolean(checked) })
            }
          />
          Tray pinned
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {isEditMode && !canEdit && (
          <Button variant="secondary" onClick={onEdit}>
            Edit
          </Button>
        )}
        {(!isEditMode || canEdit) && (
          <Button disabled={!canEdit} onClick={onSubmit}>
            {submitLabel}
          </Button>
        )}
        <Button variant="outline" onClick={onReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}

