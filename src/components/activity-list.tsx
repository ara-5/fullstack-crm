import Link from "next/link";
import type { Activity } from "@prisma/client";
import { deleteActivityAction, toggleActivityAction } from "@/app/(app)/tasks/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge, EmptyState, StatusBadge } from "@/components/ui";
import { titleCase } from "@/lib/constants";
import { cx, formatDate, formatDateTime, fullName } from "@/lib/utils";

export type ActivityWithLinks = Activity & {
  contact?: { id: string; firstName: string; lastName: string } | null;
  deal?: { id: string; title: string } | null;
  owner?: { name: string } | null;
};

function isOverdue(activity: Activity) {
  return !activity.completedAt && activity.dueAt !== null && activity.dueAt.getTime() < Date.now();
}

export function ActivityList({
  activities,
  emptyText = "Nothing here yet.",
}: {
  activities: ActivityWithLinks[];
  emptyText?: string;
}) {
  if (activities.length === 0) return <EmptyState>{emptyText}</EmptyState>;

  return (
    <ul className="divide-y divide-slate-100">
      {activities.map((a) => {
        const isNote = a.type === "NOTE";
        const done = Boolean(a.completedAt);
        const overdue = isOverdue(a);
        return (
          <li key={a.id} className="flex gap-3 py-3">
            {isNote ? (
              <span aria-hidden className="mt-1 h-3 w-3 shrink-0 rounded-full bg-slate-300" />
            ) : (
              <form action={toggleActivityAction.bind(null, a.id, !done)}>
                <button
                  type="submit"
                  aria-label={done ? `Mark "${a.subject}" as not done` : `Mark "${a.subject}" as done`}
                  className={cx(
                    "mt-0.5 flex h-5 w-5 items-center justify-center rounded border text-xs transition",
                    done ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white hover:border-indigo-500",
                  )}
                >
                  {done ? "✓" : ""}
                </button>
              </form>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{titleCase(a.type)}</Badge>
                <span className={cx("text-sm font-medium text-slate-900", done && !isNote && "text-slate-400 line-through")}>
                  {a.subject}
                </span>
                {!isNote && !done && <StatusBadge value={a.priority} />}
              </div>
              {a.body && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.body}</p>}
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                {a.dueAt && !done && (
                  <span className={cx(overdue && "font-medium text-red-600")}>
                    {overdue ? "Overdue since " : "Due "}
                    {formatDateTime(a.dueAt)}
                  </span>
                )}
                {done && !isNote && <span>Completed {formatDateTime(a.completedAt)}</span>}
                {a.contact && (
                  <Link href={`/contacts/${a.contact.id}`} className="hover:text-indigo-600">
                    {fullName(a.contact)}
                  </Link>
                )}
                {a.deal && (
                  <Link href={`/deals/${a.deal.id}`} className="hover:text-indigo-600">
                    {a.deal.title}
                  </Link>
                )}
                {a.owner && <span>{a.owner.name}</span>}
                {isNote && <span>{formatDate(a.createdAt)}</span>}
              </div>
            </div>
            <form action={deleteActivityAction.bind(null, a.id)}>
              <ConfirmButton message="Delete this activity?" variant="ghost" className="px-2 text-xs">
                Delete
              </ConfirmButton>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
