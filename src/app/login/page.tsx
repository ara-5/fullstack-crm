import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm, Field, SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui";
import { getCurrentUser } from "@/lib/session";
import { first, safePath } from "@/lib/utils";
import { loginAction } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const isDev = process.env.NODE_ENV === "development";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/dashboard");
  const callbackUrl = safePath(first((await searchParams).callbackUrl));

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold text-white">
            C
          </span>
          <h1 className="text-xl font-semibold text-slate-900">Sign in to your CRM</h1>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ActionForm action={loginAction} className="space-y-4">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <Field label="Email" name="email">
              <Input type="email" name="email" autoComplete="email" required defaultValue={isDev ? "admin@crm.local" : undefined} />
            </Field>
            <Field label="Password" name="password">
              <Input type="password" name="password" autoComplete="current-password" required defaultValue={isDev ? "Password123!" : undefined} />
            </Field>
            <SubmitButton className="w-full" pendingText="Signing in…">
              Sign in
            </SubmitButton>
          </ActionForm>
        </div>
        {isDev && (
          <p className="mt-4 text-center text-xs text-slate-500">
            Demo accounts (password <code className="font-mono">Password123!</code>): admin@crm.local, manager@crm.local,
            rep@crm.local
          </p>
        )}
      </div>
    </main>
  );
}
