"use client";

// Last-resort boundary for errors in the root layout. It replaces the whole
// document, so it renders its own <html> and uses inline styles.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>The CRM failed to load</h1>
            <p style={{ color: "#64748b", fontSize: 14 }}>
              Please try again.{error.digest ? ` Reference: ${error.digest}` : ""}
            </p>
            <button
              type="button"
              onClick={() => retry()}
              style={{ marginTop: 16, padding: "8px 14px", borderRadius: 6, border: 0, background: "#4f46e5", color: "#fff", fontSize: 14, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
