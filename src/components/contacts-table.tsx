"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bulkDeleteContactsAction, bulkReassignContactsAction, bulkTagContactsAction } from "@/app/(app)/contacts/actions";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { Button, Select, StatusBadge, Table, td, th } from "@/components/ui";
import type { Option } from "@/lib/crm";
import { formatDate, fullName } from "@/lib/utils";

type ContactRow = {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  status: string;
  createdAt: Date | string;
  company: { id: string; name: string } | null;
  owner: { name: string } | null;
};

export function ContactsTable({
  items,
  canDelete,
  owners,
}: {
  items: ContactRow[];
  canDelete: boolean;
  owners?: Option[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tag, setTag] = useState("");
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
              <input type="checkbox" aria-label="Select all contacts" checked={allSelected} onChange={toggleAll} className="rounded border-slate-300" />
            </th>
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
            <tr key={c.id} className={selected.has(c.id) ? "bg-indigo-50/50" : "hover:bg-slate-50"}>
              <td className={td}>
                <input
                  type="checkbox"
                  aria-label={`Select ${fullName(c)}`}
                  checked={selected.has(c.id)}
                  onChange={() => toggleOne(c.id)}
                  className="rounded border-slate-300"
                />
              </td>
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

      <BulkActionBar count={selected.size} onClear={clear} pending={pending}>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Add tag…"
            className="w-28 rounded-md border-0 bg-slate-100 px-2 py-1 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <Button
            variant="secondary"
            disabled={pending || !tag.trim()}
            onClick={() => runBulk("tag", () => bulkTagContactsAction([...selected], tag))}
          >
            Tag
          </Button>
        </div>
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
              onClick={() => runBulk("reassign", () => bulkReassignContactsAction([...selected], ownerId))}
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
              if (window.confirm(`Delete ${selected.size} contact(s)? This can't be undone.`)) {
                runBulk("delete", () => bulkDeleteContactsAction([...selected]));
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
