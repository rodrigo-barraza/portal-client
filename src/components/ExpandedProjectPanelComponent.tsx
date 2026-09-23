"use client";

import { useState } from "react";
import { Box, GitFork, Network, TrendingUp } from "lucide-react";
import { TabBarComponent } from "@rodrigo-barraza/components-library";
import type { PortalService } from "../types/portal";
import ProjectAnalyticsTab from "./projects/ProjectAnalyticsTab";
import ProjectContainerTab from "./projects/ProjectContainerTab";
import ProjectOverviewTab from "./projects/ProjectOverviewTab";
import ProjectTopologyTab from "./projects/ProjectTopologyTab";
import { projectHealth } from "./projects/projectModel";
import styles from "./ExpandedProjectPanelComponent.module.css";

type TabId = "project" | "container" | "topology" | "web-analytics";

const TABS: { id: TabId; label: string; icon: typeof GitFork }[] = [
  { id: "project", label: "Project", icon: GitFork },
  { id: "container", label: "Container", icon: Box },
  { id: "topology", label: "Topology", icon: Network },
  { id: "web-analytics", label: "Web Analytics", icon: TrendingUp },
];

/** Drawer body for a Projects table row: tabbed project / container / graph / analytics. */
export default function ExpandedProjectPanel({
  service,
  allServices = [],
}: {
  service: PortalService;
  allServices?: PortalService[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>("project");
  const propertyId = service.analyticsPropertyId;

  // Web Analytics only exists for projects with a GA property.
  const visibleTabs = TABS.filter(
    (tab) => tab.id !== "web-analytics" || propertyId,
  );
  // A failed check matters only for something that is deployed and checked.
  const showError = Boolean(service.error) && projectHealth(service) === "down";

  return (
    <div className={`expanded-project-panel-component ${styles["panel"]}`}>
      <TabBarComponent
        ariaLabel="Project detail sections"
        variant="secondary"
        tabs={visibleTabs.map(({ id, label, icon: Icon }) => ({
          key: id,
          label,
          icon: <Icon size={12} strokeWidth={2.2} />,
        }))}
        activeTab={activeTab}
        onChange={(key: string) => setActiveTab(key as TabId)}
      />

      <div className={styles["tab-content"]}>
        {activeTab === "project" && <ProjectOverviewTab service={service} />}
        {activeTab === "container" && <ProjectContainerTab service={service} />}
        {activeTab === "topology" && (
          <ProjectTopologyTab service={service} allServices={allServices} />
        )}
        {activeTab === "web-analytics" && propertyId && (
          <ProjectAnalyticsTab propertyId={propertyId} />
        )}
      </div>

      {showError && <div className={styles["error-bar"]}>{service.error}</div>}
    </div>
  );
}
