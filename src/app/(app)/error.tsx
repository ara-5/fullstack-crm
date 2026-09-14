"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-sm font-semibold text-indigo-600">Error</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-500">
        An unexpected error occurred while loading this page.
        {error.digest && (
          <>
            {" "}
            Reference: <code className="font-mono">{error.digest}</code>
          </>
        )}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <ButtonLink href="/dashboard" variant="secondary">
          Go to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
