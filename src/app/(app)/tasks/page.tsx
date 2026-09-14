import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ActivityList } from "@/components/activity-list";
import { ActivityFields } from "@/components/forms/activity-fields";
import { Card, PageHeader } from "@/components/ui";
import { ACTIVITY_VIEWS, contactOptions, dealOptions, listActivities, userOptions, type ActivityView } from "@/lib/crm";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { cx, first } from "@/lib/utils";
import { createActivityAction } from "./actions";

export const metadata: Metadata = { title: "Tasks" };

const VIEW_LABELS: Record<ActivityView, string> = {
  open: "Open",
  overdue: "Overdue",
  today: "Due today",
  upcoming: "Upcoming",
  done: "Completed",
};

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = ACTIVITY_VIEWS.find((v) => v === first(sp.view)) ?? "open";
  const team = user.role !== "REP" && first(sp.scope) === "team";

  const [activities, contacts, deals, owners] = await Promise.all([
    listActivities(user, { view, mine: !team }),
    contactOptions(user),
    dealOptions(user),
    can.reassignOwner(user) ? userOptions() : undefined,
  ]);

  const href = (v: ActivityView, scope = team ? "team" : "mine") => `/tasks?view=${v}&scope=${scope}`;

  return (
    <>
      <PageHeader
        title="Tasks & activities"
        description="Calls, meetings, emails and to-dos. Tick one off to complete it."
        actions={
          user.role !== "REP" && (
            <div className="inline-flex rounded-md bg-white p-0.5 text-sm ring-1 ring-slate-300">
              {(["mine", "team"] as const).map((scope) => (
                <Link
                  key={scope}
                  href={href(view, scope)}
                  className={cx(
                    "rounded px-3 py-1 font-medium",
                    (scope === "team") === team ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  {scope === "mine" ? "Mine" : "Whole team"}
                </Link>
              ))}
            </div>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" padded={false}>
          <nav className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2">
            {ACTIVITY_VIEWS.map((v) => (
              <Link
                key={v}
                href={href(v)}
                aria-current={v === view ? "page" : undefined}
                className={cx(
                  "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
                  v === view ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800",
                )}
              >
                {VIEW_LABELS[v]}
              </Link>
            ))}
          </nav>
          <div className="px-4">
            <ActivityList activities={activities} emptyText="No tasks in this view." />
          </div>
        </Card>
        <Card title="New task" className="self-start">
          <ActionForm action={createActivityAction} resetOnSuccess>
            <ActivityFields contacts={contacts} deals={deals} owners={owners} compact />
            <div className="mt-4 flex justify-end">
              <SubmitButton>Add task</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
