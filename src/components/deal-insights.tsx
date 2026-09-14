"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Card } from "@/components/ui";
import type { DealInsights } from "@/lib/ai";
import { formatDateTime } from "@/lib/utils";
import { generateInsightsAction } from "@/app/(app)/deals/actions";

const RISK_TONE = { low: "green", medium: "amber", high: "red" } as const;

export function DealInsightsCard({
  dealId,
  aiEnabled,
  insights,
  generatedAt,
}: {
  dealId: string;
  aiEnabled: boolean;
  insights: DealInsights | null;
  generatedAt: Date | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateInsightsAction(dealId);
      if (result.error) setError(result.error);
    });
  }

  async function copyEmail() {
    if (!insights) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${insights.emailDraft.subject}\n\n${insights.emailDraft.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (e.g. insecure context) — the text is still visible to copy manually
    }
  }

  if (!aiEnabled) return null;

  return (
    <Card
      title="AI assistant"
      actions={
        <Button variant="secondary" onClick={generate} disabled={pending}>
          {pending ? "Thinking…" : insights ? "Regenerate" : "Summarize deal"}
        </Button>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {!insights && !pending && (
        <p className="text-sm text-slate-500">Get an AI summary of this deal&apos;s timeline, a risk read, and a drafted follow-up email.</p>
      )}
      {insights && (
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Summary</span>
              <Badge tone={RISK_TONE[insights.riskLevel]}>{insights.riskLevel} risk</Badge>
            </div>
            <p className="text-sm text-slate-700">{insights.summary}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Next steps</p>
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
              {insights.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Follow-up email draft</p>
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={copyEmail}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="rounded-md border border-slate-200 bg-canvas p-3 text-sm">
              <p className="font-medium text-slate-900">{insights.emailDraft.subject}</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{insights.emailDraft.body}</p>
            </div>
          </div>
          {generatedAt && <p className="text-xs text-slate-500">Generated {formatDateTime(generatedAt)}</p>}
        </div>
      )}
    </Card>
  );
}
