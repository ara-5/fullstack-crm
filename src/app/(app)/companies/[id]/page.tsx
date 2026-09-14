import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ActivityList } from "@/components/activity-list";
import { ConfirmButton } from "@/components/confirm-button";
import { DealList } from "@/components/deal-list";
import { ActivityFields } from "@/components/forms/activity-fields";
import { CompanyFields } from "@/components/forms/company-fields";
import { ButtonLink, Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { AuditHistory } from "@/components/audit-history";
import { listAuditEntries } from "@/lib/audit";
import { getCompany, userOptions } from "@/lib/crm";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { formatCurrency, fullName } from "@/lib/utils";
import { createActivityAction } from "../../tasks/actions";
import { deleteCompanyAction, updateCompanyAction } from "../actions";

export const metadata: Metadata = { title: "Company" };

export default async function CompanyPage({ params }: PageProps<"/companies/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const company = await getCompany(user, id);
  if (!company) notFound();

  const [owners, history] = await Promise.all([
    can.reassignOwner(user) ? userOptions() : undefined,
    listAuditEntries("company", company.id),
  ]);
  const wonValue = company.deals.filter((d) => d.stage === "WON").reduce((sum, d) => sum + d.value, 0);

  return (
    <>
      <PageHeader
        title={company.name}
        description={[company.industry, company.domain, wonValue > 0 && `${formatCurrency(wonValue)} won`]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <ButtonLink href={`/contacts/new?companyId=${company.id}`} variant="secondary">
              Add contact
            </ButtonLink>
            <ButtonLink href={`/deals/new?companyId=${company.id}`} variant="secondary">
              New deal
            </ButtonLink>
            {can.deleteRecords(user) && (
              <form action={deleteCompanyAction.bind(null, company.id)}>
                <ConfirmButton message="Delete this company? Contacts and deals are kept but unlinked.">
                  Delete
                </ConfirmButton>
              </form>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Log activity">
            <ActionForm action={createActivityAction} resetOnSuccess>
              <ActivityFields defaultType="NOTE" links={{ companyId: company.id }} />
              <div className="mt-3 flex justify-end">
                <SubmitButton>Save activity</SubmitButton>
              </div>
            </ActionForm>
          </Card>
          <Card title="Timeline">
            <ActivityList activities={company.activities} emptyText="No activity logged yet." />
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Details">
            <ActionForm action={updateCompanyAction.bind(null, company.id)}>
              <CompanyFields company={company} owners={owners} compact />
              <div className="mt-4 flex justify-end">
                <SubmitButton>Save changes</SubmitButton>
              </div>
            </ActionForm>
          </Card>
          <Card title={`Contacts (${company.contacts.length})`}>
            {company.contacts.length === 0 ? (
              <EmptyState>No contacts yet.</EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100">
                {company.contacts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <Link href={`/contacts/${c.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-indigo-600">
                        {fullName(c)}
                      </Link>
                      <p className="truncate text-xs text-slate-500">{c.title ?? c.email}</p>
                    </div>
                    <StatusBadge value={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Deals">
            <DealList deals={company.deals} />
          </Card>
          <Card title="History">
            <AuditHistory entries={history} />
          </Card>
        </div>
      </div>
    </>
  );
}
