import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { DealFields } from "@/components/forms/deal-fields";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { companyOptions, contactOptions, userOptions } from "@/lib/crm";
import { env } from "@/lib/env";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { first } from "@/lib/utils";
import { createDealAction } from "../actions";

export const metadata: Metadata = { title: "New deal" };

export default async function NewDealPage({ searchParams }: PageProps<"/deals/new">) {
  const user = await requireUser();
  const sp = await searchParams;
  const [companies, contacts, owners] = await Promise.all([
    companyOptions(user),
    contactOptions(user),
    can.reassignOwner(user) ? userOptions() : undefined,
  ]);

  return (
    <>
      <PageHeader title="New deal" description="If you pick only a contact, the deal is linked to their company." />
      <Card className="max-w-3xl">
        <ActionForm action={createDealAction}>
          <DealFields
            defaultCurrency={env.CURRENCY}
            companies={companies}
            contacts={contacts}
            owners={owners}
            defaults={{ companyId: first(sp.companyId), contactId: first(sp.contactId), ownerId: user.id }}
          />
          <div className="mt-6 flex justify-end gap-2">
            <ButtonLink href="/deals" variant="secondary">
              Cancel
            </ButtonLink>
            <SubmitButton>Create deal</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
