import { ButtonLink } from "@/components/ui";

export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-sm font-semibold text-indigo-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Record not found</h1>
      <p className="mt-2 text-sm text-slate-500">
        It may have been deleted, or it belongs to someone whose records you can&apos;t see.
      </p>
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/dashboard">Go to dashboard</ButtonLink>
      </div>
    </div>
  );
}
