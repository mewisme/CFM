import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Square, RotateCcw, Trash2 } from "lucide-react";
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

import type { AccessEntry, RuntimeEntry } from "./types";

export function EntriesList(props: {
  entries: AccessEntry[];
  runtime: Record<string, RuntimeEntry>;
  selectedId: string;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const {
    entries,
    runtime,
    selectedId,
    onSelect,
    onStart,
    onStop,
    onRestart,
    onDelete,
  } = props;

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const currentStatus = runtime[entry.id]?.status ?? "stopped";
        const isRunning = currentStatus === "running";
        const isSelected = selectedId === entry.id;
        return (
          <div
            key={entry.id}
            className={[
              "rounded-lg border p-3 transition-colors cursor-pointer",
              "hover:bg-muted/40",
              isSelected ? "border-ring ring-1 ring-ring/30" : "",
            ].join(" ")}
            onClick={() => onSelect(entry.id)}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{entry.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {entry.access_type.toUpperCase()} - {entry.hostname} - {entry.target}
                </div>
              </div>
              <Badge variant={currentStatus === "running" ? "default" : "outline"} className="capitalize">
                {currentStatus}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {!isRunning ? (
                <Button
                  size="icon-lg"
                  variant="secondary"
                  title="Start"
                  aria-label="Start"
                  onClick={(event) => {
                    event.stopPropagation();
                    onStart(entry.id);
                  }}
                >
                  <Play className="size-4" />
                </Button>
              ) : (
                <>
                  <Button
                    size="icon-lg"
                    variant="outline"
                    title="Stop"
                    aria-label="Stop"
                    onClick={(event) => {
                      event.stopPropagation();
                      onStop(entry.id);
                    }}
                  >
                    <Square className="size-4" />
                  </Button>
                  <Button
                    size="icon-lg"
                    variant="outline"
                    title="Restart"
                    aria-label="Restart"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRestart(entry.id);
                    }}
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                </>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon-lg"
                    variant="destructive"
                    title="Delete"
                    aria-label="Delete"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete entry?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove <strong>{entry.name}</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={(event) => event.stopPropagation()}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(entry.id);
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        );
      })}
    </div>
  );
}

