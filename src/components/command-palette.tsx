"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { Role } from "@/lib/constants";
import type { SearchResult } from "@/lib/crm";
import { navFor } from "@/lib/nav";
import { cx } from "@/lib/utils";

type Item = { id: string; group: string; title: string; subtitle?: string; href: string };

/** Global ⌘K / Ctrl+K palette: search records and jump to pages or create actions. */
export function CommandPalette({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<{ query: string; items: SearchResult[] }>({ query: "", items: [] });
  const trimmed = query.trim();

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open || trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (res.ok) setResults({ query: trimmed, items: (await res.json()).results });
      } catch {
        // aborted by a newer keystroke, or offline
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, trimmed]);

  const items = useMemo<Item[]>(() => {
    const q = trimmed.toLowerCase();
    const actions: Item[] = [
      ...navFor(role).map((n) => ({ id: `nav:${n.href}`, group: "Go to", title: n.label, href: n.href })),
      { id: "new:contact", group: "Create", title: "New contact", href: "/contacts/new" },
      { id: "new:company", group: "Create", title: "New company", href: "/companies/new" },
      { id: "new:deal", group: "Create", title: "New deal", href: "/deals/new" },
      { id: "new:task", group: "Create", title: "New task", href: "/tasks" },
    ].filter((a) => !q || a.title.toLowerCase().includes(q));
    const records =
      trimmed.length >= 2 && results.query === trimmed
        ? results.items.map((r) => ({ id: `${r.group}:${r.id}`, group: r.group, title: r.title, subtitle: r.subtitle, href: r.href }))
        : [];
    return [...records, ...actions];
  }, [trimmed, results, role]);

  const groups = useMemo(() => {
    const map = new Map<string, { item: Item; index: number }[]>();
    items.forEach((item, index) => map.set(item.group, [...(map.get(item.group) ?? []), { item, index }]));
    return [...map.entries()];
  }, [items]);

  const activeIndex = Math.min(active, Math.max(items.length - 1, 0));

  function close() {
    setOpen(false);
    setQuery("");
    setActive(0);
  }

  function go(item: Item | undefined) {
    if (!item) return;
    close();
    router.push(item.href);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((activeIndex + 1) % Math.max(items.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((activeIndex - 1 + items.length) % Math.max(items.length, 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(items[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh]" onMouseDown={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onInputKeyDown}
          placeholder="Search contacts, companies, deals… or jump to a page"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-results"
          aria-activedescendant={items.length ? `command-option-${activeIndex}` : undefined}
          aria-label="Search"
          className="w-full border-b border-slate-200 bg-transparent px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-500"
        />
        <div id="command-results" role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              {trimmed.length >= 2 && results.query !== trimmed ? "Searching…" : "No matches"}
            </p>
          ) : (
            groups.map(([group, entries]) => (
              <div key={group} role="group" aria-label={group}>
                <div role="presentation" className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {group}
                </div>
                {entries.map(({ item, index }) => (
                  <div
                    key={item.id}
                    id={`command-option-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseMove={() => setActive(index)}
                    onClick={() => go(item)}
                    className={cx(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm",
                      index === activeIndex ? "bg-indigo-600 text-white" : "text-slate-700",
                    )}
                  >
                    <span className="truncate font-medium">{item.title}</span>
                    {item.subtitle && (
                      <span className={cx("truncate text-xs", index === activeIndex ? "text-indigo-100" : "text-slate-500")}>
                        {item.subtitle}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
        <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">↑↓ navigate · Enter open · Esc close</p>
      </div>
    </div>
  );
}
