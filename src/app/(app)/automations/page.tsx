import type { Metadata } from "next";
import type { AutomationRule } from "@prisma/client";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge, Button, Card, EmptyState, PageHeader, Table, td, th } from "@/components/ui";
import { EVENT_LABELS, stageInfo, titleCase, type CrmEvent } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { formatCurrency, formatDateTime, parseJson } from "@/lib/utils";
import { createRuleAction, deleteRuleAction, toggleRuleAction } from "./actions";
import { RuleForm } from "./rule-form";

export const metadata: Metadata = { title: "Automations" };

type Config = Record<string, string | number | undefined>;

function describeRule(rule: AutomationRule) {
  const c = parseJson<Config>(rule.conditions, {});
  const cfg = parseJson<Config>(rule.actionConfig, {});

  const conditions = [
    c.fromStage && `from ${stageInfo(String(c.fromStage)).label}`,
    c.toStage && `to ${stageInfo(String(c.toStage)).label}`,
    c.minValue !== undefined && `value ≥ ${formatCurrency(Number(c.minValue))}`,
    c.contactStatus && `contact is ${titleCase(String(c.contactStatus))}`,
  ].filter(Boolean);

  const then =
    rule.action === "CREATE_TASK"
      ? `create task “${cfg.subject ?? "Follow up"}” due in ${cfg.dueInDays ?? 1} day(s)`
      : rule.action === "SEND_EMAIL"
        ? `email the ${cfg.to === "owner" ? "owner" : "contact"}: “${cfg.subject ?? ""}”`
        : `set contact status to ${titleCase(String(cfg.status ?? ""))}`;

  const when = EVENT_LABELS[rule.trigger as CrmEvent] ?? rule.trigger;
  return `When ${when}${conditions.length ? ` (${conditions.join(", ")})` : ""}, ${then}.`;
}

export default async function AutomationsPage() {
  await requireRole("ADMIN", "MANAGER");
  const [rules, emails] = await Promise.all([
    prisma.automationRule.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  return (
    <>
      <PageHeader
        title="Automations"
        description="Rules that run automatically when something happens in the CRM."
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card title={`Rules (${rules.length})`} padded={false}>
            {rules.length === 0 ? (
              <div className="p-4">
                <EmptyState>No automations yet. Create one on the right.</EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {rules.map((rule) => (
                  <li key={rule.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{rule.name}</span>
                        <Badge tone={rule.active ? "green" : "slate"}>{rule.active ? "Active" : "Paused"}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{describeRule(rule)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Ran {rule.runCount} time{rule.runCount === 1 ? "" : "s"}
                        {rule.lastRunAt && ` · last ${formatDateTime(rule.lastRunAt)}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <form action={toggleRuleAction.bind(null, rule.id)}>
                        <Button type="submit" variant="secondary">
                          {rule.active ? "Pause" : "Resume"}
                        </Button>
                      </form>
                      <form action={deleteRuleAction.bind(null, rule.id)}>
                        <ConfirmButton message={`Delete "${rule.name}"?`}>Delete</ConfirmButton>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Recent emails" padded={false}>
            {emails.length === 0 ? (
              <div className="p-4">
                <EmptyState>No emails sent yet.</EmptyState>
              </div>
            ) : (
              <Table>
                <thead className="bg-slate-50">
                  <tr>
                    <th className={th}>To</th>
                    <th className={th}>Subject</th>
                    <th className={th}>Status</th>
                    <th className={th}>When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {emails.map((e) => (
                    <tr key={e.id}>
                      <td className={td}>{e.to}</td>
                      <td className={td}>{e.subject}</td>
                      <td className={td}>
                        <Badge tone={e.status === "FAILED" ? "red" : e.status === "SENT" ? "green" : "slate"}>
                          {e.status === "LOGGED" ? "Logged (no SMTP)" : titleCase(e.status)}
                        </Badge>
                      </td>
                      <td className={td}>{formatDateTime(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <Card title="New automation" className="self-start lg:col-span-2">
          <RuleForm action={createRuleAction} />
        </Card>
      </div>
    </>
  );
}
