import { BadgeComponent } from "@rodrigo-barraza/components-library";
import type { PortalService } from "@/types/portal";
import { CheckingPill } from "../containers/ContainerStatus";
import { projectHealth } from "./projectModel";

/** Status badge that tells "not deployed" and "not checked yet" apart from "down". */
export function ProjectHealthBadge({ service }: { service: PortalService }) {
  switch (projectHealth(service)) {
    case "not-deployed":
      return <BadgeComponent variant="info">Not Deployed</BadgeComponent>;
    case "unknown":
      return <CheckingPill />;
    case "healthy":
      return <BadgeComponent type="status" healthy />;
    case "down":
      return <BadgeComponent type="status" healthy={false} />;
  }
}
