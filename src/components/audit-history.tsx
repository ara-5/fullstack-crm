import type { AuditLog } from "@prisma/client";
import { EmptyState } from "@/components/ui";
import type { Changes, Scalar } from "@/lib/diff";
import { formatDate, formatDateTime } from "@/lib/utils";

const DEFAULT_LABELS: Record<string, string> = {
  firstName: "first name",
  lastName: "last name",
  companyId: "company",
  contactId: "contact",
  ownerId: "owner",
  expectedClose: "expected close",
};

const VERBS: Record<string, string> = {
  created: "created this record",
  deleted: "deleted this record",
  updated: "updated",
  stage_changed: "moved the stage",
  completed: "completed",
  reopened: "reopened",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;

function display(value: Scalar) {
  if (value === null || value === "") return "empty";
  if (typeof value === "string" && ISO_DATE.test(value)) return formatDate(value);
  const text = String(value);
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

export function AuditHistory({
  entries,
  labels = {},
}: {
  entries: (AuditLog & { user: { name: string } | null })[];
  labels?: Record<string, string>;
}) {
  if (entries.length === 0) return <EmptyState>No changes recorded yet.</EmptyState>;
  const label = (field: string) => labels[field] ?? DEFAULT_LABELS[field] ?? field;

  return (
    <ol className="space-y-3 text-sm">
      {entries.map((entry) => {
        const changes = Object.entries((entry.changes ?? {}) as Changes);
        return (
          <li key={entry.id} className="border-l-2 border-slate-200 pl-3">
            <p className="text-slate-700">
              <span className="font-medium text-slate-900">{entry.user?.name ?? "System"}</span>{" "}
              {VERBS[entry.action] ?? entry.action}
              {entry.action === "stage_changed" && entry.summary ? `: ${entry.summary}` : ""}
            </p>
            {entry.action === "updated" && changes.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                {changes.map(([field, change]) => (
                  <li key={field}>
                    <span className="text-slate-700">{label(field)}</span>
                    {field.endsWith("Id") ? " changed" : `: ${display(change.from)} → ${display(change.to)}`}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(entry.createdAt)}</p>
          </li>
        );
      })}
    </ol>
  );
}
