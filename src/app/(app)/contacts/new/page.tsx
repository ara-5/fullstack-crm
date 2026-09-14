import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ContactFields } from "@/components/forms/contact-fields";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { companyOptions, userOptions } from "@/lib/crm";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { first } from "@/lib/utils";
import { createContactAction } from "../actions";

export const metadata: Metadata = { title: "New contact" };

export default async function NewContactPage({ searchParams }: PageProps<"/contacts/new">) {
  const user = await requireUser();
  const companyId = first((await searchParams).companyId);
  const [companies, owners] = await Promise.all([
    companyOptions(user),
    can.reassignOwner(user) ? userOptions() : undefined,
  ]);

  return (
    <>
      <PageHeader title="New contact" />
      <Card className="max-w-3xl">
        <ActionForm action={createContactAction}>
          <ContactFields companies={companies} owners={owners} defaults={{ companyId, ownerId: user.id }} />
          <div className="mt-6 flex justify-end gap-2">
            <ButtonLink href="/contacts" variant="secondary">
              Cancel
            </ButtonLink>
            <SubmitButton>Create contact</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
