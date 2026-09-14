import type { Company } from "@prisma/client";
import { Field } from "@/components/action-form";
import { Input, Select } from "@/components/ui";
import type { Option } from "@/lib/crm";
import { cx } from "@/lib/utils";

const SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

export function CompanyFields({
  company,
  owners,
  ownerDefault,
  compact = false,
}: {
  company?: Company;
  owners?: Option[];
  ownerDefault?: string;
  compact?: boolean;
}) {
  return (
    <div className={cx("grid gap-4", !compact && "sm:grid-cols-2")}>
      <Field label="Name" name="name" className={compact ? undefined : "sm:col-span-2"}>
        <Input name="name" defaultValue={company?.name} required />
      </Field>
      <Field label="Domain" name="domain">
        <Input name="domain" defaultValue={company?.domain ?? ""} placeholder="example.com" />
      </Field>
      <Field label="Industry" name="industry">
        <Input name="industry" defaultValue={company?.industry ?? ""} />
      </Field>
      <Field label="Size" name="size">
        <Select name="size" defaultValue={company?.size ?? ""}>
          <option value="">Unknown</option>
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {s} employees
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Phone" name="phone">
        <Input type="tel" name="phone" defaultValue={company?.phone ?? ""} />
      </Field>
      <Field label="Address" name="address" className={compact ? undefined : "sm:col-span-2"}>
        <Input name="address" defaultValue={company?.address ?? ""} />
      </Field>
      {owners && (
        <Field label="Owner" name="ownerId">
          <Select name="ownerId" defaultValue={company?.ownerId ?? ownerDefault ?? ""}>
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
