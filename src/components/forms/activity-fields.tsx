import { Field } from "@/components/action-form";
import { Input, Select, Textarea } from "@/components/ui";
import { ACTIVITY_TYPES, PRIORITIES, titleCase } from "@/lib/constants";
import type { Option } from "@/lib/crm";
import { cx } from "@/lib/utils";

export function ActivityFields({
  defaultType = "TASK",
  links,
  contacts,
  deals,
  owners,
  compact = false,
}: {
  defaultType?: string;
  links?: { contactId?: string | null; companyId?: string | null; dealId?: string | null };
  contacts?: Option[];
  deals?: Option[];
  owners?: Option[];
  compact?: boolean;
}) {
  return (
    <div className={cx("grid gap-3", !compact && "sm:grid-cols-2")}>
      {links?.contactId && <input type="hidden" name="contactId" value={links.contactId} />}
      {links?.companyId && <input type="hidden" name="companyId" value={links.companyId} />}
      {links?.dealId && <input type="hidden" name="dealId" value={links.dealId} />}

      <Field label="Type" name="type">
        <Select name="type" defaultValue={defaultType}>
          {ACTIVITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {titleCase(t)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Priority" name="priority">
        <Select name="priority" defaultValue="MEDIUM">
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {titleCase(p)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Subject" name="subject" className={compact ? undefined : "sm:col-span-2"}>
        <Input name="subject" required placeholder="e.g. Call about the renewal" />
      </Field>
      <Field label="Due" name="dueAt" hint="Leave empty for notes">
        <Input type="datetime-local" name="dueAt" />
      </Field>
      {owners && owners.length > 0 && (
        <Field label="Assign to" name="ownerId">
          <Select name="ownerId" defaultValue="">
            <option value="">Me</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {contacts && (
        <Field label="Contact" name="contactId">
          <Select name="contactId" defaultValue="">
            <option value="">None</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {deals && (
        <Field label="Deal" name="dealId">
          <Select name="dealId" defaultValue="">
            <option value="">None</option>
            {deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Details" name="body" className={compact ? undefined : "sm:col-span-2"}>
        <Textarea name="body" rows={3} />
      </Field>
    </div>
  );
}
