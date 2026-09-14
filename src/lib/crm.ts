import "server-only";
import type { Prisma } from "@prisma/client";
import { recordAudit } from "@/lib/audit";
import { emitEvent } from "@/lib/automation";
import { CLOSED_STAGES, OPEN_STAGES, stageInfo, type Role } from "@/lib/constants";
import { DEFAULT_IGNORED, diffRecords } from "@/lib/diff";
import { CrmError, forbidden } from "@/lib/errors";
import { can, ownerScope } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { addDays, formatCurrency, fullName } from "@/lib/utils";
import {
  activityInput,
  activityPatch,
  companyInput,
  companyPatch,
  contactInput,
  contactPatch,
  dealInput,
  dealPatch,
} from "@/lib/validation";

/**
 * Service layer. Server Actions, the REST API and CSV import all go through
 * these functions, so validation, record-level permissions, the audit log and
 * domain events (automations + webhooks) behave identically everywhere.
 */

export type Actor = { id: string; role: Role };
export type Option = { id: string; label: string };
type EmitOptions = { emit?: boolean };

const ownerSelect = { select: { id: true, name: true } } as const;

export const activityInclude = {
  contact: { select: { id: true, firstName: true, lastName: true } },
  deal: { select: { id: true, title: true } },
  company: { select: { id: true, name: true } },
  owner: { select: { name: true } },
} satisfies Prisma.ActivityInclude;

// ---------------------------------------------------------------- helpers

/** Case-insensitive "contains" filter (Postgres ILIKE). */
const ci = (value: string) => ({ contains: value, mode: "insensitive" as const });

function paginate(opts: { page?: number; pageSize?: number }) {
  const pageSize = Math.min(Math.max(Math.floor(opts.pageSize ?? 25), 1), 100);
  const page = Math.max(Math.floor(opts.page ?? 1), 1);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

async function assertActiveUser(id: string) {
  const user = await prisma.user.findFirst({ where: { id, active: true }, select: { id: true } });
  if (!user) throw new CrmError(422, "Assigned owner not found");
}

async function ownerForCreate(actor: Actor, requested: string | null | undefined) {
  if (!requested || !can.reassignOwner(actor)) return actor.id;
  await assertActiveUser(requested);
  return requested;
}

async function ownerForUpdate(actor: Actor, requested: string | null | undefined) {
  if (requested === undefined || !can.reassignOwner(actor)) return {};
  if (requested) await assertActiveUser(requested);
  return { ownerId: requested };
}

/** Users may only link records they are allowed to see. */
async function assertLinks(
  actor: Actor,
  links: { companyId?: string | null; contactId?: string | null; dealId?: string | null },
) {
  const scope = ownerScope(actor);
  const select = { id: true } as const;
  const [company, contact, deal] = await Promise.all([
    links.companyId ? prisma.company.findFirst({ where: { id: links.companyId, ...scope }, select }) : true,
    links.contactId ? prisma.contact.findFirst({ where: { id: links.contactId, ...scope }, select }) : true,
    links.dealId ? prisma.deal.findFirst({ where: { id: links.dealId, ...scope }, select }) : true,
  ]);
  if (!company) throw new CrmError(422, "Linked company not found");
  if (!contact) throw new CrmError(422, "Linked contact not found");
  if (!deal) throw new CrmError(422, "Linked deal not found");
}

function normalizeTags(tags: string | undefined) {
  if (tags === undefined) return undefined;
  const unique = new Set(tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean));
  return [...unique].join(",");
}

function assertCanDelete(actor: Actor) {
  if (!can.deleteRecords(actor)) throw forbidden("Only managers and admins can delete records.");
}

// ---------------------------------------------------------------- options for selects

export async function companyOptions(actor: Actor): Promise<Option[]> {
  const rows = await prisma.company.findMany({
    where: ownerScope(actor),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 1000,
  });
  return rows.map((c) => ({ id: c.id, label: c.name }));
}

