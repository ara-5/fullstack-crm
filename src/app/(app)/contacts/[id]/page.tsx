import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ActivityList } from "@/components/activity-list";
import { ConfirmButton } from "@/components/confirm-button";
import { DealList } from "@/components/deal-list";
import { ActivityFields } from "@/components/forms/activity-fields";
import { ContactFields } from "@/components/forms/contact-fields";
import { Badge, ButtonLink, Card, PageHeader, StatusBadge } from "@/components/ui";
import { AuditHistory } from "@/components/audit-history";
import { PresenceBar } from "@/components/presence-bar";
import { listAuditEntries } from "@/lib/audit";
import { companyOptions, getContact, userOptions } from "@/lib/crm";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { formatDateTime, fullName } from "@/lib/utils";
import { createActivityAction } from "../../tasks/actions";
import { deleteContactAction, updateContactAction } from "../actions";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const contact = await getContact(user, id);
  if (!contact) notFound();

  const [companies, owners, history] = await Promise.all([
    companyOptions(user),
    can.reassignOwner(user) ? userOptions() : undefined,
    listAuditEntries("contact", contact.id),
  ]);
  const subtitle = [contact.title, contact.company?.name].filter(Boolean).join(" at ");

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {fullName(contact)} <StatusBadge value={contact.status} />
          </span>
        }
        description={subtitle || contact.email}
        actions={
          <>
            <ButtonLink href={`/deals/new?contactId=${contact.id}`} variant="secondary">
              New deal
            </ButtonLink>
            {can.deleteRecords(user) && (
              <form action={deleteContactAction.bind(null, contact.id)}>
                <ConfirmButton message="Delete this contact and its activities?">Delete</ConfirmButton>
              </form>
            )}
          </>
        }
      />
      <PresenceBar entityType="contact" entityId={contact.id} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Log activity">
            <ActionForm action={createActivityAction} resetOnSuccess>
              <ActivityFields defaultType="NOTE" links={{ contactId: contact.id, companyId: contact.companyId }} />
              <div className="mt-3 flex justify-end">
                <SubmitButton>Save activity</SubmitButton>
              </div>
            </ActionForm>
          </Card>
          <Card title="Timeline">
            <ActivityList activities={contact.activities} emptyText="No activity logged yet." />
          </Card>
          {contact.emails.length > 0 && (
            <Card title="Emails sent">
              <ul className="divide-y divide-slate-100">
                {contact.emails.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{e.subject}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                      <Badge tone={e.status === "FAILED" ? "red" : e.status === "SENT" ? "green" : "slate"}>
                        {e.status.toLowerCase()}
                      </Badge>
                      {formatDateTime(e.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title="Details">
            <ActionForm action={updateContactAction.bind(null, contact.id)}>
              <ContactFields contact={contact} companies={companies} owners={owners} compact />
              <div className="mt-4 flex justify-end">
                <SubmitButton>Save changes</SubmitButton>
              </div>
            </ActionForm>
          </Card>
          <Card title="Deals">
            <DealList deals={contact.deals} />
          </Card>
          <Card title="History">
            <AuditHistory entries={history} labels={{ title: "job title" }} />
          </Card>
        </div>
      </div>
    </>
  );
}
