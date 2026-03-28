import { Trans } from "@lingui/react/macro";

import { MacOSButtons } from "./mac-os-buttons";
import { TitlebarContainer } from "./titlebar-container";

export function MacOSTitlebar() {
  return (
    <TitlebarContainer>
      {/* Buttons - Absolute Left */}
      <div className="absolute left-3 flex items-center gap-3">
        <MacOSButtons />
      </div>

      {/* Title - Centered */}
      <div data-tauri-drag-region className="flex items-center justify-center h-full px-3">
        <span className="text-[13px] font-medium text-foreground/70 pointer-events-none">
          <Trans>Cloudflared Access Manager</Trans>
        </span>
      </div>
    </TitlebarContainer>
  );
}
