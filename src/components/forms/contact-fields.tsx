import type { Contact } from "@prisma/client";
import { Field } from "@/components/action-form";
import { Input, Select } from "@/components/ui";
import { CONTACT_STATUSES, titleCase } from "@/lib/constants";
import type { Option } from "@/lib/crm";
import { cx } from "@/lib/utils";

export function ContactFields({
  contact,
  companies,
  owners,
  defaults,
  compact = false,
}: {
  contact?: Contact;
  companies: Option[];
  owners?: Option[];
  defaults?: { companyId?: string; ownerId?: string };
  compact?: boolean;
}) {
  return (
    <div className={cx("grid gap-4", !compact && "sm:grid-cols-2")}>
      <Field label="First name" name="firstName">
        <Input name="firstName" defaultValue={contact?.firstName} required />
      </Field>
      <Field label="Last name" name="lastName">
        <Input name="lastName" defaultValue={contact?.lastName} />
      </Field>
      <Field label="Email" name="email">
        <Input type="email" name="email" defaultValue={contact?.email ?? ""} />
      </Field>
      <Field label="Phone" name="phone">
        <Input type="tel" name="phone" defaultValue={contact?.phone ?? ""} />
      </Field>
      <Field label="Job title" name="title">
        <Input name="title" defaultValue={contact?.title ?? ""} />
      </Field>
      <Field label="Company" name="companyId">
        <Select name="companyId" defaultValue={contact?.companyId ?? defaults?.companyId ?? ""}>
          <option value="">No company</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Status" name="status">
        <Select name="status" defaultValue={contact?.status ?? "LEAD"}>
          {CONTACT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {titleCase(s)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Source" name="source">
        <Input name="source" defaultValue={contact?.source ?? ""} placeholder="Website, Referral…" />
      </Field>
      <Field label="Tags" name="tags" hint="Comma-separated" className={compact ? undefined : "sm:col-span-2"}>
        <Input name="tags" defaultValue={contact?.tags ?? ""} placeholder="vip, newsletter" />
      </Field>
      {owners && (
        <Field label="Owner" name="ownerId">
          <Select name="ownerId" defaultValue={contact?.ownerId ?? defaults?.ownerId ?? ""}>
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
