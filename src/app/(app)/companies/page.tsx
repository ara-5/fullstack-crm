import type { Metadata } from "next";
import Link from "next/link";
import { Button, ButtonLink, Card, EmptyState, Input, PageHeader, Pagination, Table, buttonClass, td, th } from "@/components/ui";
import { listCompanies } from "@/lib/crm";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { first } from "@/lib/utils";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = first(sp.q);
  const page = Number(first(sp.page)) || 1;
  const { items, total, pageSize } = await listCompanies(user, { q, page });

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
        <form className="flex flex-wrap gap-2 border-b border-slate-100 p-3" role="search">
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
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Industry</th>
                <th className={th}>Size</th>
                <th className={`${th} text-right`}>Contacts</th>
                <th className={`${th} text-right`}>Deals</th>
                <th className={th}>Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className={td}>
                    <Link href={`/companies/${c.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                      {c.name}
                    </Link>
                    {c.domain && <div className="text-xs text-slate-500">{c.domain}</div>}
                  </td>
                  <td className={td}>{c.industry ?? "—"}</td>
                  <td className={td}>{c.size ?? "—"}</td>
                  <td className={`${td} text-right tabular-nums`}>{c._count.contacts}</td>
                  <td className={`${td} text-right tabular-nums`}>{c._count.deals}</td>
                  <td className={td}>{c.owner?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} basePath="/companies" params={{ q }} />
      </Card>
    </>
  );
}
