"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bulkDeleteCompaniesAction, bulkReassignCompaniesAction } from "@/app/(app)/companies/actions";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { Button, Select, Table, td, th } from "@/components/ui";
import type { Option } from "@/lib/crm";

type CompanyRow = {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  owner: { name: string } | null;
  _count: { contacts: number; deals: number };
};

export function CompaniesTable({
  items,
  canDelete,
  owners,
}: {
  items: CompanyRow[];
  canDelete: boolean;
  owners?: Option[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ownerId, setOwnerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const allSelected = items.length > 0 && selected.size === items.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clear() {
    setSelected(new Set());
    setError(null);
  }

  function runBulk(label: string, fn: () => Promise<{ ok?: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) return setError(result.error ?? `Couldn't ${label}.`);
      clear();
      router.refresh();
    });
  }

  return (
    <>
      <Table>
        <thead className="bg-slate-50">
          <tr>
            <th className={`${th} w-8`}>
              <input type="checkbox" aria-label="Select all companies" checked={allSelected} onChange={toggleAll} className="rounded border-slate-300" />
            </th>
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
            <tr key={c.id} className={selected.has(c.id) ? "bg-indigo-50/50" : "hover:bg-slate-50"}>
              <td className={td}>
                <input
                  type="checkbox"
                  aria-label={`Select ${c.name}`}
                  checked={selected.has(c.id)}
                  onChange={() => toggleOne(c.id)}
                  className="rounded border-slate-300"
                />
              </td>
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

      <BulkActionBar count={selected.size} onClear={clear} pending={pending}>
        {owners && (
          <div className="flex items-center gap-1.5">
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-40" aria-label="Reassign to">
              <option value="">Reassign to…</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              disabled={pending || !ownerId}
              onClick={() => runBulk("reassign", () => bulkReassignCompaniesAction([...selected], ownerId))}
            >
              Reassign
            </Button>
          </div>
        )}
        {canDelete && (
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Delete ${selected.size} compan${selected.size === 1 ? "y" : "ies"}? This can't be undone.`)) {
                runBulk("delete", () => bulkDeleteCompaniesAction([...selected]));
              }
            }}
          >
            Delete
          </Button>
        )}
      </BulkActionBar>
      {error && (
        <p role="alert" className="px-4 pb-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </>
  );
}
