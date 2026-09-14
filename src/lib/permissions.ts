import type { Role } from "@/lib/constants";

type Actor = { id: string; role: Role };

/**
 * Record visibility: admins and managers see everything, reps see only records they own.
 * Spread into any Prisma `where` for Company, Contact, Deal or Activity.
 */
export function ownerScope(user: Actor): { ownerId?: string } {
  return user.role === "REP" ? { ownerId: user.id } : {};
}

export const can = {
  manageUsers: (u: Actor) => u.role === "ADMIN",
  manageWebhooks: (u: Actor) => u.role === "ADMIN",
  manageAutomations: (u: Actor) => u.role !== "REP",
  importData: (u: Actor) => u.role !== "REP",
  exportData: (u: Actor) => u.role !== "REP",
  deleteRecords: (u: Actor) => u.role !== "REP",
  reassignOwner: (u: Actor) => u.role !== "REP",
};