export async function contactOptions(actor: Actor): Promise<Option[]> {
  const rows = await prisma.contact.findMany({
    where: ownerScope(actor),
    select: { id: true, firstName: true, lastName: true, company: { select: { name: true } } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 1000,
  });
  return rows.map((c) => ({ id: c.id, label: c.company ? `${fullName(c)} (${c.company.name})` : fullName(c) }));
}

export async function dealOptions(actor: Actor): Promise<Option[]> {
  const rows = await prisma.deal.findMany({
    where: { ...ownerScope(actor), stage: { in: OPEN_STAGES } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
    take: 1000,
  });
  return rows.map((d) => ({ id: d.id, label: d.title }));
}

export async function userOptions(): Promise<Option[]> {
  const rows = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows.map((u) => ({ id: u.id, label: u.name }));
}

// ---------------------------------------------------------------- global search

export type SearchResult = { group: "Contacts" | "Companies" | "Deals"; id: string; title: string; subtitle: string; href: string };

export async function searchRecords(actor: Actor, q: string): Promise<SearchResult[]> {
  const scope = ownerScope(actor);
  const [first, ...rest] = q.split(/\s+/);
  const [contacts, companies, deals] = await Promise.all([
    prisma.contact.findMany({
      where: {
        ...scope,
        OR: [
          { firstName: ci(q) },
          { lastName: ci(q) },
          { email: ci(q) },
          ...(rest.length ? [{ AND: [{ firstName: ci(first) }, { lastName: ci(rest.join(" ")) }] }] : []),
        ],
      },
      take: 5,
      select: { id: true, firstName: true, lastName: true, email: true, company: { select: { name: true } } },
    }),
    prisma.company.findMany({
      where: { ...scope, OR: [{ name: ci(q) }, { domain: ci(q) }] },
      take: 5,
      select: { id: true, name: true, domain: true, industry: true },
    }),
    prisma.deal.findMany({
      where: { ...scope, title: ci(q) },
      take: 5,
      select: { id: true, title: true, stage: true, value: true, currency: true },
    }),
  ]);

  return [
    ...contacts.map((c) => ({
      group: "Contacts" as const,
      id: c.id,
      title: fullName(c),
      subtitle: c.company?.name ?? c.email ?? "",
      href: `/contacts/${c.id}`,
    })),
    ...companies.map((c) => ({
      group: "Companies" as const,
      id: c.id,
      title: c.name,
      subtitle: c.domain ?? c.industry ?? "",
      href: `/companies/${c.id}`,
    })),
    ...deals.map((d) => ({
      group: "Deals" as const,
      id: d.id,
      title: d.title,
      subtitle: `${stageInfo(d.stage).label} · ${formatCurrency(d.value, d.currency)}`,
      href: `/deals/${d.id}`,
    })),
  ];
}

// ---------------------------------------------------------------- contacts

export async function listContacts(
  actor: Actor,
  opts: { q?: string; status?: string; companyId?: string; page?: number; pageSize?: number } = {},
) {
  const where: Prisma.ContactWhereInput = { ...ownerScope(actor) };
  if (opts.status) where.status = opts.status;
  if (opts.companyId) where.companyId = opts.companyId;
  if (opts.q) {
    const terms = opts.q.trim().split(/\s+/);
    where.OR = [
      { firstName: ci(opts.q) },
      { lastName: ci(opts.q) },
      { email: ci(opts.q) },
      { company: { name: ci(opts.q) } },
      ...(terms.length > 1 ? [{ AND: [{ firstName: ci(terms[0]) }, { lastName: ci(terms.slice(1).join(" ")) }] }] : []),
    ];
  }
  const { page, pageSize, skip, take } = paginate(opts);
  const [items, total] = await prisma.$transaction([
    prisma.contact.findMany({
      where,
      include: { company: { select: { id: true, name: true } }, owner: ownerSelect },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.contact.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getContact(actor: Actor, id: string) {
  const scope = ownerScope(actor);
  const contact = await prisma.contact.findFirst({
    where: { id, ...scope },
    include: {
      company: { select: { id: true, name: true } },
      owner: ownerSelect,
      deals: {
        where: scope,
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, value: true, currency: true, stage: true },
      },
      activities: { where: scope, orderBy: { createdAt: "desc" }, include: activityInclude },
    },
  });
  if (!contact) return null;
  const emails = await prisma.emailLog.findMany({
    where: { contactId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return { ...contact, emails };
}

export async function createContact(actor: Actor, input: unknown, opts: EmitOptions = {}) {
  const data = contactInput.parse(input);
  await assertLinks(actor, { companyId: data.companyId });
  const contact = await prisma.contact.create({
    data: {
      ...data,
      lastName: data.lastName ?? "",
      status: data.status ?? "LEAD",
      tags: normalizeTags(data.tags) ?? "",
      ownerId: await ownerForCreate(actor, data.ownerId),
    },
  });
  await recordAudit({ actorId: actor.id, entityType: "contact", entityId: contact.id, action: "created", summary: fullName(contact) });
  if (opts.emit !== false) await emitEvent("contact.created", { actorId: actor.id, contact });
  return contact;
}

export async function updateContact(actor: Actor, id: string, input: unknown) {
  const { ownerId, tags, ...rest } = contactPatch.parse(input);
  const existing = await prisma.contact.findFirst({ where: { id, ...ownerScope(actor) } });
  if (!existing) throw new CrmError(404, "Contact not found");
  await assertLinks(actor, { companyId: rest.companyId });

  const contact = await prisma.contact.update({
    where: { id },
    data: { ...rest, tags: normalizeTags(tags), ...(await ownerForUpdate(actor, ownerId)) },
  });
  await recordAudit({ actorId: actor.id, entityType: "contact", entityId: id, action: "updated", changes: diffRecords(existing, contact) });
  await emitEvent("contact.updated", { actorId: actor.id, contact });
  return contact;
}

export async function deleteContact(actor: Actor, id: string) {
  assertCanDelete(actor);
  const existing = await prisma.contact.findFirst({
    where: { id, ...ownerScope(actor) },
    select: { firstName: true, lastName: true },
  });
  if (!existing) throw new CrmError(404, "Contact not found");
  await prisma.contact.delete({ where: { id } });
  await recordAudit({ actorId: actor.id, entityType: "contact", entityId: id, action: "deleted", summary: fullName(existing) });
}

// ---------------------------------------------------------------- companies

export async function listCompanies(actor: Actor, opts: { q?: string; page?: number; pageSize?: number } = {}) {
  const where: Prisma.CompanyWhereInput = { ...ownerScope(actor) };
  if (opts.q) {
    where.OR = [{ name: ci(opts.q) }, { domain: ci(opts.q) }, { industry: ci(opts.q) }];
  }
  const { page, pageSize, skip, take } = paginate(opts);
  const [items, total] = await prisma.$transaction([
    prisma.company.findMany({
      where,
      include: { owner: ownerSelect, _count: { select: { contacts: true, deals: true } } },
      orderBy: { name: "asc" },
      skip,
      take,
    }),
    prisma.company.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getCompany(actor: Actor, id: string) {
  const scope = ownerScope(actor);
  return prisma.company.findFirst({
    where: { id, ...scope },
    include: {
      owner: ownerSelect,
      contacts: {
        where: scope,
        orderBy: { firstName: "asc" },
        select: { id: true, firstName: true, lastName: true, email: true, title: true, status: true },
      },
      deals: {
        where: scope,
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, value: true, currency: true, stage: true },
      },
      activities: { where: scope, orderBy: { createdAt: "desc" }, include: activityInclude },
    },
  });
}

export async function createCompany(actor: Actor, input: unknown) {
  const data = companyInput.parse(input);
  const company = await prisma.company.create({ data: { ...data, ownerId: await ownerForCreate(actor, data.ownerId) } });
  await recordAudit({ actorId: actor.id, entityType: "company", entityId: company.id, action: "created", summary: company.name });
  return company;
}

export async function updateCompany(actor: Actor, id: string, input: unknown) {
  const { ownerId, ...rest } = companyPatch.parse(input);
  const existing = await prisma.company.findFirst({ where: { id, ...ownerScope(actor) } });
  if (!existing) throw new CrmError(404, "Company not found");
  const company = await prisma.company.update({
    where: { id },
    data: { ...rest, ...(await ownerForUpdate(actor, ownerId)) },
  });
  await recordAudit({ actorId: actor.id, entityType: "company", entityId: id, action: "updated", changes: diffRecords(existing, company) });
  return company;
}

export async function deleteCompany(actor: Actor, id: string) {
  assertCanDelete(actor);
  const existing = await prisma.company.findFirst({ where: { id, ...ownerScope(actor) }, select: { name: true } });
  if (!existing) throw new CrmError(404, "Company not found");
  await prisma.company.delete({ where: { id } });
  await recordAudit({ actorId: actor.id, entityType: "company", entityId: id, action: "deleted", summary: existing.name });
}

// ---------------------------------------------------------------- deals

export async function listDeals(
  actor: Actor,
  opts: { q?: string; stage?: string; recentClosedDays?: number } = {},
) {
  const where: Prisma.DealWhereInput = { ...ownerScope(actor) };
  if (opts.stage) where.stage = opts.stage;
  if (opts.q) where.title = ci(opts.q);
  if (opts.recentClosedDays) {
    where.OR = [
      { stage: { in: OPEN_STAGES } },
      { closedAt: { gte: addDays(new Date(), -opts.recentClosedDays) } },
    ];
  }
  return prisma.deal.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 500,
    omit: { aiInsights: true },
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      owner: ownerSelect,
    },
  });
}

export async function getDeal(actor: Actor, id: string) {
  const scope = ownerScope(actor);
  return prisma.deal.findFirst({
    where: { id, ...scope },
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true, title: true } },
      owner: ownerSelect,
      activities: { where: scope, orderBy: { createdAt: "desc" }, include: activityInclude },
    },
  });
}

export async function createDeal(actor: Actor, input: unknown, opts: EmitOptions = {}) {
  const data = dealInput.parse(input);
  await assertLinks(actor, { companyId: data.companyId, contactId: data.contactId });

  let companyId = data.companyId;
  if (!companyId && data.contactId) {
    companyId = (await prisma.contact.findUnique({ where: { id: data.contactId }, select: { companyId: true } }))
      ?.companyId;
  }

  const stage = data.stage ?? "LEAD";
  const deal = await prisma.deal.create({
    data: {
      ...data,
      companyId,
      stage,
      value: data.value ?? 0,
      currency: data.currency ?? "USD",
      probability: stageInfo(stage).probability,
      closedAt: CLOSED_STAGES.includes(stage) ? new Date() : null,
      ownerId: await ownerForCreate(actor, data.ownerId),
    },
  });
  await recordAudit({
    actorId: actor.id,
    entityType: "deal",
    entityId: deal.id,
    action: "created",
    summary: `${deal.title} (${formatCurrency(deal.value, deal.currency)})`,
  });
  if (opts.emit !== false) await emitEvent("deal.created", { actorId: actor.id, deal });
  return deal;
}

export async function updateDeal(actor: Actor, id: string, input: unknown) {
  const { ownerId, stage, ...rest } = dealPatch.parse(input);
  const existing = await prisma.deal.findFirst({ where: { id, ...ownerScope(actor) } });
  if (!existing) throw new CrmError(404, "Deal not found");
  await assertLinks(actor, { companyId: rest.companyId, contactId: rest.contactId });

  const patch: Prisma.DealUncheckedUpdateInput = { ...rest, ...(await ownerForUpdate(actor, ownerId)) };
  const newStage = stage !== undefined && stage !== existing.stage ? stage : null;
  if (newStage) {
    patch.stage = newStage;
    patch.probability = stageInfo(newStage).probability;
    patch.closedAt = CLOSED_STAGES.includes(newStage) ? new Date() : null;
  }

  const deal = await prisma.deal.update({ where: { id }, data: patch });

  // Stage moves get their own, clearer audit entry.
  await recordAudit({
    actorId: actor.id,
    entityType: "deal",
    entityId: id,
    action: "updated",
    changes: diffRecords(existing, deal, [...DEFAULT_IGNORED, "stage", "probability", "closedAt"]),
  });
  if (newStage) {
    await recordAudit({
      actorId: actor.id,
      entityType: "deal",
      entityId: id,
      action: "stage_changed",
      summary: `${stageInfo(existing.stage).label} → ${stageInfo(newStage).label}`,
      changes: { stage: { from: existing.stage, to: newStage } },
    });
    await emitEvent("deal.stage_changed", {
      actorId: actor.id,
      deal,
      fromStage: existing.stage,
      toStage: newStage,
    });
  }
  return deal;
}

export async function deleteDeal(actor: Actor, id: string) {
  assertCanDelete(actor);
  const existing = await prisma.deal.findFirst({ where: { id, ...ownerScope(actor) }, select: { title: true } });
  if (!existing) throw new CrmError(404, "Deal not found");
  await prisma.deal.delete({ where: { id } });
  await recordAudit({ actorId: actor.id, entityType: "deal", entityId: id, action: "deleted", summary: existing.title });
}

// ---------------------------------------------------------------- activities

export const ACTIVITY_VIEWS = ["open", "overdue", "today", "upcoming", "done"] as const;
export type ActivityView = (typeof ACTIVITY_VIEWS)[number];

export async function listActivities(
  actor: Actor,
  opts: { view?: ActivityView; mine?: boolean; take?: number } = {},
) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = addDays(startOfToday, 1);

  const where: Prisma.ActivityWhereInput = { ...ownerScope(actor), type: { not: "NOTE" } };
  if (opts.mine) where.ownerId = actor.id;

  let orderBy: Prisma.ActivityOrderByWithRelationInput[] = [
    { dueAt: { sort: "asc", nulls: "last" } },
    { createdAt: "desc" },
  ];
  switch (opts.view ?? "open") {
    case "open":
      where.completedAt = null;
      break;
    case "overdue":
      where.completedAt = null;
      where.dueAt = { lt: now };
      break;
    case "today":
      where.completedAt = null;
      where.dueAt = { gte: startOfToday, lt: startOfTomorrow };
      break;
    case "upcoming":
      where.completedAt = null;
      where.dueAt = { gte: startOfTomorrow };
      break;
    case "done":
      where.completedAt = { not: null };
      orderBy = [{ completedAt: "desc" }];
      break;
  }

  return prisma.activity.findMany({ where, orderBy, take: opts.take ?? 200, include: activityInclude });
}

export async function createActivity(actor: Actor, input: unknown) {
  const data = activityInput.parse(input);
  await assertLinks(actor, { contactId: data.contactId, companyId: data.companyId, dealId: data.dealId });

  // Fill in related records from the deal/contact so the activity shows on every timeline.
  let { contactId, companyId } = data;
  if (data.dealId && (!contactId || !companyId)) {
    const deal = await prisma.deal.findUnique({
      where: { id: data.dealId },
      select: { contactId: true, companyId: true },
    });
    contactId ??= deal?.contactId;
    companyId ??= deal?.companyId;
  }
  if (contactId && !companyId) {
    companyId = (await prisma.contact.findUnique({ where: { id: contactId }, select: { companyId: true } }))
      ?.companyId;
  }

  return prisma.activity.create({
    data: {
      ...data,
      contactId,
      companyId,
      priority: data.priority ?? "MEDIUM",
      completedAt: data.type === "NOTE" ? new Date() : null,
      ownerId: await ownerForCreate(actor, data.ownerId),
    },
  });
}

export async function updateActivity(actor: Actor, id: string, input: unknown) {
  const { completed, ownerId, ...rest } = activityPatch.parse(input);
  const existing = await prisma.activity.findFirst({ where: { id, ...ownerScope(actor) } });
  if (!existing) throw new CrmError(404, "Activity not found");
  await assertLinks(actor, { contactId: rest.contactId, companyId: rest.companyId, dealId: rest.dealId });

  const patch: Prisma.ActivityUncheckedUpdateInput = { ...rest, ...(await ownerForUpdate(actor, ownerId)) };
  const completing = completed === true && !existing.completedAt;
  if (completed !== undefined) patch.completedAt = completed ? (existing.completedAt ?? new Date()) : null;

  const activity = await prisma.activity.update({ where: { id }, data: patch });
  if (completing) await emitEvent("activity.completed", { actorId: actor.id, activity });
  return activity;
}

export function setActivityCompleted(actor: Actor, id: string, completed: boolean) {
  return updateActivity(actor, id, { completed });
}

export async function deleteActivity(actor: Actor, id: string) {
  const { count } = await prisma.activity.deleteMany({ where: { id, ...ownerScope(actor) } });
  if (count === 0) throw new CrmError(404, "Activity not found");
}
