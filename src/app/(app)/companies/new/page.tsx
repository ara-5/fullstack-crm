import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CompanyFields } from "@/components/forms/company-fields";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { userOptions } from "@/lib/crm";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { createCompanyAction } from "../actions";

export const metadata: Metadata = { title: "New company" };

export default async function NewCompanyPage() {
  const user = await requireUser();
  const owners = can.reassignOwner(user) ? await userOptions() : undefined;

  return (
    <>
      <PageHeader title="New company" />
      <Card className="max-w-3xl">
        <ActionForm action={createCompanyAction}>
          <CompanyFields owners={owners} ownerDefault={user.id} />
          <div className="mt-6 flex justify-end gap-2">
            <ButtonLink href="/companies" variant="secondary">
              Cancel
            </ButtonLink>
            <SubmitButton>Create company</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
