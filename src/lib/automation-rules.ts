import type { Activity, Contact, Deal } from "@prisma/client";

// Pure rule-matching logic, kept free of I/O so it can be unit tested.

export type EventPayload = {
  actorId: string;
  contact?: Contact | null;
  deal?: Deal | null;
  activity?: Activity | null;
  fromStage?: string;
  toStage?: string;
};

export type Conditions = {
  toStage?: string;
  fromStage?: string;
  minValue?: number;
  contactStatus?: string;
};

export function matches(c: Conditions, p: EventPayload) {
  if (c.toStage && c.toStage !== p.toStage) return false;
  if (c.fromStage && c.fromStage !== p.fromStage) return false;
  if (c.minValue != null && (p.deal?.value ?? 0) < Number(c.minValue)) return false;
  if (c.contactStatus && p.contact?.status !== c.contactStatus) return false;
  return true;
}

/** Replaces {{contact.firstName}}, {{deal.title}}, etc. with payload values. */
export function interpolate(template: string, p: EventPayload) {
  return template.replace(/\{\{\s*(contact|deal|activity)\.(\w+)\s*\}\}/g, (_, obj: string, field: string) => {
    const source = p[obj as "contact" | "deal" | "activity"] as Record<string, unknown> | null | undefined;
    const value = source?.[field];
    return value == null ? "" : String(value);
  });
}
