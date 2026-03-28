import { Trans } from "@lingui/react/macro";

import logo from "@/assets/app-icon.png";
import { TitlebarContainer } from "./titlebar-container";
import { WindowsButtons } from "./windows-buttons";

export function WindowsTitlebar() {
  return (
    <TitlebarContainer>
      {/* Title - Centered */}
      <div data-tauri-drag-region className="flex items-center justify-center h-full px-3">
        <img src={logo} alt="CFM" className="w-4 h-4 mr-2" />
        <span className="text-[13px] font-medium text-foreground/70 pointer-events-none">
          <Trans>Cloudflared Access Manager</Trans>
        </span>
      </div>

      {/* Buttons - Absolute Right */}
      <div className="absolute h-full right-0">
        <WindowsButtons />
      </div>
    </TitlebarContainer>
  );
}
