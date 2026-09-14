import { z } from "zod";
import { ACTIVITY_TYPES, CONTACT_STATUSES, CRM_EVENTS, DEAL_STAGE_IDS } from "@/lib/constants";
import {
  activityInput,
  activityPatch,
  companyInput,
  companyPatch,
  contactInput,
  contactPatch,
  dealInput,
  dealPatch,
} from "@/lib/validation";

// OpenAPI 3.1 description of the REST API. Request bodies are generated from the
// same Zod schemas the API validates with, so the docs can't drift from the code.

type JsonSchema = Record<string, unknown>;

function fromZod(schema: z.ZodType): JsonSchema {
  const json = { ...(z.toJSONSchema(schema, { io: "output", unrepresentable: "any" }) as JsonSchema) };
  delete json.$schema;
  return json;
}

const errorRef = { $ref: "#/components/schemas/Error" };
const record = { type: "object", additionalProperties: true };

const jsonContent = (schema: JsonSchema) => ({ "application/json": { schema } });
const response = (description: string, schema: JsonSchema = errorRef) => ({ description, content: jsonContent(schema) });
const commonErrors = {
  "401": response("Missing or invalid API key"),
  "429": response("Rate limit exceeded (see the Retry-After header)"),
};

const query = (name: string, schema: JsonSchema, description?: string) => ({ name, in: "query", schema, description });
const pagination = [
  query("page", { type: "integer", minimum: 1, default: 1 }),
  query("pageSize", { type: "integer", minimum: 1, maximum: 100, default: 25 }),
];

function resource(opts: {
  path: string;
  tag: string;
  singular: string;
  create: z.ZodType;
  patch: z.ZodType;
  listParams: JsonSchema[];
  paginated: boolean;
  readable?: boolean;
}) {
  const listSchema = {
    type: "object",
    properties: {
      items: { type: "array", items: record },
      total: { type: "integer" },
      ...(opts.paginated && { page: { type: "integer" }, pageSize: { type: "integer" } }),
    },
  };
  const tags = [opts.tag];
  return {
    [opts.path]: {
      get: {
        tags,
        summary: `List ${opts.tag.toLowerCase()}`,
        parameters: opts.listParams,
        responses: { "200": response("OK", listSchema), ...commonErrors },
      },
      post: {
        tags,
        summary: `Create a ${opts.singular}`,
        requestBody: { required: true, content: jsonContent(fromZod(opts.create)) },
        responses: {
          "201": response("Created", record),
          "400": response("Body is not valid JSON"),
          "422": response("Validation failed"),
          ...commonErrors,
        },
      },
    },
    [`${opts.path}/{id}`]: {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      ...(opts.readable !== false && {
        get: {
          tags,
          summary: `Get a ${opts.singular}`,
          responses: { "200": response("OK", record), "404": response("Not found"), ...commonErrors },
        },
      }),
      patch: {
        tags,
        summary: `Update a ${opts.singular}`,
        description: "Only the fields you send are changed. Send null to clear an optional field.",
        requestBody: { required: true, content: jsonContent(fromZod(opts.patch)) },
        responses: {
          "200": response("Updated", record),
          "404": response("Not found"),
          "422": response("Validation failed"),
          ...commonErrors,
        },
      },
      delete: {
        tags,
        summary: `Delete a ${opts.singular}`,
        responses: {
          "204": { description: "Deleted" },
          "403": response("Your role can't delete records"),
          "404": response("Not found"),
          ...commonErrors,
        },
      },
    },
  };
}

export function buildOpenApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "CRM REST API",
      version: "1.0.0",
      description:
        "Authenticate with an API key created under **Settings → Your API keys**. Keys act with their owner's " +
        "permissions: reps only see and change records they own. Limit: 300 requests per minute.",
      license: { name: "AGPL-3.0-or-later", identifier: "AGPL-3.0-or-later" },
    },
    servers: [{ url: "/" }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Contacts" },
      { name: "Companies" },
      { name: "Deals", description: "Changing `stage` triggers automations and the `deal.stage_changed` webhook." },
      { name: "Activities", description: "Tasks, calls, meetings, emails and notes." },
    ],
    paths: {
      ...resource({
        path: "/api/v1/contacts",
        tag: "Contacts",
        singular: "contact",
        create: contactInput,
        patch: contactPatch,
        paginated: true,
        listParams: [
          query("q", { type: "string" }, "Case-insensitive search on name, email and company"),
          query("status", { type: "string", enum: [...CONTACT_STATUSES] }),
          query("companyId", { type: "string" }),
          ...pagination,
        ],
      }),
      ...resource({
        path: "/api/v1/companies",
        tag: "Companies",
        singular: "company",
        create: companyInput,
        patch: companyPatch,
        paginated: true,
        listParams: [query("q", { type: "string" }, "Case-insensitive search on name, domain and industry"), ...pagination],
      }),
      ...resource({
        path: "/api/v1/deals",
        tag: "Deals",
        singular: "deal",
        create: dealInput,
        patch: dealPatch,
        paginated: false,
        listParams: [query("q", { type: "string" }, "Search deal titles"), query("stage", { type: "string", enum: [...DEAL_STAGE_IDS] })],
      }),
      ...resource({
        path: "/api/v1/activities",
        tag: "Activities",
        singular: "activity",
        create: activityInput,
        patch: activityPatch,
        paginated: false,
        readable: false,
        listParams: [
          query("view", { type: "string", enum: ["open", "overdue", "today", "upcoming", "done"], default: "open" }),
          query("mine", { type: "boolean" }, "Only activities assigned to the key owner"),
        ],
      }),
    },
    webhooks: {
      crmEvent: {
        post: {
          summary: "CRM event",
          description:
            `Sent for the events you subscribe to: ${CRM_EVENTS.join(", ")}. Verify the \`X-CRM-Signature\` header: ` +
            '`"sha256=" + HMAC_SHA256(secret, rawBody)`. Failed deliveries are retried up to 3 times with the same `id`.',
          requestBody: {
            content: jsonContent({
              type: "object",
              properties: {
                id: { type: "string", description: "Delivery id, stable across retries" },
                event: { type: "string", enum: [...CRM_EVENTS] },
                data: record,
                sentAt: { type: "string", format: "date-time" },
              },
            }),
          },
          responses: { "2XX": { description: "Acknowledge receipt" } },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "API key (crm_…)" },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: { error: { type: "string" }, details: { description: "Validation issues, when applicable" } },
        },
        ActivityType: { type: "string", enum: [...ACTIVITY_TYPES] },
      },
    },
  };
}
