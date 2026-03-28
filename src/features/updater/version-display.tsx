import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import logo from "@/assets/app-icon.png";

export enum UpdateStatus {
  CHECKING = "CHECKING",
  AVAILABLE = "AVAILABLE",
  LATEST = "LATEST",
  ERROR = "ERROR",
}

export interface UpdateInfo {
  status: UpdateStatus;
  currentVersion: string;
  newVersion?: string;
  error?: string;
}

async function notifyNewVersionAvailable(newVersion: string): Promise<void> {
  try {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === "granted";
    }
    if (permissionGranted) {
      sendNotification({
        title: "CFM update available",
        body: `Version ${newVersion} is ready. Open the app and click the version in the footer to install.`,
      });
    }
  } catch (error) {
    console.error("Failed to send update notification:", error);
  }
}

export function VersionDisplay({ className }: { className?: string }) {
  const [version, setVersion] = useState("");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
    status: UpdateStatus.CHECKING,
    currentVersion: "",
  });
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const notifiedUpdateVersionRef = useRef<string | null>(null);

  const checkForUpdates = async () => {
    try {
      setUpdateInfo((prev) => ({ ...prev, status: UpdateStatus.CHECKING }));
      const update = await check();

      if (update) {
        setUpdateInfo({
          status: UpdateStatus.AVAILABLE,
          currentVersion: version,
          newVersion: update.version,
        });
        if (
          update.version &&
          notifiedUpdateVersionRef.current !== update.version
        ) {
          notifiedUpdateVersionRef.current = update.version;
          void notifyNewVersionAvailable(update.version);
        }
      } else {
        setUpdateInfo({
          status: UpdateStatus.LATEST,
          currentVersion: version,
        });
      }
    } catch (error) {
      console.error("Failed to check for updates:", error);
      setUpdateInfo({
        status: UpdateStatus.ERROR,
        currentVersion: version,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  useEffect(() => {

    getVersion().then((currentVersion) => {
      setVersion(currentVersion);
      setUpdateInfo((prev) => ({ ...prev, currentVersion }));
    });


    checkForUpdates();


    const interval = setInterval(checkForUpdates, 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, []);


  useEffect(() => {
    if (showUpdateDialog) {
      checkForUpdates();
    }
  }, [showUpdateDialog]);

  // Listen for update check command
  useEffect(() => {
    const handleShowUpdateDialog = () => {
      setShowUpdateDialog(true);
    };

    window.addEventListener("show-update-dialog", handleShowUpdateDialog);
    return () => window.removeEventListener("show-update-dialog", handleShowUpdateDialog);
  }, []);

  const handleUpdate = async () => {
    try {
      setIsUpdating(true);
      const update = await check();

      if (!update) {
        toast.error("No update available");
        return;
      }

      let downloaded = 0;
      let totalSize = 0;

      await update.downloadAndInstall((progress: DownloadEvent) => {
        switch (progress.event) {
          case "Started":
            if (progress.data.contentLength) {
              totalSize = progress.data.contentLength;
              console.log(`Started downloading ${totalSize} bytes`);
            }
            break;
          case "Progress":
            downloaded += progress.data.chunkLength;
            if (totalSize > 0) {
              const percent = (downloaded / totalSize) * 100;
              setUpdateProgress(percent);
            }
            break;
          case "Finished":
            console.log("Download finished");
            break;
        }
      });

      toast.success("Update installed successfully!");
      await relaunch();
    } catch (error) {
      console.error("Failed to update:", error);
      toast.error("Failed to update: " + error);
    } finally {
      setIsUpdating(false);
      setShowUpdateDialog(false);
    }
  };

  const getStatusMessage = () => {
    switch (updateInfo.status) {
      case UpdateStatus.CHECKING:
        return (
          <div className="flex items-center gap-2 justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"></div>
            <span>Checking for updates...</span>
          </div>
        );
      case UpdateStatus.AVAILABLE:
        return (
          <div className="text-center">
            A new version (v{updateInfo.newVersion}) is available!
          </div>
        );
      case UpdateStatus.LATEST:
        return (
          <div className="text-center">You're running the latest version</div>
        );
      case UpdateStatus.ERROR:
        return (
          <div className="text-center text-red-500">
            Failed to check for updates: {updateInfo.error || "Unknown error"}
          </div>
        );
    }
  };

  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        <div
          className="relative cursor-pointer px-1 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowUpdateDialog(true)}
        >
          {updateInfo.status === UpdateStatus.AVAILABLE && (
            <span className="absolute -right-3 top-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
            </span>
          )}
          v{version}
        </div>
      </div>

      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent className="w-[280px] rounded-xl bg-background backdrop-blur-sm [&>button]:text-foreground [&>button]:cursor-pointer [&>button:hover]:text-foreground/80">
          <div className="flex flex-col items-center gap-4 py-4">
            { }
            <div className="w-20 h-20 bg-linear-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <img src={logo} alt="CFM" className="w-full h-full object-contain" />
            </div>

            { }
            <div className="space-y-3 w-full">
              <div className="text-center space-y-0.5">
                <h2 className="text-xl font-semibold text-foreground">CFM</h2>
                <p className="text-xs text-gray-400">Version {version}</p>
                <p className="text-[10px] text-gray-500 max-w-[240px] mx-auto mt-2">
                  Cloudflared Access Manager
                </p>
              </div>

              { }
              <div className="text-xs text-foreground py-1.5">
                {getStatusMessage()}
              </div>

              { }
              {isUpdating && (
                <div className="space-y-1.5 px-3">
                  <Progress value={updateProgress} className="h-1" />
                  <p className="text-xs text-gray-400 text-center">
                    Downloading update: {Math.round(updateProgress)}%
                  </p>
                </div>
              )}

              { }
              {updateInfo.status === UpdateStatus.AVAILABLE && (
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    className="text-xs"
                  >
                    {isUpdating ? "Updating..." : "Update Now"}
                  </Button>
                </div>
              )}
            </div>

            { }
            <div className="text-[10px] text-gray-500 text-center">
              © {new Date().getFullYear()} CFM. All rights reserved.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
