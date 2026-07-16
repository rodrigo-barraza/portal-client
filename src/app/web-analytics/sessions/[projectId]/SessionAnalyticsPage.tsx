"use client";

import { use } from "react";
import PageLayoutComponent from "../../../../components/PageLayoutComponent";
import PropertyDashboardComponent from "../../../../components/PropertyDashboardComponent";

export default function SessionAnalyticsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return (
    <PageLayoutComponent>
      <PropertyDashboardComponent projectId={decodeURIComponent(projectId)} />
    </PageLayoutComponent>
  );
}
