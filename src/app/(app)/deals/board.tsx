"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { DEAL_STAGES } from "@/lib/constants";
import { cx, formatCurrency, formatDate } from "@/lib/utils";
import { moveDealAction } from "./actions";

export type BoardDeal = {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: string;
  companyName: string | null;
  ownerName: string | null;
  expectedClose: string | null;
};

export function DealBoard({ deals }: { deals: BoardDeal[] }) {
  const [optimisticDeals, applyMove] = useOptimistic(
    deals,
    (state: BoardDeal[], move: { id: string; stage: string }) =>
      state.map((d) => (d.id === move.id ? { ...d, stage: move.stage } : d)),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Mouse drags after a small movement (so clicks still open the deal);
  // touch needs a short press so the board can still be scrolled.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const id = String(active.id);
    const stage = over ? String(over.id) : null;
    const deal = optimisticDeals.find((d) => d.id === id);
    if (!deal || !stage || deal.stage === stage) return;

    setError(null);
    startTransition(async () => {
      applyMove({ id, stage });
      const result = await moveDealAction(id, stage);
      if (result.error) setError(result.error);
    });
  }

  const activeDeal = optimisticDeals.find((d) => d.id === activeId);

  return (
    <>
      {error && (
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <DndContext
        id="deal-board"
        sensors={sensors}
        onDragStart={({ active }) => setActiveId(String(active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {DEAL_STAGES.map((stage) => (
            <StageColumn
              key={stage.id}
              id={stage.id}
              label={stage.label}
              deals={optimisticDeals.filter((d) => d.stage === stage.id)}
              activeId={activeId}
            />
          ))}
        </div>
        <DragOverlay>{activeDeal ? <DealCard deal={activeDeal} lifted /> : null}</DragOverlay>
      </DndContext>
    </>
  );
}

function StageColumn({
  id,
  label,
  deals,
  activeId,
}: {
  id: string;
  label: string;
  deals: BoardDeal[];
  activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const total = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <section
      ref={setNodeRef}
      aria-label={`${label} stage`}
      className={cx(
        "flex w-72 shrink-0 flex-col rounded-xl bg-slate-100 p-2 ring-2 ring-inset ring-transparent transition",
        isOver && "bg-indigo-50 ring-indigo-300",
      )}
    >
      <header className="flex items-baseline justify-between px-2 py-1.5">
        <h2 className="text-sm font-semibold text-slate-800">
          {label} <span className="font-normal text-slate-500">{deals.length}</span>
        </h2>
        <span className="text-xs tabular-nums text-slate-500">{formatCurrency(total, "USD", true)}</span>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2">
        {deals.map((deal) => (
          <DraggableDeal key={deal.id} deal={deal} dimmed={deal.id === activeId} />
        ))}
      </div>
    </section>
  );
}

function DraggableDeal({ deal, dimmed }: { deal: BoardDeal; dimmed: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: deal.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cx("rounded-lg", dimmed && "opacity-40")}>
      <DealCard deal={deal} />
    </div>
  );
}

function DealCard({ deal, lifted = false }: { deal: BoardDeal; lifted?: boolean }) {
  return (
    <article
      className={cx(
        "cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm",
        lifted && "cursor-grabbing shadow-lg ring-2 ring-indigo-400",
      )}
    >
      <Link href={`/deals/${deal.id}`} className="block text-sm font-medium text-slate-900 hover:text-indigo-600">
        {deal.title}
      </Link>
      {deal.companyName && <p className="mt-0.5 truncate text-xs text-slate-500">{deal.companyName}</p>}
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold tabular-nums text-slate-800">{formatCurrency(deal.value, deal.currency)}</span>
        <span className="truncate text-slate-500">
          {deal.expectedClose ? `Close ${formatDate(deal.expectedClose)}` : deal.ownerName}
        </span>
      </div>
    </article>
  );
}
