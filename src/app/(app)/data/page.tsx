import type { Metadata } from "next";
import { ActionForm, Field, SubmitButton } from "@/components/action-form";
import { Card, Input, PageHeader, Select, buttonClass } from "@/components/ui";
import { EXPORTABLE_ENTITIES, titleCase } from "@/lib/constants";
import { requireRole } from "@/lib/session";
import { importCsvAction } from "./actions";

export const metadata: Metadata = { title: "Import / Export" };

export default async function DataPage() {
  await requireRole("ADMIN", "MANAGER");

  return (
    <>
      <PageHeader title="Import / Export" description="Move data in and out of the CRM as CSV files." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Import from CSV" className="self-start">
          <ActionForm action={importCsvAction} resetOnSuccess className="space-y-4">
            <Field label="Import as" name="entity">
              <Select name="entity" defaultValue="contacts">
                <option value="contacts">Contacts</option>
                <option value="companies">Companies</option>
              </Select>
            </Field>
            <Field label="CSV file" name="file" hint="Max 2 MB / 5,000 rows. The first row must be headers.">
              <Input type="file" name="file" accept=".csv,text/csv" required className="file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-sm" />
            </Field>
            <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-medium text-slate-700">Recognized columns</p>
              <p className="mt-1">
                <strong>Contacts:</strong> First Name, Last Name (or Name), Email, Phone, Title, Status, Source, Tags,
                Company. Companies are matched by name and created if missing.
              </p>
              <p className="mt-1">
                <strong>Companies:</strong> Name, Domain / Website, Industry, Size, Phone, Address.
              </p>
            </div>
            <div className="flex justify-end">
              <SubmitButton pendingText="Importing…">Import</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card title="Export to CSV" className="self-start">
          <p className="mb-4 text-sm text-slate-600">
            Exports include every record you can access. Cells that would run as spreadsheet formulas are escaped.
          </p>
          <div className="flex flex-wrap gap-2">
            {EXPORTABLE_ENTITIES.map((entity) => (
              <a key={entity} href={`/api/export/${entity}`} className={buttonClass("secondary")}>
                Download {titleCase(entity)}
              </a>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
