import type { CSSProperties, ReactNode } from "react";
import { BadgeComponent } from "@rodrigo-barraza/components-library";
import { DEPLOY_TIER_COLORS, SERVICE_TYPE_COLORS } from "@/constants";

function tintedStyle(
  colors: { color: string; subtle: string } | undefined,
): CSSProperties | undefined {
  if (!colors) return undefined;
  return {
    color: colors.color,
    background: colors.subtle,
    borderColor: `color-mix(in srgb, ${colors.color} 25%, transparent)`,
  };
}

/** Project type badge in the registry's type colour (cards, table, drawer). */
export function ProjectTypeBadge({ projectType }: { projectType: string }) {
  return (
    <BadgeComponent
      variant="info"
      style={tintedStyle(SERVICE_TYPE_COLORS[projectType])}
    >
      {projectType}
    </BadgeComponent>
  );
}

/** Deploy tier badge in the tier colour. */
export function DeployTierBadge({
  tier,
  children,
}: {
  tier: number;
  children?: ReactNode;
}) {
  return (
    <BadgeComponent
      variant="info"
      style={tintedStyle(DEPLOY_TIER_COLORS[tier])}
    >
      {children ?? `Tier ${tier}`}
    </BadgeComponent>
  );
}
