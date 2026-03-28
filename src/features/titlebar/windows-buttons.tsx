import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

export function WindowsButtons() {
  const { i18n } = useLingui();
  const appWindow = getCurrentWindow();
  const [isFocused, setIsFocused] = useState(true);

  useEffect(() => {
    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      setIsFocused(focused);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [appWindow]);

  const handleMinimize = () => {
    appWindow.minimize();
  };

  const handleMaximize = () => {
    appWindow.toggleMaximize();
  };

  const handleClose = () => {
    appWindow.close();
  };

  return (
    <div className="flex h-full">
      <button
        onClick={handleMinimize}
        title={i18n._(msg`Minimize`)}
        aria-label={i18n._(msg`Minimize window`)}
        className={`cursor-pointer w-[46px] h-full flex items-center justify-center text-foreground hover:bg-accent transition-colors focus:outline-none ${!isFocused ? 'opacity-50' : ''}`}
      >
        <Minus size={16} />
      </button>
      <button
        onClick={handleMaximize}
        title={i18n._(msg`Maximize`)}
        aria-label={i18n._(msg`Maximize window`)}
        className={`cursor-pointer w-[46px] h-full flex items-center justify-center text-foreground hover:bg-accent transition-colors focus:outline-none ${!isFocused ? 'opacity-50' : ''}`}
      >
        <Square size={14} />
      </button>
      <button
        onClick={handleClose}
        title={i18n._(msg`Hide to tray`)}
        aria-label={i18n._(msg`Hide window to system tray`)}
        className={`cursor-pointer w-[46px] h-full flex items-center justify-center text-foreground hover:bg-[#e81123] hover:text-white active:bg-[#c50f1f] transition-colors focus:outline-none ${!isFocused ? 'opacity-50' : ''}`}
      >
        <X size={16} />
      </button>
    </div>
  );
}
