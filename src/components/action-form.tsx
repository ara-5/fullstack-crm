"use client";

import { createContext, useContext, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/ui";
import type { ActionState } from "@/lib/errors";
import { cx } from "@/lib/utils";

type FormAction = (formData: FormData) => Promise<ActionState | void>;

const FormContext = createContext<{ state: ActionState; pending: boolean }>({ state: {}, pending: false });

/** Reads the enclosing ActionForm's result, e.g. to conditionally reveal a field. */
export function useFormState() {
  return useContext(FormContext);
}

/**
 * Form wrapper for Server Actions that shows field errors and notices.
 * Submits manually (instead of <form action>) so inputs are NOT cleared
 * when the server returns validation errors.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = (await action(formData)) ?? { ok: true };
      setState(result);
      if (result.ok && resetOnSuccess) formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className={className}>
      <FormContext.Provider value={{ state, pending }}>
        {children}
        {state.error && (
          <div role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
            {state.details && state.details.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-xs">
                {state.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {state.ok && state.message && (
          <p role="status" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.message}
          </p>
        )}
        {state.secret && (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-amber-900">Copy this now. It won&apos;t be shown again.</p>
            <code className="mt-2 block break-all rounded bg-surface px-2 py-1.5 font-mono text-xs text-slate-800">
              {state.secret}
            </code>
          </div>
        )}
        {state.secrets && state.secrets.length > 0 && (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-amber-900">Save these now. Each works once, and they won&apos;t be shown again.</p>
            <ul className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-xs text-slate-800">
              {state.secrets.map((code) => (
                <li key={code} className="rounded bg-surface px-2 py-1.5 text-center">
                  {code}
                </li>
              ))}
            </ul>
          </div>
        )}
      </FormContext.Provider>
    </form>
  );
}

export function Field({
  label,
  name,
  hint,
  className,
  children,
}: {
  label: string;
  name?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  const { state } = useContext(FormContext);
  const error = name ? state.fieldErrors?.[name]?.[0] : undefined;
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      )}
    </label>
  );
}

export function SubmitButton({
  children,
  variant,
  className,
  pendingText = "Saving…",
  label,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  pendingText?: string;
  /** Accessible name when the visible text is too short to stand alone. */
  label?: string;
}) {
  const { pending } = useContext(FormContext);
  return (
    <Button type="submit" variant={variant} className={className} disabled={pending} aria-label={label}>
      {pending ? pendingText : children}
    </Button>
  );
}
