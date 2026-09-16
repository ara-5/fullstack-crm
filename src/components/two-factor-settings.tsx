"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  confirmTwoFactorSetupAction,
  disableTwoFactorAction,
  regenerateRecoveryCodesAction,
  startTwoFactorSetupAction,
} from "@/app/(app)/settings/two-factor-actions";
import { Button, Input } from "@/components/ui";

type Step = "idle" | "setup" | "recovery";

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const [step, setStep] = useState<Step>("idle");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function beginSetup() {
    setError(null);
    startTransition(async () => {
      const result = await startTwoFactorSetupAction();
      if (!result.ok) return setError(result.error);
      setQrDataUrl(result.qrDataUrl);
      setManualKey(result.manualKey);
      setStep("setup");
    });
  }

  function confirmSetup() {
    setError(null);
    startTransition(async () => {
      const result = await confirmTwoFactorSetupAction(code);
      if (!result.ok) return setError(result.error);
      setRecoveryCodes(result.recoveryCodes);
      setStep("recovery");
      router.refresh();
    });
  }

  function regenerate() {
    setError(null);
    startTransition(async () => {
      const result = await regenerateRecoveryCodesAction();
      if (!result.ok) return setError(result.error);
      setRecoveryCodes(result.recoveryCodes);
      setStep("recovery");
    });
  }

  function disable() {
    if (!window.confirm("Turn off two-factor authentication? Anyone with your password could then sign in alone.")) return;
    startTransition(async () => {
      await disableTwoFactorAction();
      setStep("idle");
      setRecoveryCodes(null);
      router.refresh();
    });
  }

  function done() {
    setStep("idle");
    setRecoveryCodes(null);
    setCode("");
  }

  if (step === "recovery" && recoveryCodes) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-700">Two-factor authentication is on. Save these recovery codes somewhere safe — each works once, if you lose your device.</p>
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
          <ul className="grid grid-cols-2 gap-1.5 font-mono text-xs text-slate-800">
            {recoveryCodes.map((c) => (
              <li key={c} className="rounded bg-surface px-2 py-1.5 text-center">
                {c}
              </li>
            ))}
          </ul>
        </div>
        <Button onClick={done}>Done</Button>
      </div>
    );
  }

  if (step === "setup") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-700">Scan this with your authenticator app (Google Authenticator, 1Password, Authy…), or enter the key manually.</p>
        {/* Locally generated data: URI, not a remote image — no next/image benefit here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qrDataUrl && <img src={qrDataUrl} alt="Scan this QR code with your authenticator app" width={200} height={200} className="rounded-md border border-slate-200" />}
        <p className="font-mono text-xs break-all text-slate-500">{manualKey}</p>
        <label className="block max-w-[12rem]">
          <span className="mb-1 block text-xs font-medium text-slate-600">Enter the 6-digit code</span>
          <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={confirmSetup} disabled={pending || code.length !== 6}>
            {pending ? "Verifying…" : "Confirm and enable"}
          </Button>
          <Button variant="secondary" onClick={done} disabled={pending}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700">
        {enabled
          ? "Two-factor authentication is on. You'll need a code from your authenticator app (or a recovery code) to sign in."
          : "Add a second step to sign-in with a free authenticator app, so a leaked password alone can't get in."}
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {enabled ? (
          <>
            <Button variant="secondary" onClick={regenerate} disabled={pending}>
              Regenerate recovery codes
            </Button>
            <Button variant="danger" onClick={disable} disabled={pending}>
              Disable 2FA
            </Button>
          </>
        ) : (
          <Button onClick={beginSetup} disabled={pending}>
            {pending ? "Starting…" : "Enable 2FA"}
          </Button>
        )}
      </div>
    </div>
  );
}
