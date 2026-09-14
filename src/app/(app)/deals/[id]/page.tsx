import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ActivityList } from "@/components/activity-list";
import { ConfirmButton } from "@/components/confirm-button";
import { ActivityFields } from "@/components/forms/activity-fields";
import { DealFields } from "@/components/forms/deal-fields";
import { Card, PageHeader } from "@/components/ui";
import { DEAL_STAGES } from "@/lib/constants";
import { companyOptions, contactOptions, getDeal, userOptions } from "@/lib/crm";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { cx, formatCurrency, formatDate, fullName } from "@/lib/utils";
import { createActivityAction } from "../../tasks/actions";
import { deleteDealAction, setDealStageAction, updateDealAction } from "../actions";

export const metadata: Metadata = { title: "Deal" };

export default async function DealPage({ params }: PageProps<"/deals/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const deal = await getDeal(user, id);
  if (!deal) notFound();

  const [companies, contacts, owners] = await Promise.all([
    companyOptions(user),
    contactOptions(user),
    can.reassignOwner(user) ? userOptions() : undefined,
  ]);

  return (
    <>
      <PageHeader
        title={deal.title}
        description={
          <>
            <span className="font-medium tabular-nums text-slate-700">{formatCurrency(deal.value, deal.currency)}</span>
            {" · "}
            {deal.probability}% probability
            {deal.company && (
              <>
                {" · "}
                <Link href={`/companies/${deal.company.id}`} className="hover:text-indigo-600">
                  {deal.company.name}
                </Link>
              </>
            )}
            {deal.contact && (
              <>
                {" · "}
                <Link href={`/contacts/${deal.contact.id}`} className="hover:text-indigo-600">
                  {fullName(deal.contact)}
                </Link>
              </>
            )}
            {deal.closedAt && ` · closed ${formatDate(deal.closedAt)}`}
          </>
        }
        actions={
          can.deleteRecords(user) && (
            <form action={deleteDealAction.bind(null, deal.id)}>
              <ConfirmButton message="Delete this deal?">Delete</ConfirmButton>
            </form>
          )
        }
      />

      <nav aria-label="Deal stage" className="mb-6 flex flex-wrap gap-1.5">
        {DEAL_STAGES.map((s) => (
          <form key={s.id} action={setDealStageAction.bind(null, deal.id, s.id)}>
            <button
              type="submit"
              aria-current={deal.stage === s.id ? "step" : undefined}
              className={cx(
                "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition",
                deal.stage === s.id
                  ? "bg-indigo-600 text-white ring-indigo-600"
                  : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50",
              )}
            >
              {s.label}
            </button>
          </form>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Log activity">
            <ActionForm action={createActivityAction} resetOnSuccess>
              <ActivityFields
                defaultType="NOTE"
                links={{ dealId: deal.id, contactId: deal.contactId, companyId: deal.companyId }}
              />
              <div className="mt-3 flex justify-end">
                <SubmitButton>Save activity</SubmitButton>
              </div>
            </ActionForm>
          </Card>
          <Card title="Timeline">
            <ActivityList activities={deal.activities} emptyText="No activity logged yet." />
          </Card>
        </div>
        <Card title="Details" className="self-start">
          <ActionForm action={updateDealAction.bind(null, deal.id)}>
            <DealFields deal={deal} companies={companies} contacts={contacts} owners={owners} compact />
            <div className="mt-4 flex justify-end">
              <SubmitButton>Save changes</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
