import { Badge, type Tone } from "@/components/ui";
import { HEALTH_LABELS, type DealHealth } from "@/lib/deal-health";

const TONES: Record<DealHealth["level"], Tone> = { healthy: "green", watch: "amber", at_risk: "red" };

/** Health is always shown as text + score, never color alone. */
export function HealthBadge({ health }: { health: Pick<DealHealth, "level" | "score"> }) {
  return (
    <Badge tone={TONES[health.level]}>
      {HEALTH_LABELS[health.level]} · {health.score}
    </Badge>
  );
}
