import "server-only";
import crypto from "node:crypto";
import type { Actor, SearchResult } from "@/lib/crm";
import { env, features } from "@/lib/env";
import { enqueueJob, registerJobHandler } from "@/lib/jobs";
import { ownerScope } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * Semantic search over contacts, companies and deals, via pgvector. Anthropic
 * doesn't offer an embeddings endpoint, so this uses Voyage AI (Anthropic's
 * recommended embedding partner) — hidden entirely without VOYAGE_API_KEY,
 * same pattern as the AI assistant being hidden without ANTHROPIC_API_KEY.
 *
 * Embeddings are computed asynchronously (see the "embed_record" job in
 * src/lib/jobs.ts), triggered from src/lib/crm.ts on create/update, so this
 * never adds embedding latency to a page load or a save.
 */

export type EmbeddableEntity = "contact" | "company" | "deal";
const EMBEDDING_MODEL = "voyage-3.5";
const EMBEDDING_DIMENSIONS = 1024;

async function embedTexts(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
  if (!env.VOYAGE_API_KEY) throw new Error("VOYAGE_API_KEY is not set");
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.VOYAGE_API_KEY}` },
    body: JSON.stringify({ input: texts, model: EMBEDDING_MODEL, input_type: inputType }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Voyage embeddings request failed: HTTP ${res.status}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

// pgvector's text input format for a vector literal, e.g. "[0.1,0.2,0.3]".
function toVectorLiteral(vector: number[]) {
  return `[${vector.join(",")}]`;
}

async function buildEmbeddingText(entityType: EmbeddableEntity, entityId: string): Promise<string | null> {
  if (entityType === "contact") {
    const c = await prisma.contact.findUnique({ where: { id: entityId }, include: { company: { select: { name: true } } } });
    if (!c) return null;
    return [`${c.firstName} ${c.lastName}`.trim(), c.title, c.email, c.company?.name, c.status, c.tags && `tags: ${c.tags.split(",").join(", ")}`]
      .filter(Boolean)
      .join(" — ");
  }
  if (entityType === "company") {
    const c = await prisma.company.findUnique({ where: { id: entityId } });
    if (!c) return null;
    return [c.name, c.industry, c.domain, c.size, c.address].filter(Boolean).join(" — ");
  }
  const d = await prisma.deal.findUnique({
    where: { id: entityId },
    include: { company: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } },
  });
  if (!d) return null;
  return [d.title, `stage: ${d.stage}`, `value: ${d.value} ${d.currency}`, d.company?.name, d.contact && `${d.contact.firstName} ${d.contact.lastName}`]
    .filter(Boolean)
    .join(" — ");
}

/** Queues (or refreshes) the embedding for a record. Fire-and-forget from the caller's perspective, but the enqueue itself is awaited so it's durable. */
export function enqueueEmbedding(entityType: EmbeddableEntity, entityId: string) {
  if (!features.semanticSearch) return Promise.resolve();
  return enqueueJob("embed_record", { entityType, entityId });
}

export async function deleteEmbedding(entityType: EmbeddableEntity, entityId: string) {
  await prisma.embedding.deleteMany({ where: { entityType, entityId } });
}

async function runEmbedRecordJob(rawPayload: unknown) {
  const { entityType, entityId } = rawPayload as { entityType: EmbeddableEntity; entityId: string };
  const content = await buildEmbeddingText(entityType, entityId);
  if (!content) {
    await deleteEmbedding(entityType, entityId); // deleted since the job was enqueued
    return;
  }
  const [vector] = await embedTexts([content], "document");
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Voyage returned a ${vector.length}-dimension vector, expected ${EMBEDDING_DIMENSIONS}`);
  }
  const literal = toVectorLiteral(vector);
  await prisma.$executeRaw`
    INSERT INTO "Embedding" ("id", "entityType", "entityId", "content", "vector", "updatedAt")
    VALUES (${crypto.randomUUID()}, ${entityType}, ${entityId}, ${content}, ${literal}::vector, NOW())
    ON CONFLICT ("entityType", "entityId")
    DO UPDATE SET "content" = EXCLUDED."content", "vector" = EXCLUDED."vector", "updatedAt" = NOW()`;
}

registerJobHandler("embed_record", runEmbedRecordJob);

type RawHit = { entityType: EmbeddableEntity; entityId: string; content: string; score: number };

/**
 * Top matches by cosine similarity, globally (not permission-scoped — see
 * semanticSearch for the scoped version consumers should actually use).
 */
async function nearestEmbeddings(queryText: string, limit: number): Promise<RawHit[]> {
  if (!features.semanticSearch) return [];
  const [vector] = await embedTexts([queryText], "query");
  const literal = toVectorLiteral(vector);
  return prisma.$queryRaw<RawHit[]>`
    SELECT "entityType", "entityId", "content", 1 - (vector <=> ${literal}::vector) AS score
    FROM "Embedding"
    ORDER BY vector <=> ${literal}::vector
    LIMIT ${limit}`;
}

/** Semantic search, scoped to what `actor` is allowed to see. */
export async function semanticSearch(actor: Actor, query: string, limit = 8): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed || !features.semanticSearch) return [];
  // Over-fetch: some hits will be filtered out by ownerScope below.
  const hits = await nearestEmbeddings(trimmed, limit * 3);
  if (hits.length === 0) return [];

  const scope = ownerScope(actor);
  const idsByType: Record<EmbeddableEntity, string[]> = { contact: [], company: [], deal: [] };
  for (const hit of hits) idsByType[hit.entityType].push(hit.entityId);

  const [contacts, companies, deals] = await Promise.all([
    idsByType.contact.length
      ? prisma.contact.findMany({
          where: { id: { in: idsByType.contact }, ...scope },
          select: { id: true, firstName: true, lastName: true, email: true, company: { select: { name: true } } },
        })
      : [],
    idsByType.company.length
      ? prisma.company.findMany({ where: { id: { in: idsByType.company }, ...scope }, select: { id: true, name: true, domain: true, industry: true } })
      : [],
    idsByType.deal.length
      ? prisma.deal.findMany({
          where: { id: { in: idsByType.deal }, ...scope },
          select: { id: true, title: true, stage: true, value: true, currency: true },
        })
      : [],
  ]);
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const dealById = new Map(deals.map((d) => [d.id, d]));

  const results: SearchResult[] = [];
  for (const hit of hits) {
    if (hit.entityType === "contact") {
      const c = contactById.get(hit.entityId);
      if (c) results.push({ group: "Contacts", id: c.id, title: `${c.firstName} ${c.lastName}`.trim(), subtitle: c.company?.name ?? c.email ?? "", href: `/contacts/${c.id}` });
    } else if (hit.entityType === "company") {
      const c = companyById.get(hit.entityId);
      if (c) results.push({ group: "Companies", id: c.id, title: c.name, subtitle: c.domain ?? c.industry ?? "", href: `/companies/${c.id}` });
    } else {
      const d = dealById.get(hit.entityId);
      if (d) results.push({ group: "Deals", id: d.id, title: d.title, subtitle: d.stage, href: `/deals/${d.id}` });
    }
    if (results.length >= limit) break;
  }
  return results;
}
