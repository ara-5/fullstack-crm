import { z } from "zod";
import {
  ACTIVITY_TYPES,
  AUTOMATION_ACTIONS,
  CONTACT_STATUSES,
  CRM_EVENTS,
  DEAL_STAGE_IDS,
  PRIORITIES,
  ROLES,
  type AutomationAction,
} from "@/lib/constants";

// Form fields arrive as "" when empty. Map "" to null (clear the value) while
// leaving undefined alone, so PATCH requests only touch the fields they send.
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const text = (max = 200) => z.preprocess(emptyToNull, z.string().trim().max(max).nullish());
const ref = () => z.preprocess(emptyToNull, z.string().max(64).nullish());
const date = () => z.preprocess(emptyToNull, z.coerce.date().nullish());
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(emptyToNull, z.enum(values).nullish());

// No .default() here on purpose: defaults would also apply inside .partial()
// and silently overwrite fields on update. Services apply create defaults.

export const contactInput = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().max(100).optional(),
  email: z.preprocess(emptyToNull, z.email("Enter a valid email").nullish()),
  phone: text(50),
  title: text(100),
  status: z.enum(CONTACT_STATUSES).optional(),
  source: text(100),
  tags: z.string().trim().max(500).optional(),
  companyId: ref(),
  ownerId: ref(),
});
export const contactPatch = contactInput.partial();

export const companyInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  domain: text(200),
  industry: text(100),
  size: text(50),
  phone: text(50),
  address: text(500),
  ownerId: ref(),
});
export const companyPatch = companyInput.partial();

export const dealInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  value: z.coerce.number().min(0, "Value can't be negative").max(1e12).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  stage: z.enum(DEAL_STAGE_IDS).optional(),
  expectedClose: date(),
  companyId: ref(),
  contactId: ref(),
  ownerId: ref(),
});
export const dealPatch = dealInput.partial();

export const activityInput = z.object({
  type: z.enum(ACTIVITY_TYPES),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  body: text(5000),
  priority: z.enum(PRIORITIES).optional(),
  dueAt: date(),
  contactId: ref(),
  companyId: ref(),
  dealId: ref(),
  ownerId: ref(),
});
export const activityPatch = activityInput.partial().extend({ completed: z.boolean().optional() });

export const userInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.email("Enter a valid email").transform((e) => e.toLowerCase()),
  role: z.enum(ROLES),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const passwordChange = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(200),
});

const actionIds = AUTOMATION_ACTIONS.map((a) => a.id) as [AutomationAction, ...AutomationAction[]];

export const ruleInput = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    trigger: z.enum(CRM_EVENTS),
    action: z.enum(actionIds),
    toStage: optionalEnum(DEAL_STAGE_IDS),
    fromStage: optionalEnum(DEAL_STAGE_IDS),
    minValue: z.preprocess(emptyToNull, z.coerce.number().min(0).nullish()),
    contactStatus: optionalEnum(CONTACT_STATUSES),
    subject: text(200),
    body: text(5000),
    dueInDays: z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(365).nullish()),
    priority: optionalEnum(PRIORITIES),
    status: optionalEnum(CONTACT_STATUSES),
    emailTo: optionalEnum(["contact", "owner"] as const),
  })
  .superRefine((v, ctx) => {
    if (v.action === "SEND_EMAIL" && !v.subject) {
      ctx.addIssue({ code: "custom", path: ["subject"], message: "An email needs a subject" });
    }
    if (v.action === "UPDATE_CONTACT_STATUS" && !v.status) {
      ctx.addIssue({ code: "custom", path: ["status"], message: "Choose a status" });
    }
  });

export const webhookInput = z.object({
  url: z.url("Enter a valid URL").refine((u) => /^https?:\/\//i.test(u), "URL must start with http:// or https://"),
  events: z.array(z.enum([...CRM_EVENTS, "*"])).min(1, "Pick at least one event"),
});

export function formToObject(formData: FormData) {
  const obj: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION") || typeof value !== "string") continue;
    obj[key] = value;
  }
  return obj;
}
