import { i18n } from "@lingui/core";
import { plural, msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Download, Plus, Upload, X } from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { INSTALL_CLOUDFLARED_MESSAGE, useAppSettings } from "@/components/settings-provider";
import {
  cfmApi,
  type AccessEntry,
  type AccessEntryInput,
  type RuntimeEntry,
} from "@/lib/tauri-cfm";
import { EntriesList } from "@/features/cfm/entries-list";
import { EntryForm } from "@/features/cfm/entry-form";
import { CFM_DATABASE_CLEARED_EVENT } from "@/lib/database";
import {
  buildExportJson,
  buildImportPlan,
  parseEntriesImportJson,
  readTextFile,
  writeTextFile,
  type ImportPlan,
} from "@/lib/entries-import-export";
import {
  entryValidationMessages,
  normalizeTarget,
  validateEntryForm,
} from "@/lib/entry-validation";
import { cn } from "@/lib/utils";

const msgDialogFilterJson = msg`JSON`;
const msgDialogFilterAllFiles = msg`All files`;

const defaultForm: AccessEntryInput = {
  name: "",
  access_type: "tcp",
  hostname: "",
  target: "",
  autostart: false,
  restart_policy: "on_failure",
  enabled: true,
  show_process_terminal: false,
};

export default function Home() {
  const { settings, refreshSettings } = useAppSettings();
  const [entries, setEntries] = useState<AccessEntry[]>([]);
  const [runtime, setRuntime] = useState<Record<string, RuntimeEntry>>({});
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState<AccessEntryInput>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [formOpen, setFormOpen] = useState(false);
  const [importOverwriteOpen, setImportOverwriteOpen] = useState(false);
  const [pendingImportPlan, setPendingImportPlan] = useState<ImportPlan | null>(null);

  function applyRuntimeResult(result: RuntimeEntry): void {
    setRuntime((prev) => ({ ...prev, [result.id]: result }));
  }

  async function refreshEntries() {
    const data = await cfmApi.listEntries();
    setEntries(data);
  }

  async function refreshRuntime() {
    const snapshot = await cfmApi.runtimeSnapshot();
    const mapped = Object.fromEntries(snapshot.map((item) => [item.id, item]));
    setRuntime(mapped);
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

  function resetForm() {
    setForm(defaultForm);
    setEditingId(null);
    setIsEditMode(true);
  }

  function closeFormPanel() {
    resetForm();
    setSelectedId("");
    setFormOpen(false);
  }

  useEffect(() => {
    function onDatabaseCleared(): void {
      void refreshEntries();
      void refreshRuntime();
      closeFormPanel();
    }
    window.addEventListener(CFM_DATABASE_CLEARED_EVENT, onDatabaseCleared);
    return () => window.removeEventListener(CFM_DATABASE_CLEARED_EVENT, onDatabaseCleared);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNewEntry() {
    resetForm();
    setSelectedId("");
    setFormOpen(true);
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
      show_process_terminal: entry.show_process_terminal,
    });
  }

  async function exportEntriesList(): Promise<void> {
    const path = await save({
      title: i18n._(msg`Export entries`),
      defaultPath: "cfm-entries.json",
      filters: [{ name: i18n._(msgDialogFilterJson), extensions: ["json"] }],
    });
    if (path === null) {
      return;
    }
    await writeTextFile(path, buildExportJson(entries));
    toast.success(
      i18n._(
        plural(entries.length, {
          one: "Exported # entry",
          other: "Exported # entries",
        }),
      ),
    );
  }

  async function applyImportPlan(plan: ImportPlan): Promise<void> {
    for (const input of plan.toCreate) {
      await cfmApi.createEntry(input);
    }
    for (const { id, input } of plan.toOverwrite) {
      await cfmApi.updateEntry(id, input);
    }
    await refreshEntries();
  }

  function toastAfterImport(plan: ImportPlan): void {
    const messages: string[] = [];
    if (plan.toCreate.length > 0) {
      messages.push(
        i18n._(
          plural(plan.toCreate.length, {
            one: "Created # entry",
            other: "Created # entries",
          }),
        ),
      );
    }
    if (plan.toOverwrite.length > 0) {
      messages.push(
        i18n._(
          plural(plan.toOverwrite.length, {
            one: "Updated # entry",
            other: "Updated # entries",
          }),
        ),
      );
    }
    if (plan.skippedInFile > 0) {
      messages.push(
        i18n._(
          plural(plan.skippedInFile, {
            one: "# duplicate row skipped in file",
            other: "# duplicate rows skipped in file",
          }),
        ),
      );
    }
    if (messages.length > 0) {
      toast.success(messages.join(". ") + ".");
    }
  }

  async function confirmImportOverwrite(): Promise<void> {
    const plan = pendingImportPlan;
    if (!plan) {
      return;
    }
    setImportOverwriteOpen(false);
    setPendingImportPlan(null);
    try {
      await applyImportPlan(plan);
      toastAfterImport(plan);
    } catch (error) {
      toast.error(String(error));
    }
  }

  async function importEntriesList(): Promise<void> {
    const path = await open({
      title: i18n._(msg`Import entries`),
      multiple: false,
      directory: false,
      filters: [
        { name: i18n._(msgDialogFilterJson), extensions: ["json"] },
        { name: i18n._(msgDialogFilterAllFiles), extensions: ["*"] },
      ],
    });
    if (path === null) {
      return;
    }
    const raw = await readTextFile(path);
    const inputs = parseEntriesImportJson(raw);
    if (inputs.length === 0) {
      toast.message(i18n._(msg`No entries in file`));
      return;
    }
    const plan = buildImportPlan(inputs, entries);
    if (plan.toCreate.length === 0 && plan.toOverwrite.length === 0) {
      if (plan.skippedInFile > 0) {
        toast.message(
          i18n._(msg`Nothing to import. ${plan.skippedInFile} duplicate(s) in file.`),
        );
      } else {
        toast.message(i18n._(msg`Nothing to import.`));
      }
      return;
    }
    if (plan.toOverwrite.length > 0) {
      setPendingImportPlan(plan);
      setImportOverwriteOpen(true);
      return;
    }
    try {
      await applyImportPlan(plan);
      toastAfterImport(plan);
    } catch (error) {
      toast.error(String(error));
    }
  }

  async function submitEntry() {
    try {
      const normalizedForm: AccessEntryInput = {
        ...form,
        target: normalizeTarget(form.target),
      };
      const errors = validateEntryForm(normalizedForm);
      if (errors.length > 0) {
        toast.error(i18n._(entryValidationMessages[errors[0]]));
        return;
      }

      if (editingId) {
        await cfmApi.updateEntry(editingId, normalizedForm);
        toast.success(i18n._(msg`Entry updated`));
      } else {
        await cfmApi.createEntry(normalizedForm);
        toast.success(i18n._(msg`Entry created`));
      }
      setForm((prev) => ({ ...prev, target: normalizedForm.target }));
      await refreshEntries();
      closeFormPanel();
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
        toast.error(i18n._(INSTALL_CLOUDFLARED_MESSAGE));
        return;
      }
      if (action === "start") {
        applyRuntimeResult(await cfmApi.startEntry(entry, settings.cloudflared_path ?? null));
      }
      if (action === "stop") {
        applyRuntimeResult(await cfmApi.stopEntry(id));
      }
      if (action === "restart") {
        applyRuntimeResult(await cfmApi.restartEntry(entry, settings.cloudflared_path ?? null));
      }
      await refreshRuntime();
    } catch (error) {
      toast.error(String(error));
    }
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1920px] flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-4">
      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-rows-1 md:gap-4 lg:gap-5",
          formOpen && "md:grid-cols-2",
        )}
      >
        <Card className="flex min-h-0 min-w-0 flex-col md:h-full">
          <CardHeader className="shrink-0 space-y-1 pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base sm:text-lg">
                  <Trans>Entries</Trans>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  <Trans>Manage Cloudflare Access routes</Trans>
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() => void importEntriesList().catch((error) => toast.error(String(error)))}
                >
                  <Upload className="size-4" />
                  <Trans>Import</Trans>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() => void exportEntriesList().catch((error) => toast.error(String(error)))}
                >
                  <Download className="size-4" />
                  <Trans>Export</Trans>
                </Button>
                <Button type="button" size="sm" className="shrink-0 gap-1.5" onClick={openNewEntry}>
                  <Plus className="size-4" />
                  <Trans>New entry</Trans>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 pb-4">
            <EntriesList
              entries={entries}
              runtime={runtime}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setFormOpen(true);
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
                  setSelectedId((current) => {
                    if (current !== id) {
                      return current;
                    }
                    Promise.resolve().then(() => {
                      resetForm();
                      setFormOpen(false);
                    });
                    return "";
                  });
                })();
              }}
            />
          </CardContent>
        </Card>

        {formOpen ? (
          <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:h-full">
            <CardHeader className="shrink-0 pb-3">
              <CardTitle className="text-base sm:text-lg">
                {editingId ? <Trans>Edit entry</Trans> : <Trans>New entry</Trans>}
              </CardTitle>
              <CardAction>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title={i18n._(msg`Close`)}
                  aria-label={i18n._(msg`Close form`)}
                  onClick={closeFormPanel}
                >
                  <X className="size-4" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6">
              <EntryForm
                value={form}
                isEditMode={Boolean(editingId)}
                canEdit={!editingId || isEditMode}
                onChange={setForm}
                submitLabel={editingId ? i18n._(msg`Save`) : i18n._(msg`Create`)}
                onEdit={() => setIsEditMode(true)}
                onSubmit={() => void submitEntry()}
                onReset={resetForm}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>

      <AlertDialog
        open={importOverwriteOpen}
        onOpenChange={(open) => {
          if (!open) {
            setImportOverwriteOpen(false);
            setPendingImportPlan(null);
          }
        }}
      >
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Overwrite existing entries?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingImportPlan ? (
                <>
                  {pendingImportPlan.toOverwrite.length === 1 ? (
                    <Trans>
                      One route in the file uses the same hostname and target as an entry already in
                      your list.
                    </Trans>
                  ) : (
                    <Trans>
                      {pendingImportPlan.toOverwrite.length} routes in the file use the same hostname
                      and target as entries already in your list.
                    </Trans>
                  )}{" "}
                  {pendingImportPlan.toCreate.length > 0 ? (
                    <>
                      {pendingImportPlan.toCreate.length === 1 ? (
                        <Trans>One new route will be added.</Trans>
                      ) : (
                        <Trans>
                          {pendingImportPlan.toCreate.length} new routes will be added.
                        </Trans>
                      )}{" "}
                    </>
                  ) : null}
                  <Trans>Overwrite matching entries with the values from the file?</Trans>
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={(event) => {
                event.preventDefault();
                void confirmImportOverwrite();
              }}
            >
              <Trans>Overwrite</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
