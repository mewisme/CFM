import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  cfmApi,
  type AccessEntry,
  type AccessEntryInput,
  type AppSettings,
  type RuntimeEntry,
} from "@/lib/tauri-cfm";
import { EntriesList } from "@/features/cfm/entries-list";
import { EntryForm } from "@/features/cfm/entry-form";
import { SettingsForm } from "@/features/cfm/settings-form";

const defaultForm: AccessEntryInput = {
  name: "",
  access_type: "http",
  hostname: "",
  target: "",
  autostart: false,
  restart_policy: "on_failure",
  enabled: true,
  tray_pinned: false,
};

const defaultSettings: AppSettings = {
  cloudflared_path: "",
  autostart_minimized: false,
};
const installCloudflaredMessage =
  "cloudflared is not detected. Install Cloudflare Tunnel and reopen the app, or set the binary path in Settings.";

function validateEntryForm(form: AccessEntryInput): string[] {
  const errors: string[] = [];

  if (!form.name.trim()) {
    errors.push("Name is required.");
  }

  const hostname = form.hostname.trim();
  if (!hostname) {
    errors.push("Hostname is required.");
  } else if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) {
    errors.push("Hostname contains invalid characters.");
  }

  const target = form.target.trim();
  if (!target) {
    errors.push("Target is required.");
  } else {
    const onlyPort = /^\d{1,5}$/.test(target);
    const hostAndPort =
      /^([a-zA-Z0-9.-]+|\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/.test(target);
    if (!onlyPort && !hostAndPort) {
      errors.push("Target must be a port or host:port (example: 3000 or 127.0.0.1:3000).");
    } else {
      const targetParts = target.split(":");
      const portSegment = targetParts[targetParts.length - 1];
      const portValue = Number(onlyPort ? target : portSegment);
      if (!Number.isInteger(portValue) || portValue < 1 || portValue > 65535) {
        errors.push("Port must be between 1 and 65535.");
      }
    }
  }

  return errors;
}

function normalizeTarget(target: string): string {
  const trimmed = target.trim();
  if (/^\d{1,5}$/.test(trimmed)) {
    return `127.0.0.1:${trimmed}`;
  }
  return trimmed;
}

