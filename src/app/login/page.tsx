import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm, Field, SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, titleCase } from "@/lib/constants";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";
import { first, safePath } from "@/lib/utils";
import { loginAction } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/dashboard");
  const callbackUrl = safePath(first((await searchParams).callbackUrl));
  const showDemo = env.DEMO_MODE || env.NODE_ENV === "development";

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold text-white">
            C
          </span>
          <h1 className="text-xl font-semibold text-slate-900">Sign in to your CRM</h1>
        </div>

        <div className="rounded-xl border border-slate-200 bg-surface p-6 shadow-sm">
          <ActionForm action={loginAction} className="space-y-4">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <Field label="Email" name="email">
              <Input type="email" name="email" autoComplete="email" required />
            </Field>
            <Field label="Password" name="password">
              <Input type="password" name="password" autoComplete="current-password" required />
            </Field>
            <SubmitButton className="w-full" pendingText="Signing in…">
              Sign in
            </SubmitButton>
          </ActionForm>
        </div>

        {showDemo && (
          <section aria-labelledby="demo-heading" className="mt-4 rounded-xl border border-slate-200 bg-surface p-4">
            <h2 id="demo-heading" className="text-sm font-medium text-slate-900">
              Explore the demo
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              One click, no sign-up. Each role sees different data and permissions.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.slice(0, 3).map((account) => (
                <ActionForm key={account.email} action={loginAction}>
                  <input type="hidden" name="email" value={account.email} />
                  <input type="hidden" name="password" value={DEMO_PASSWORD} />
                  <input type="hidden" name="callbackUrl" value={callbackUrl} />
                  <SubmitButton variant="secondary" className="w-full" pendingText="…" label={`Sign in as ${titleCase(account.role)}`}>
                    {titleCase(account.role)}
                  </SubmitButton>
                </ActionForm>
              ))}
            </div>
          </section>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          Open source under AGPL-3.0 ·{" "}
          <a href={env.SOURCE_CODE_URL} target="_blank" rel="noreferrer" className="underline hover:text-slate-700">
            Source code
          </a>
        </p>
      </div>
    </main>
  );
}
