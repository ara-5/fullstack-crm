"use client";

import { useFormState } from "@/components/action-form";
import { Field } from "@/components/action-form";
import { Input } from "@/components/ui";

/** Appears only after loginAction reports the account needs a 2FA code. */
export function TwoFactorField() {
  const { state } = useFormState();
  if (!state.need2fa) return null;

  return (
    <Field label="Authentication code" name="totp" hint="From your authenticator app, or a recovery code">
      <Input name="totp" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={11} required />
    </Field>
  );
}
