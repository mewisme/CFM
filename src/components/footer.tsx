import { ExternalLink, Github, Settings } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

import { VersionDisplay } from "@/features/updater/version-display";

import { useAppSettings } from "./settings-provider";

export function Footer() {
  const { openSettingsDialog } = useAppSettings();

  const openLink = async (url: string) => {
    await openUrl(url);
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-9998 flex h-8 items-center justify-center gap-4 border-t border-muted-foreground/30 bg-background text-xs text-muted-foreground backdrop-blur-sm">
      <button
        type="button"
        onClick={openSettingsDialog}
        className="flex items-center gap-1.5 transition-colors hover:text-foreground"
      >
        <Settings size={14} aria-hidden />
        <span>Settings</span>
      </button>
      <span className="text-muted-foreground/50">•</span>
      <VersionDisplay />
      <span className="text-muted-foreground/50">•</span>
      <a
        href="https://github.com/mewisme/cfm"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 hover:text-foreground transition-colors"
      >
        <Github size={14} />
        <span>GitHub</span>
      </a>

      <span className="text-muted-foreground/50">•</span>

      <button
        onClick={() => openLink('https://mewis.me')}
        className="flex items-center gap-1.5 hover:text-foreground transition-colors"
      >
        <span>mewis.me</span>
        <ExternalLink size={10} />
      </button>
    </footer>
  );
}
