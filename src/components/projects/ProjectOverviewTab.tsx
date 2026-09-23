import { GitFork, Globe } from "lucide-react";
import { BadgeComponent } from "@rodrigo-barraza/components-library";
import type { PortalService } from "@/types/portal";
import { DeployTierBadge, ProjectTypeBadge } from "./ProjectBadges";
import { describeServiceMetadata } from "./projectModel";
import panelStyles from "../ExpandedProjectPanelComponent.module.css";

/** Drawer's Project tab: identity and what the last health check reported. */
export default function ProjectOverviewTab({ service }: { service: PortalService }) {
  const metadata = describeServiceMetadata(service);
  return (
    <div className={panelStyles['project-tab']}>
      <div className={panelStyles['section']}>
        <h4 className={panelStyles['section-title']}>Identity</h4>
        <div className={`${panelStyles['field-grid']} ${panelStyles['field-grid-single']}`}>
          {service.projectType && (
            <div className={panelStyles['field']}>
              <span className={panelStyles['field-label']}>Type</span>
              <ProjectTypeBadge projectType={service.projectType} />
            </div>
          )}
          {typeof service.deployTier === "number" && (
            <div className={panelStyles['field']}>
              <span className={panelStyles['field-label']}>Tier</span>
              <DeployTierBadge tier={service.deployTier} />
            </div>
          )}
          {service.repo && (
            <div className={panelStyles['field']}>
              <span className={panelStyles['field-label']}>Repository</span>
              <BadgeComponent type="repository" repo={service.repo} icons={{ Github: GitFork }} />
            </div>
          )}
          {service.domain && (
            <div className={panelStyles['field']}>
              <span className={panelStyles['field-label']}>Domain</span>
              <BadgeComponent type="domain" domain={service.domain} icons={{ Globe }} />
            </div>
          )}
        </div>
      </div>

      {(metadata.length > 0 || service.checkedAt) && (
        <div className={panelStyles['section']}>
          <h4 className={panelStyles['section-title']}>Metadata</h4>
          <div className={panelStyles['field-grid']}>
            {metadata.map((field) => (
              <div key={field.label} className={panelStyles['field']}>
                <span className={panelStyles['field-label']}>{field.label}</span>
                <span
                  className={`${panelStyles['field-value']} ${field.mono ? panelStyles['mono'] : ""}`}
                  title={field.value}
                >
                  {field.value}
                </span>
              </div>
            ))}
            {service.checkedAt && (
              <div className={panelStyles['field']}>
                <span className={panelStyles['field-label']}>Last Checked</span>
                <BadgeComponent type="dateTime" date={service.checkedAt} highlightNew />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
