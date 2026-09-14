// Shared, client-safe constants. Keep this file free of server-only imports.

export const ROLES = ["ADMIN", "MANAGER", "REP"] as const;
export type Role = (typeof ROLES)[number];

// Public demo credentials (seeded data only; shown on the login page in demo mode).
export const DEMO_PASSWORD = "Password123!";
export const DEMO_ACCOUNTS: { name: string; email: string; role: Role }[] = [
  { name: "Ada Admin", email: "admin@crm.local", role: "ADMIN" },
  { name: "Max Manager", email: "manager@crm.local", role: "MANAGER" },
  { name: "Riley Rep", email: "rep@crm.local", role: "REP" },
  { name: "Sam Seller", email: "sam@crm.local", role: "REP" },
];

export const DEAL_STAGES = [
  { id: "LEAD", label: "Lead", probability: 10 },
  { id: "QUALIFIED", label: "Qualified", probability: 25 },
  { id: "PROPOSAL", label: "Proposal", probability: 50 },
  { id: "NEGOTIATION", label: "Negotiation", probability: 75 },
  { id: "WON", label: "Won", probability: 100 },
  { id: "LOST", label: "Lost", probability: 0 },
] as const;
export type DealStage = (typeof DEAL_STAGES)[number]["id"];
export const DEAL_STAGE_IDS = DEAL_STAGES.map((s) => s.id) as [DealStage, ...DealStage[]];
export const OPEN_STAGES: DealStage[] = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION"];
export const CLOSED_STAGES: DealStage[] = ["WON", "LOST"];

export function stageInfo(id: string) {
  return DEAL_STAGES.find((s) => s.id === id) ?? DEAL_STAGES[0];
}

export const CONTACT_STATUSES = ["LEAD", "PROSPECT", "CUSTOMER", "CHURNED"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const ACTIVITY_TYPES = ["TASK", "CALL", "MEETING", "EMAIL", "NOTE"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CRM_EVENTS = [
  "contact.created",
  "contact.updated",
  "deal.created",
  "deal.stage_changed",
  "activity.completed",
] as const;
export type CrmEvent = (typeof CRM_EVENTS)[number];

export const EVENT_LABELS: Record<CrmEvent, string> = {
  "contact.created": "a contact is created",
  "contact.updated": "a contact is updated",
  "deal.created": "a deal is created",
  "deal.stage_changed": "a deal changes stage",
  "activity.completed": "an activity is completed",
};

export const AUTOMATION_ACTIONS = [
  { id: "CREATE_TASK", label: "Create a task" },
  { id: "SEND_EMAIL", label: "Send an email" },
  { id: "UPDATE_CONTACT_STATUS", label: "Update contact status" },
] as const;
export type AutomationAction = (typeof AUTOMATION_ACTIONS)[number]["id"];

export const EXPORTABLE_ENTITIES = ["contacts", "companies", "deals"] as const;
export type ExportableEntity = (typeof EXPORTABLE_ENTITIES)[number];

export function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
}
