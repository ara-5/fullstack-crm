import "server-only";
import { prisma } from "@/lib/prisma";

export const SAVED_VIEW_ENTITIES = ["contacts", "companies"] as const;
export type SavedViewEntity = (typeof SAVED_VIEW_ENTITIES)[number];

export function listSavedViews(userId: string, entity: SavedViewEntity) {
  return prisma.savedView.findMany({ where: { userId, entity }, orderBy: { createdAt: "asc" } });
}

export function createSavedView(userId: string, entity: SavedViewEntity, name: string, filters: Record<string, string>) {
  return prisma.savedView.create({ data: { userId, entity, name, filters } });
}

export async function deleteSavedView(userId: string, id: string) {
  await prisma.savedView.deleteMany({ where: { id, userId } });
}
