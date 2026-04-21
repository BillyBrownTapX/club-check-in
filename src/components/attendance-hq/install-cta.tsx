import { useState } from "react";
import { Download, Share, Plus, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { cn } from "@/lib/utils";

export function InstallBanner({ className }: { className?: string }) {
  const { canInstall, isInstalled, isIos, hasNativePrompt, promptInstall, dismissIosHint } = useInstallPrompt();
  const [showIosHint, setShowIosHint] = useState(false);

  if (isInstalled || !canInstall) return null;

  const onInstall = async () => {
    if (hasNativePrompt) {
      await promptInstall();
      return;
    }
    if (isIos) {
      setShowIosHint(true);
    }
  };

  const onDismiss = () => {
    if (isIos) dismissIosHint();
    setShowIosHint(false);
  };

  return (
    <div className={cn("install-cta ios-card relative mt-3 overflow-hidden rounded-[1.5rem] p-4", className)}>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss install prompt"
        className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-muted-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-brand text-primary-foreground">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-extrabold text-foreground">Install Attendance HQ</p>
          <p className="mt-0.5 text-[12.5px] leading-5 text-muted-foreground">
            Faster access during live events. Add to your home screen.
          </p>

          {showIosHint && isIos ? (
            <div className="mt-3 rounded-xl bg-secondary/70 p-3 text-[12.5px] leading-5 text-foreground">
              <p className="flex items-center gap-1.5">
                <span>1.</span> Tap <Share className="inline h-4 w-4 text-primary" /> Share
              </p>
              <p className="mt-1 flex items-center gap-1.5">
                <span>2.</span> Choose <Plus className="inline h-4 w-4 text-primary" /> Add to Home Screen
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <Button type="button" variant="hero" size="sm" className="rounded-full" onClick={onInstall}>
                <Download className="mr-1.5 h-4 w-4" />
                {hasNativePrompt ? "Install app" : "How to install"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function InstallButton({ className }: { className?: string }) {
  const { canInstall, isInstalled, isIos, hasNativePrompt, promptInstall, dismissIosHint } = useInstallPrompt();
  const [showIosHint, setShowIosHint] = useState(false);

  if (isInstalled) return null;

  const onInstall = async () => {
    if (hasNativePrompt) {
      await promptInstall();
      return;
    }
    if (isIos) {
      setShowIosHint((s) => !s);
    }
  };

  // If there's nothing actionable (not iOS, no prompt yet) hide entirely.
  if (!canInstall && !isIos) return null;

  return (
    <div className={cn("install-cta", className)}>
      <Button type="button" variant="tonal" size="lg" className="w-full rounded-2xl justify-start" onClick={onInstall}>
        <Download className="mr-2 h-4 w-4" />
        {hasNativePrompt ? "Install Attendance HQ" : "Add to Home Screen"}
      </Button>

      {showIosHint && isIos ? (
        <div className="mt-2 rounded-xl bg-secondary/70 p-3 text-[12.5px] leading-5 text-foreground">
          <p className="flex items-center gap-1.5">
            <span>1.</span> Tap <Share className="inline h-4 w-4 text-primary" /> Share in Safari
          </p>
          <p className="mt-1 flex items-center gap-1.5">
            <span>2.</span> Choose <Plus className="inline h-4 w-4 text-primary" /> Add to Home Screen
          </p>
          <button
            type="button"
            onClick={() => {
              dismissIosHint();
              setShowIosHint(false);
            }}
            className="mt-2 text-[12px] font-semibold text-primary"
          >
            Got it
          </button>
        </div>
      ) : null}
    </div>
  );
}
