import type { Metadata } from "next";
import { CompaniesTable } from "@/components/companies-table";
import { SavedViews } from "@/components/saved-views";
import { Button, ButtonLink, Card, EmptyState, Input, PageHeader, Pagination, buttonClass } from "@/components/ui";
import { listCompanies, userOptions } from "@/lib/crm";
import { can } from "@/lib/permissions";
import { listSavedViews } from "@/lib/saved-views";
import { requireUser } from "@/lib/session";
import { first } from "@/lib/utils";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = first(sp.q);
  const page = Number(first(sp.page)) || 1;
  const [{ items, total, pageSize }, views, owners] = await Promise.all([
    listCompanies(user, { q, page }),
    listSavedViews(user.id, "companies"),
    can.reassignOwner(user) ? userOptions() : Promise.resolve(undefined),
  ]);

  return (
    <>
      <PageHeader
        title="Companies"
        description={`${total} compan${total === 1 ? "y" : "ies"}`}
        actions={
          <>
            {can.exportData(user) && (
              // eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from a route handler
              <a className={buttonClass("secondary")} href="/api/export/companies">
                Export CSV
              </a>
            )}
            <ButtonLink href="/companies/new">New company</ButtonLink>
          </>
        }
      />
      <Card padded={false}>
        <SavedViews entity="companies" basePath="/companies" current={{ q }} views={views} />
        {/* Keyed so a same-route navigation (saved view, pagination, back/forward) remounts this
            uncontrolled input — React only applies defaultValue on mount, so without this it'd
            keep showing whatever was typed before the URL's query params changed. */}
        <form key={q ?? ""} className="flex flex-wrap gap-2 border-b border-slate-100 p-3" role="search">
          <Input name="q" defaultValue={q} placeholder="Search name, domain or industry" aria-label="Search companies" className="sm:max-w-xs" />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        {items.length === 0 ? (
          <div className="p-4">
            <EmptyState>No companies found.</EmptyState>
          </div>
        ) : (
          <CompaniesTable items={items} canDelete={can.deleteRecords(user)} owners={owners} />
        )}
        <Pagination page={page} pageSize={pageSize} total={total} basePath="/companies" params={{ q }} />
      </Card>
    </>
  );
}
