import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { moveWindow, Position } from "@tauri-apps/plugin-positioner";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { Layout } from "@/components/layout";
import { Titlebar } from "@/features/titlebar";
import { getAppSettings, initCfmDatabase } from "@/lib/database";
import { loadLocaleCatalog } from "@/lib/load-locale-catalog";
import Home from "./pages/home";

function App() {
  const [bootReady, setBootReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initCfmDatabase();
      const [isLoginAutostart, appSettings] = await Promise.all([
        invoke<boolean>("app_is_login_autostart_launch"),
        getAppSettings(),
      ]);
      await loadLocaleCatalog(appSettings.locale);
      if (cancelled) {
        return;
      }
      setBootReady(true);
      const startInTray = isLoginAutostart && appSettings.autostart_minimized;
      await invoke("splash_close", { showMain: !startInTray });
      if (startInTray) {
        await getCurrentWindow().hide();
      } else {
        await moveWindow(Position.Center);
      }
    })().catch((error) => {
      console.error(error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!bootReady) {
    return null;
  }

  return (
    <I18nProvider i18n={i18n}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <>
          <Titlebar />
          <BrowserRouter>
            <Layout>
              <Toaster position="bottom-center" richColors offset={50} />
              <Routes>
                <Route path="/" element={<Home />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </>
      </ThemeProvider>
    </I18nProvider>
  );
}

export default App;
