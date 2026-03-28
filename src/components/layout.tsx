import { ReactNode } from "react";

import { Footer } from "./footer";
import { SettingsProvider } from "./settings-provider";

/** Titlebar height (must match `titlebar-container`). */
const TITLEBAR_PX = 35;
/** Footer is `h-8` (32px). */
const FOOTER_PX = 32;

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SettingsProvider>
      <main
        className="fixed inset-x-0 flex min-h-0 flex-col overflow-hidden bg-secondary"
        style={{
          top: TITLEBAR_PX,
          bottom: FOOTER_PX,
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </main>

      <Footer />
    </SettingsProvider>
  );
}
