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
import { cn } from "@/lib/utils";

import type { AccessEntryInput } from "./types";
import type { AccessType, RestartPolicy } from "@/lib/tauri-cfm";

function EntrySwitchRow(props: {
  title: string;
  description?: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}) {
  const { title, description, checked, disabled, onCheckedChange, className } = props;
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:py-3",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1 pt-0.5">
        <p className="text-sm font-medium leading-tight">{title}</p>
        {description ? (
          <p className="text-xs leading-snug text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Switch
        className="mt-0.5 shrink-0 self-start"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

export function EntryForm(props: {
  value: AccessEntryInput;
  isEditMode: boolean;
  canEdit: boolean;
  onChange: (next: AccessEntryInput) => void;
  onEdit: () => void;
  onSubmit: () => void;
  onReset: () => void;
  submitLabel: string;
}) {
  const { value, isEditMode, canEdit, onChange, onEdit, onSubmit, onReset, submitLabel } = props;

  return (
    <div className="space-y-3">
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

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Route options
        </p>
        <div className="overflow-hidden rounded-xl border border-border/80 bg-muted/20 shadow-sm dark:bg-muted/10">
          <div className="divide-y divide-border/70">
            <EntrySwitchRow
              title="Enabled"
              description="When off, this route is skipped and won’t start with the app."
              checked={value.enabled}
              disabled={!canEdit}
              onCheckedChange={(checked) => onChange({ ...value, enabled: Boolean(checked) })}
            />
            <EntrySwitchRow
              title="Autostart"
              description="Start this tunnel automatically when CFM launches."
              checked={value.autostart}
              disabled={!canEdit}
              onCheckedChange={(checked) => onChange({ ...value, autostart: Boolean(checked) })}
            />
            <EntrySwitchRow
              title="Show cloudflared console"
              description="Opens a separate terminal window for this process (Windows). Changing this requires stopping and starting the tunnel again."
              checked={value.show_process_terminal}
              disabled={!canEdit}
              onCheckedChange={(checked) => {
                onChange({ ...value, show_process_terminal: Boolean(checked) });
                toast.info(
                  "Stop the tunnel, then Start again for the console window setting to take effect.",
                );
              }}
            />
          </div>
        </div>
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
