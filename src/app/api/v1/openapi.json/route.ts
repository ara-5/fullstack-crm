import { buildOpenApiSpec } from "@/lib/openapi";

// Public: the API description itself contains no data.
export function GET() {
  return Response.json(buildOpenApiSpec(), { headers: { "Cache-Control": "public, max-age=300" } });
}
