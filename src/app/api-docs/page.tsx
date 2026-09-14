import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = { title: "API reference" };

// Interactive API reference rendered by Scalar from /api/v1/openapi.json.
export default function ApiDocsPage() {
  return (
    <>
      <script id="api-reference" data-url="/api/v1/openapi.json" />
      <Script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1" strategy="afterInteractive" />
    </>
  );
}
