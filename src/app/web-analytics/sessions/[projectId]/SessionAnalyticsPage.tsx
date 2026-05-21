"use client";

import { use } from "react";
import PageLayoutComponent from "../../../../components/PageLayoutComponent";
import SessionAnalyticsComponent from "../../../../components/SessionAnalyticsComponent";

export default function SessionAnalyticsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return (
    <PageLayoutComponent>
      <SessionAnalyticsComponent projectId={decodeURIComponent(projectId)} />
    </PageLayoutComponent>
  );
}
