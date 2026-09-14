import type { Metadata } from "next";
import { ActionForm, Field, SubmitButton } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, StatusBadge, Table, td, th } from "@/components/ui";
import { CRM_EVENTS, ROLES, titleCase } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import Link from "next/link";
import { listRecentAudit } from "@/lib/audit";
import { env, features } from "@/lib/env";
import { formatDate, formatDateTime } from "@/lib/utils";

const ENTITY_PATHS: Record<string, string> = { contact: "contacts", company: "companies", deal: "deals" };
import {
  changePasswordAction,
  createApiKeyAction,
  createUserAction,
  createWebhookAction,
  deleteWebhookAction,
  revokeApiKeyAction,
  toggleUserActiveAction,
  toggleWebhookAction,
  updateUserRoleAction,
} from "./actions";

export const metadata: Metadata = { title: "Settings" };

const ENDPOINTS = [
  ["GET / POST", "/api/v1/contacts", "List (q, status, companyId, page, pageSize) or create"],
  ["GET / PATCH / DELETE", "/api/v1/contacts/:id", "Read, update or delete a contact"],
  ["GET / POST", "/api/v1/companies", "List (q, page, pageSize) or create"],
  ["GET / PATCH / DELETE", "/api/v1/companies/:id", "Read, update or delete a company"],
  ["GET / POST", "/api/v1/deals", "List (q, stage) or create"],
  ["GET / PATCH / DELETE", "/api/v1/deals/:id", "Read, update (incl. stage) or delete a deal"],
  ["GET / POST", "/api/v1/activities", "List (view=open|overdue|today|upcoming|done) or create"],
  ["PATCH / DELETE", "/api/v1/activities/:id", "Update ({ completed: true }) or delete"],
];

