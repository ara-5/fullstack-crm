import type { Deal } from "@prisma/client";
import { Field } from "@/components/action-form";
import { Input, Select } from "@/components/ui";
import { DEAL_STAGES } from "@/lib/constants";
import type { Option } from "@/lib/crm";
import { cx, toDateInput } from "@/lib/utils";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "CAD", "AUD"];

export function DealFields({
  deal,
  companies,
  contacts,
  owners,
  defaults,
  defaultCurrency = "USD",
  compact = false,
}: {
  deal?: Deal;
  companies: Option[];
  contacts: Option[];
  owners?: Option[];
  defaults?: { companyId?: string; contactId?: string; ownerId?: string };
  defaultCurrency?: string;
  compact?: boolean;
}) {
  const currencies = CURRENCIES.includes(defaultCurrency) ? CURRENCIES : [defaultCurrency, ...CURRENCIES];
  return (
    <div className={cx("grid gap-4", !compact && "sm:grid-cols-2")}>
      <Field label="Title" name="title" className={compact ? undefined : "sm:col-span-2"}>
        <Input name="title" defaultValue={deal?.title} required placeholder="e.g. Acme — Annual license" />
      </Field>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <Field label="Value" name="value">
          <Input type="number" name="value" min={0} step="any" defaultValue={deal?.value ?? ""} />
        </Field>
        <Field label="Currency" name="currency">
          <Select name="currency" defaultValue={deal?.currency ?? defaultCurrency}>
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Stage" name="stage">
        <Select name="stage" defaultValue={deal?.stage ?? "LEAD"}>
          {DEAL_STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({s.probability}%)
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Expected close" name="expectedClose">
        <Input type="date" name="expectedClose" defaultValue={toDateInput(deal?.expectedClose)} />
      </Field>
      <Field label="Company" name="companyId">
        <Select name="companyId" defaultValue={deal?.companyId ?? defaults?.companyId ?? ""}>
          <option value="">None</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Contact" name="contactId">
        <Select name="contactId" defaultValue={deal?.contactId ?? defaults?.contactId ?? ""}>
          <option value="">None</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      {owners && (
        <Field label="Owner" name="ownerId">
          <Select name="ownerId" defaultValue={deal?.ownerId ?? defaults?.ownerId ?? ""}>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </div>
  );
}