export default function Home() {
  const [entries, setEntries] = useState<AccessEntry[]>([]);
  const [runtime, setRuntime] = useState<Record<string, RuntimeEntry>>({});
  const [selectedId, setSelectedId] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [form, setForm] = useState<AccessEntryInput>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  const selectedEntry = useMemo(
    () => entries.find((item) => item.id === selectedId) ?? null,
    [entries, selectedId]
  );

  async function refreshEntries() {
    const data = await cfmApi.listEntries();
    setEntries(data);
    if (!selectedId && data.length > 0) {
      setSelectedId(data[0].id);
    }
  }

  async function refreshRuntime() {
    const snapshot = await cfmApi.runtimeSnapshot();
    const mapped = Object.fromEntries(snapshot.map((item) => [item.id, item]));
    setRuntime(mapped);
  }

  async function refreshSettings() {
    const current = await cfmApi.getSettings();
    const hasConfiguredPath = Boolean(current.cloudflared_path?.trim());
    if (hasConfiguredPath) {
      setSettings(current);
      return;
    }

    const detectedPath = await cfmApi.detectCloudflaredPath();
    if (!detectedPath) {
      setSettings(current);
      toast.error(installCloudflaredMessage);
      return;
    }

    const normalizedPath = detectedPath.trim();
    const next: AppSettings = {
      ...current,
      cloudflared_path: normalizedPath,
    };
    await cfmApi.setSettings(next);
    setSettings(next);
  }

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    (async () => {
      await Promise.all([refreshEntries(), refreshRuntime(), refreshSettings()]);
      unlisten = await cfmApi.onRuntimeUpdated(refreshRuntime);
    })().catch((error) => {
      toast.error(String(error));
    });
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setLogs([]);
      return;
    }
    cfmApi
      .entryLogs(selectedId)
      .then(setLogs)
      .catch((error) => toast.error(String(error)));
  }, [selectedId]);

  function resetForm() {
    setForm(defaultForm);
    setEditingId(null);
    setIsEditMode(true);
  }

  function fillFormFromEntry(entry: AccessEntry) {
    setEditingId(entry.id);
    setIsEditMode(false);
    setForm({
      name: entry.name,
      access_type: entry.access_type,
      hostname: entry.hostname,
      target: entry.target,
      autostart: entry.autostart,
      restart_policy: entry.restart_policy,
      enabled: entry.enabled,
      tray_pinned: entry.tray_pinned,
    });
  }

  async function submitEntry() {
    try {
      const normalizedForm: AccessEntryInput = {
        ...form,
        target: normalizeTarget(form.target),
      };
      const errors = validateEntryForm(normalizedForm);
      if (errors.length > 0) {
        toast.error(errors[0]);
        return;
      }

      if (editingId) {
        await cfmApi.updateEntry(editingId, normalizedForm);
        toast.success("Entry updated");
      } else {
        await cfmApi.createEntry(normalizedForm);
        toast.success("Entry created");
      }
      setForm((prev) => ({ ...prev, target: normalizedForm.target }));
      await refreshEntries();
      resetForm();
    } catch (error) {
      toast.error(String(error));
    }
  }

  async function runAction(action: "start" | "stop" | "restart", id: string) {
    try {
      const entry = entries.find((item) => item.id === id);
      if (!entry) {
        return;
      }
      if ((action === "start" || action === "restart") && !settings.cloudflared_path?.trim()) {
        toast.error(installCloudflaredMessage);
        return;
      }
      if (action === "start") await cfmApi.startEntry(entry, settings.cloudflared_path ?? null);
      if (action === "stop") await cfmApi.stopEntry(id);
      if (action === "restart") {
        await cfmApi.restartEntry(entry, settings.cloudflared_path ?? null);
      }
      await refreshRuntime();
    } catch (error) {
      toast.error(String(error));
    }
  }

  return (
    <main className="w-full p-4">
      <div className="grid h-[calc(100vh-100px)] grid-cols-1 gap-4 lg:grid-cols-[minmax(420px,1.2fr)_minmax(420px,1fr)] 2xl:grid-cols-[minmax(520px,1.4fr)_minmax(520px,1fr)]">
        <Card className="flex min-h-0 flex-col">
          <CardHeader>
            <CardTitle>Entries</CardTitle>
            <CardDescription>Manage Cloudflare Access routes</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 overflow-auto">
            <EntriesList
              entries={entries}
              runtime={runtime}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                const entry = entries.find((item) => item.id === id);
                if (entry) {
                  fillFormFromEntry(entry);
                }
              }}
              onStart={(id) => void runAction("start", id)}
              onStop={(id) => void runAction("stop", id)}
              onRestart={(id) => void runAction("restart", id)}
              onDelete={(id) => {
                void (async () => {
                  try {
                    await cfmApi.stopEntry(id);
                  } catch {
                    // Ignore stop errors (e.g. already stopped) and continue deletion.
                  }
                  await cfmApi.deleteEntry(id);
                  await refreshEntries();
                  await refreshRuntime();
                })();
              }}
            />
          </CardContent>
        </Card>

        <div className="min-h-0 space-y-4 overflow-auto pr-1">
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? "Edit Entry" : "New Entry"}</CardTitle>
            </CardHeader>
            <CardContent>
              <EntryForm
                title={editingId ? "View / Edit" : "Create"}
                value={form}
                isEditMode={Boolean(editingId)}
                canEdit={!editingId || isEditMode}
                onChange={setForm}
                submitLabel={editingId ? "Save" : "Create"}
                onEdit={() => setIsEditMode(true)}
                onSubmit={() => void submitEntry()}
                onReset={resetForm}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Runtime / Logs</CardTitle>
              <CardDescription>{selectedEntry?.name ?? "Select an entry"}</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="h-[260px] w-full overflow-auto rounded-md bg-muted p-3 text-xs lg:h-[320px]">
                {logs.length > 0 ? logs.join("\n") : "No logs yet"}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <SettingsForm
                value={settings}
                onChange={setSettings}
                onSave={() =>
                  void (async () => {
                    await cfmApi.setSettings(settings);
                    toast.success("Settings saved");
                  })()
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
