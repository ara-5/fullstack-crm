import type { Metadata } from "next";
import { ContactsTable } from "@/components/contacts-table";
import { SavedViews } from "@/components/saved-views";
import { Button, ButtonLink, Card, EmptyState, Input, PageHeader, Pagination, Select, buttonClass } from "@/components/ui";
import { CONTACT_STATUSES, titleCase } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { listContacts, userOptions } from "@/lib/crm";
import { listSavedViews } from "@/lib/saved-views";
import { requireUser } from "@/lib/session";
import { first } from "@/lib/utils";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = first(sp.q);
  const status = first(sp.status);
  const page = Number(first(sp.page)) || 1;
  const [{ items, total, pageSize }, views, owners] = await Promise.all([
    listContacts(user, { q, status, page }),
    listSavedViews(user.id, "contacts"),
    can.reassignOwner(user) ? userOptions() : Promise.resolve(undefined),
  ]);

  return (
    <>
      <PageHeader
        title="Contacts"
        description={`${total} contact${total === 1 ? "" : "s"}`}
        actions={
          <>
            {can.exportData(user) && (
              // eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from a route handler
              <a className={buttonClass("secondary")} href="/api/export/contacts">
                Export CSV
              </a>
            )}
            <ButtonLink href="/contacts/new">New contact</ButtonLink>
          </>
        }
      />
      <Card padded={false}>
        <SavedViews entity="contacts" basePath="/contacts" current={{ q, status }} views={views} />
        <form className="flex flex-wrap gap-2 border-b border-slate-100 p-3" role="search">
          <Input name="q" defaultValue={q} placeholder="Search name, email or company" aria-label="Search contacts" className="sm:max-w-xs" />
          <Select name="status" defaultValue={status ?? ""} aria-label="Status" className="w-auto">
            <option value="">All statuses</option>
            {CONTACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </form>
        {items.length === 0 ? (
          <div className="p-4">
            <EmptyState>No contacts match these filters.</EmptyState>
          </div>
        ) : (
          <ContactsTable items={items} canDelete={can.deleteRecords(user)} owners={owners} />
        )}
        <Pagination page={page} pageSize={pageSize} total={total} basePath="/contacts" params={{ q, status }} />
      </Card>
    </>
  );
}
