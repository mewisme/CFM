import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Toaster } from "@/components/ui/sonner"
import Home from './pages/home';
import { Layout } from './components/layout';
import Empty from './pages/empty';
import { Titlebar } from './features/titlebar';
import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getAppSettings, initCfmDatabase } from '@/lib/database';
import { moveWindow, Position } from '@tauri-apps/plugin-positioner'

function App() {
  async function bootstrap() {
    await initCfmDatabase();
    const [isLoginAutostart, appSettings] = await Promise.all([
      invoke<boolean>('app_is_login_autostart_launch'),
      getAppSettings(),
    ]);
    await invoke("splash_close");
    if (isLoginAutostart && appSettings.autostart_minimized) {
      await getCurrentWindow().hide();
    }
    await moveWindow(Position.Center);
  }

  useEffect(() => {
    bootstrap();
  }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <>
        <Titlebar />
        <BrowserRouter>
          <Layout>
            <Toaster position="bottom-center" richColors offset={50} />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/empty" element={<Empty />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </>
    </ThemeProvider>
  );
}

export default App;
