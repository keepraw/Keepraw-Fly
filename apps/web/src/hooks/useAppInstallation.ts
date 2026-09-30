import { useCallback, useEffect, useRef, useState } from "react";

interface AppInstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type AppInstallationResult = "installed" | "dismissed" | "failed";

export function useAppInstallation() {
  const installPrompt = useRef<AppInstallPromptEvent | null>(null);
  const [canInstallApp, setCanInstallApp] = useState(false);

  useEffect(() => {
    function capturePrompt(event: Event) {
      const prompt = event as AppInstallPromptEvent;
      if (typeof prompt.prompt !== "function") return;
      event.preventDefault();
      installPrompt.current = prompt;
      setCanInstallApp(true);
    }
    function installed() {
      installPrompt.current = null;
      setCanInstallApp(false);
    }
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const installApp = useCallback(async (): Promise<AppInstallationResult> => {
    const prompt = installPrompt.current;
    if (!prompt) return "failed";
    installPrompt.current = null;
    setCanInstallApp(false);

    let finishInstallation: (installed: boolean) => void = () => {};
    const completed = new Promise<boolean>((resolve) => { finishInstallation = resolve; });
    const installed = () => finishInstallation(true);
    window.addEventListener("appinstalled", installed);
    let timeout: number | undefined;
    try {
      await prompt.prompt();
      if ((await prompt.userChoice).outcome === "dismissed") return "dismissed";
      // Acceptance precedes installation; wait until Chrome registers the app.
      timeout = window.setTimeout(() => finishInstallation(false), 30_000);
      return await completed ? "installed" : "failed";
    } catch {
      return "failed";
    } finally {
      window.clearTimeout(timeout);
      window.removeEventListener("appinstalled", installed);
    }
  }, []);

  return { canInstallApp, installApp };
}
