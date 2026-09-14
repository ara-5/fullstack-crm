// Pure CSV helpers shared by import and export (unit tested).

// Map common spreadsheet headers ("First Name", "E-mail", "Company Name"…) to our fields.
const HEADER_ALIASES: Record<string, string> = {
  firstname: "firstName",
  first: "firstName",
  givenname: "firstName",
  lastname: "lastName",
  last: "lastName",
  surname: "lastName",
  fullname: "name",
  email: "email",
  emailaddress: "email",
  phone: "phone",
  phonenumber: "phone",
  mobile: "phone",
  title: "title",
  jobtitle: "title",
  status: "status",
  source: "source",
  leadsource: "source",
  tags: "tags",
  company: "company",
  companyname: "company",
  organization: "company",
  website: "domain",
  companysize: "size",
};

export function normalizeHeader(header: string) {
  const key = header.toLowerCase().replace(/[^a-z]/g, "");
  return HEADER_ALIASES[key] ?? key;
}

export function splitFullName(name: string) {
  const [firstName = "", ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
}

/** Prevent spreadsheet formula injection when a CSV is opened in Excel/Sheets. */
export function safeCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}
