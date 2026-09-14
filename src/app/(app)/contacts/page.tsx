import type { Metadata } from "next";
import Link from "next/link";
import { Button, ButtonLink, Card, EmptyState, Input, PageHeader, Pagination, Select, StatusBadge, Table, buttonClass, td, th } from "@/components/ui";
import { CONTACT_STATUSES, titleCase } from "@/lib/constants";
import { listContacts } from "@/lib/crm";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { first, formatDate, fullName } from "@/lib/utils";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = first(sp.q);
  const status = first(sp.status);
  const page = Number(first(sp.page)) || 1;
  const { items, total, pageSize } = await listContacts(user, { q, status, page });

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
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Company</th>
                <th className={th}>Email</th>
                <th className={th}>Status</th>
                <th className={th}>Owner</th>
                <th className={th}>Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className={td}>
                    <Link href={`/contacts/${c.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                      {fullName(c)}
                    </Link>
                    {c.title && <div className="text-xs text-slate-500">{c.title}</div>}
                  </td>
                  <td className={td}>
                    {c.company ? (
                      <Link href={`/companies/${c.company.id}`} className="hover:text-indigo-600">
                        {c.company.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={td}>{c.email ?? "—"}</td>
                  <td className={td}>
                    <StatusBadge value={c.status} />
                  </td>
                  <td className={td}>{c.owner?.name ?? "—"}</td>
                  <td className={td}>{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} basePath="/contacts" params={{ q, status }} />
      </Card>
    </>
  );
}
