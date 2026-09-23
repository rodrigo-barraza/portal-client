"use client";

import { useCallback, useRef } from "react";
import { getErrorMessage } from "@rodrigo-barraza/utilities-library";
import ApiService from "../../services/ApiService";
import type { PortalService, ProjectAnalysis } from "../../types/portal";
import useAsyncData from "../analytics/useAsyncData";
import { buildTopologyServices } from "./topologyLayout";

const NO_SERVICES: PortalService[] = [];

/**
 * Services + code analysis for the topology graph.
 *
 * The first load forces a fresh health round (like the Projects page) but
 * serves the code analysis from the service's 15-minute cache — forcing it
 * re-fetches every repo from GitHub, which burns the rate limit on each
 * visit. Refresh forces both. A refresh aborts the load it supersedes, a
 * failed analysis keeps the last good one, and a failed refresh keeps the
 * graph.
 */
export function useTopologyData() {
  // Read (and cleared) synchronously as a load starts, so only the load a
  // refresh() starts asks for a fresh analysis.
  const refreshAnalysisRef = useRef(false);
  const lastAnalysisRef = useRef<ProjectAnalysis | null>(null);

  const topology = useAsyncData("topology", async (signal) => {
    const refreshAnalysis = refreshAnalysisRef.current;
    refreshAnalysisRef.current = false;
    const [servicesResponse, analysisResponse] = await Promise.all([
      ApiService.getServices(true, { signal }),
      ApiService.getProjectAnalysis(refreshAnalysis, { signal }).catch(
        () => null,
      ),
    ]);
    const analysis = analysisResponse ?? lastAnalysisRef.current;
    lastAnalysisRef.current = analysis;
    return {
      services: buildTopologyServices(servicesResponse, analysis),
      analysis,
    };
  });
  const { reload } = topology;

  const refresh = useCallback(() => {
    refreshAnalysisRef.current = true;
    void reload();
  }, [reload]);

  return {
    services: topology.data?.services ?? NO_SERVICES,
    analysis: topology.data?.analysis ?? null,
    hasLoaded: !topology.loading,
    error: topology.error ? getErrorMessage(topology.error) : null,
    isRefreshing: topology.reloading,
    refresh,
  };
}
