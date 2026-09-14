import type { Role } from "@/lib/constants";

export const NAV_ITEMS: { href: string; label: string; roles?: Role[] }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/contacts", label: "Contacts" },
  { href: "/companies", label: "Companies" },
  { href: "/deals", label: "Deals" },
  { href: "/tasks", label: "Tasks" },
  { href: "/reports", label: "Reports" },
  { href: "/automations", label: "Automations", roles: ["ADMIN", "MANAGER"] },
  { href: "/data", label: "Import / Export", roles: ["ADMIN", "MANAGER"] },
  { href: "/settings", label: "Settings" },
];

export function navFor(role: Role) {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
