"use client";

import { useCallback, useMemo, useState } from "react";
import { DrawerComponent, TableComponent } from "@rodrigo-barraza/components-library";
import type { PortalService } from "../types/portal";
import ExpandedProjectPanel from "./ExpandedProjectPanelComponent";
import { buildProjectColumns, getProjectRowClassName } from "./projects/projectColumns";
import type { ProjectLanguages, ProjectSize, SortDirection } from "./projects/projectModel";

interface ProjectTableProps {
  /** Rows, already filtered and sorted by the page. */
  services: PortalService[];
  /** Every listed project — the drawer's topology tab graphs against it. */
  allServices: PortalService[];
  projectSizes: Record<string, ProjectSize>;
  projectLanguages: Record<string, ProjectLanguages>;
  excludeColumns?: readonly string[];
  sortKey: string;
  sortDir: SortDirection;
  onSort: (key: string, direction: SortDirection) => void;
  title?: string;
  subtitle?: string;
}

const NO_EXCLUDED_COLUMNS: readonly string[] = [];

export default function ProjectTableComponent({
  services,
  allServices,
  projectSizes,
  projectLanguages,
  excludeColumns = NO_EXCLUDED_COLUMNS,
  sortKey,
  sortDir,
  onSort,
  title,
  subtitle,
}: ProjectTableProps) {
  // Selection is by id, so the open drawer follows each health refresh
  // instead of showing the snapshot taken when the row was clicked.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedProject = selectedId
    ? (allServices.find((service) => service.id === selectedId) ??
      services.find((service) => service.id === selectedId) ??
      null)
    : null;

  const columns = useMemo(
    () => buildProjectColumns(projectSizes, projectLanguages, new Set(excludeColumns)),
    [projectSizes, projectLanguages, excludeColumns],
  );

  const handleRowClick = useCallback((row: PortalService) => setSelectedId(row.id), []);

  return (
    <>
      <TableComponent
        className="project-table-component"
        title={title}
        subtitle={subtitle}
        columns={columns}
        data={services}
        getRowKey={(row: PortalService) => row.id}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        emptyText="No projects match the selected filters"
        getRowClassName={getProjectRowClassName}
        onRowClick={handleRowClick}
        activeRowKey={selectedId}
        storageKey="project-table"
      />

      <DrawerComponent
        open={selectedProject !== null}
        onClose={() => setSelectedId(null)}
        title={selectedProject?.name || "Project Detail"}
        width={640}
      >
        {selectedProject && (
          <ExpandedProjectPanel
            key={selectedProject.id}
            service={selectedProject}
            allServices={allServices}
          />
        )}
      </DrawerComponent>
    </>
  );
}
