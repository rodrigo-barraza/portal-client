import { BadgeComponent } from "@rodrigo-barraza/components-library";
import type { PortalService } from "@/types/portal";
import { CheckingPill } from "../containers/ContainerStatus";
import { projectHealth } from "./projectModel";

/**
 * portal-service reports infrastructure it has no health probe for as
 * `checkedAt: null` with an error starting "Unchecked — …": it will never
 * be checked, unlike a project whose first check is merely pending.
 */
const NEVER_CHECKED_PREFIX = "Unchecked";

/** Status badge that tells "not deployed" and "not checked" apart from "down". */
export function ProjectHealthBadge({ service }: { service: PortalService }) {
  switch (projectHealth(service)) {
    case "not-deployed":
      return <BadgeComponent variant="info">Not Deployed</BadgeComponent>;
    case "unknown":
      return service.error?.startsWith(NEVER_CHECKED_PREFIX) ? (
        <CheckingPill label="Unchecked" title={service.error} />
      ) : (
        <CheckingPill />
      );
    case "healthy":
      return <BadgeComponent type="status" healthy />;
    case "down":
      return <BadgeComponent type="status" healthy={false} />;
  }
}
