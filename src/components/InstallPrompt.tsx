import { useState, useEffect } from "react";

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!showPrompt) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  return (
    <div className="fixed bottom-16 left-4 right-4 z-40 rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-lg dark:border-indigo-800 dark:bg-indigo-950 sm:hidden">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">Install BuildBid</p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400">Add to Home Screen for quick access</p>
        </div>
        <button onClick={handleInstall} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
          Install
        </button>
        <button onClick={() => setShowPrompt(false)} className="text-xs text-gray-400 hover:text-gray-500">&times;</button>
      </div>
    </div>
  );
}
