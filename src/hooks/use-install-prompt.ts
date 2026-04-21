import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

const IOS_HINT_DISMISSED_KEY = "ahq:ios-install-hint-dismissed";

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
    // iOS Safari
    const nav = window.navigator as Navigator & { standalone?: boolean };
    if (nav.standalone === true) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function detectIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  const isIPhoneIPad = /iPhone|iPad|iPod/i.test(ua);
  // iPadOS 13+ reports as MacIntel with touch
  const isIpadOs =
    ua.includes("Macintosh") && (window.navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1;
  return isIPhoneIPad || isIpadOs;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => detectStandalone());
  const [isIos] = useState<boolean>(() => detectIos());
  const [iosHintDismissed, setIosHintDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(IOS_HINT_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const installed = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler as EventListener);
    window.addEventListener("appinstalled", installed);

    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onChange = () => setIsInstalled(detectStandalone());
    mq?.addEventListener?.("change", onChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler as EventListener);
      window.removeEventListener("appinstalled", installed);
      mq?.removeEventListener?.("change", onChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return { outcome: "unavailable" as const };
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    return { outcome: choice.outcome };
  }, [deferredPrompt]);

  const dismissIosHint = useCallback(() => {
    setIosHintDismissed(true);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(IOS_HINT_DISMISSED_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  }, []);

  const canInstall = !isInstalled && (Boolean(deferredPrompt) || (isIos && !iosHintDismissed));

  return {
    canInstall,
    isInstalled,
    isIos,
    hasNativePrompt: Boolean(deferredPrompt),
    iosHintDismissed,
    promptInstall,
    dismissIosHint,
  };
}