export default async function SettingsPage() {
  const user = await requireUser();
  const isAdmin = can.manageUsers(user);

  const [apiKeys, users, webhooks, recentChanges] = await Promise.all([
    prisma.apiKey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    isAdmin
      ? prisma.user.findMany({
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, email: true, role: true, active: true },
        })
      : Promise.resolve([]),
    isAdmin ? prisma.webhook.findMany({ orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    isAdmin ? listRecentAudit(20) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Settings" description={`Signed in as ${user.name} (${user.email})`} />
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Change password">
            {env.DEMO_MODE ? (
              <p className="text-sm text-slate-500">Password changes are disabled in the public demo.</p>
            ) : (
            <ActionForm action={changePasswordAction} resetOnSuccess className="space-y-3">
              <Field label="Current password" name="currentPassword">
                <Input type="password" name="currentPassword" autoComplete="current-password" required />
              </Field>
              <Field label="New password" name="newPassword" hint="At least 8 characters">
                <Input type="password" name="newPassword" autoComplete="new-password" minLength={8} required />
              </Field>
              <div className="flex justify-end">
                <SubmitButton>Update password</SubmitButton>
              </div>
            </ActionForm>
            )}
          </Card>

          <Card title="Your API keys">
            {apiKeys.length === 0 ? (
              <p className="mb-3 text-sm text-slate-500">No keys yet. Keys act with your permissions.</p>
            ) : (
              <ul className="mb-4 divide-y divide-slate-100">
                {apiKeys.map((k) => (
                  <li key={k.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{k.name}</p>
                      <p className="text-xs text-slate-500">
                        <code className="font-mono">{k.prefix}…</code> · created {formatDate(k.createdAt)} ·{" "}
                        {k.lastUsedAt ? `last used ${formatDateTime(k.lastUsedAt)}` : "never used"}
                      </p>
                    </div>
                    <form action={revokeApiKeyAction.bind(null, k.id)}>
                      <ConfirmButton message={`Revoke "${k.name}"? Apps using it will stop working.`}>Revoke</ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={createApiKeyAction} resetOnSuccess>
              <div className="flex items-end gap-2">
                <Field label="New key name" name="name" className="flex-1">
                  <Input name="name" placeholder="e.g. Zapier" required />
                </Field>
                <SubmitButton>Create key</SubmitButton>
              </div>
            </ActionForm>
          </Card>
        </div>

        {isAdmin && (
          <Card title="Team members" padded={false}>
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <th className={th}>User</th>
                  <th className={th}>Role</th>
                  <th className={th}>Status</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isSelf = u.id === user.id;
                  return (
                    <tr key={u.id}>
                      <td className={td}>
                        <p className="font-medium text-slate-900">
                          {u.name} {isSelf && <span className="text-xs font-normal text-slate-500">(you)</span>}
                        </p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className={td}>
                        {isSelf || env.DEMO_MODE ? (
                          <StatusBadge value={u.role} />
                        ) : (
                          <form action={updateUserRoleAction.bind(null, u.id)} className="flex items-center gap-2">
                            <Select name="role" defaultValue={u.role} aria-label={`Role for ${u.name}`} className="w-32">
                              {ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {titleCase(r)}
                                </option>
                              ))}
                            </Select>
                            <Button type="submit" variant="secondary">
                              Save
                            </Button>
                          </form>
                        )}
                      </td>
                      <td className={td}>
                        <Badge tone={u.active ? "green" : "slate"}>{u.active ? "Active" : "Deactivated"}</Badge>
                      </td>
                      <td className={`${td} text-right`}>
                        {!isSelf && !env.DEMO_MODE && (
                          <form action={toggleUserActiveAction.bind(null, u.id)}>
                            <Button type="submit" variant={u.active ? "danger" : "secondary"}>
                              {u.active ? "Deactivate" : "Reactivate"}
                            </Button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {!env.DEMO_MODE && (
            <div className="border-t border-slate-100 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Add a user</h3>
              <ActionForm action={createUserAction} resetOnSuccess>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
                  <Field label="Name" name="name">
                    <Input name="name" required />
                  </Field>
                  <Field label="Email" name="email">
                    <Input type="email" name="email" required />
                  </Field>
                  <Field label="Role" name="role">
                    <Select name="role" defaultValue="REP">
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {titleCase(r)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Temporary password" name="password">
                    <Input type="text" name="password" minLength={8} required autoComplete="off" />
                  </Field>
                  <SubmitButton>Add user</SubmitButton>
                </div>
              </ActionForm>
            </div>
            )}
          </Card>
        )}

        {isAdmin && (
          <Card title="Webhooks">
            {!features.webhooks && (
              <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Webhook delivery is disabled in the public demo.
              </p>
            )}
            <p className="mb-3 text-sm text-slate-500">
              We POST JSON to your URL when events happen. Each request carries an{" "}
              <code className="font-mono text-xs">X-CRM-Signature: sha256=…</code> header: an HMAC-SHA256 of the raw
              body, signed with the webhook&apos;s secret.
            </p>
            {webhooks.length === 0 ? (
              <EmptyState>No webhooks configured.</EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100">
                {webhooks.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-slate-900">{w.url}</p>
                      <p className="text-xs text-slate-500">
                        {w.events.split(",").join(", ")} ·{" "}
                        {w.lastDeliveredAt
                          ? `last delivery ${formatDateTime(w.lastDeliveredAt)} (${w.lastStatus === 0 ? "network error" : `HTTP ${w.lastStatus}`})`
                          : "no deliveries yet"}
                        {w.lastError && ` · ${w.lastError}`}
                        {!w.active && w.failureCount >= 10 && " · paused after repeated failures"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge tone={w.active ? "green" : "slate"}>{w.active ? "Active" : "Paused"}</Badge>
                      <form action={toggleWebhookAction.bind(null, w.id)}>
                        <Button type="submit" variant="secondary">
                          {w.active ? "Pause" : "Resume"}
                        </Button>
                      </form>
                      <form action={deleteWebhookAction.bind(null, w.id)}>
                        <ConfirmButton message="Delete this webhook?">Delete</ConfirmButton>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={createWebhookAction} resetOnSuccess className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <Field label="Endpoint URL" name="url">
                <Input type="url" name="url" placeholder="https://example.com/hooks/crm" required />
              </Field>
              <fieldset>
                <legend className="mb-1 text-xs font-medium text-slate-600">Events</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {CRM_EVENTS.map((e) => (
                    <label key={e} className="flex items-center gap-1.5 text-sm text-slate-700">
                      <input type="checkbox" name="events" value={e} defaultChecked={e.startsWith("deal.")} className="rounded border-slate-300" />
                      <code className="font-mono text-xs">{e}</code>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex justify-end">
                <SubmitButton>Add webhook</SubmitButton>
              </div>
            </ActionForm>
          </Card>
        )}

        {isAdmin && (
          <Card title="Recent changes" padded={false}>
            {recentChanges.length === 0 ? (
              <div className="p-4">
                <EmptyState>No changes recorded yet.</EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentChanges.map((entry) => {
                  const base = ENTITY_PATHS[entry.entityType];
                  const href = entry.action !== "deleted" && base ? `/${base}/${entry.entityId}` : null;
                  return (
                    <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                      <span className="min-w-0 text-slate-700">
                        <span className="font-medium text-slate-900">{entry.user?.name ?? "System"}</span>{" "}
                        {entry.action.replace("_", " ")} {entry.entityType}{" "}
                        {href ? (
                          <Link href={href} className="text-indigo-700 hover:underline">
                            {entry.summary ?? "record"}
                          </Link>
                        ) : (
                          entry.summary
                        )}
                      </span>
                      <span className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}

        <Card title="REST API" padded={false}>
          <div className="p-4 text-sm text-slate-600">
            <p>
              Authenticate with an API key from above. Responses are JSON; validation errors return <code>422</code>{" "}
              with details. Keys only see the records their owner can see. Try requests live in the{" "}
              <Link href="/api-docs" className="font-medium text-indigo-700 underline">
                interactive API reference
              </Link>
              .
            </p>
            <pre className="mt-3 overflow-x-auto rounded-md bg-slate-900 p-3 font-mono text-xs text-slate-100">
{`curl -H "Authorization: Bearer crm_…" \\
  "http://localhost:3000/api/v1/deals?stage=PROPOSAL"

curl -X POST -H "Authorization: Bearer crm_…" -H "Content-Type: application/json" \\
  -d '{"firstName":"Ada","lastName":"Lovelace","email":"ada@example.com"}' \\
  http://localhost:3000/api/v1/contacts`}
            </pre>
          </div>
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Method</th>
                <th className={th}>Path</th>
                <th className={th}>Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ENDPOINTS.map(([method, path, description]) => (
                <tr key={path}>
                  <td className={`${td} font-mono text-xs`}>{method}</td>
                  <td className={`${td} font-mono text-xs`}>{path}</td>
                  <td className={td}>{description}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
