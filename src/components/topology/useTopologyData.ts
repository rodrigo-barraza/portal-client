"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@rodrigo-barraza/utilities-library";
import ApiService from "../../services/ApiService";
import type { PortalService, ProjectAnalysis, ServicesResponse } from "../../types/portal";
import { buildTopologyServices } from "./topologyLayout";

interface TopologyData {
  services: PortalService[];
  analysis: ProjectAnalysis | null;
  hasLoaded: boolean;
  error: string | null;
}

const INITIAL_DATA: TopologyData = {
  services: [],
  analysis: null,
  hasLoaded: false,
  error: null,
};

/**
 * Services + code analysis for the topology graph.
 *
 * The first load forces a fresh health round (like the Projects page) but
 * serves the code analysis from the service's 15-minute cache — forcing it
 * re-fetches every repo from GitHub, which burns the rate limit on each
 * visit. Refresh forces both. Only the latest request may land, a failed
 * analysis keeps the last good one, and a failed refresh keeps the graph.
 */
export function useTopologyData() {
  const [data, setData] = useState<TopologyData>(INITIAL_DATA);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const requestIdRef = useRef(0);
  const lastAnalysisRef = useRef<ProjectAnalysis | null>(null);

  const load = useCallback(async (refreshAnalysis: boolean) => {
    const requestId = ++requestIdRef.current;
    try {
      const [servicesResponse, analysisResponse] = await Promise.all([
        ApiService.getServices(true) as Promise<ServicesResponse>,
        (ApiService.getProjectAnalysis(refreshAnalysis) as Promise<ProjectAnalysis>).catch(
          () => null,
        ),
      ]);
      if (requestId !== requestIdRef.current) return;
      const analysis = analysisResponse ?? lastAnalysisRef.current;
      lastAnalysisRef.current = analysis;
      setData({
        services: buildTopologyServices(servicesResponse, analysis),
        analysis,
        hasLoaded: true,
        error: null,
      });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setData((previous) => ({ ...previous, hasLoaded: true, error: getErrorMessage(error) }));
    } finally {
      if (requestId === requestIdRef.current) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const requestIds = requestIdRef;
    load(false);
    // Invalidate in-flight responses on unmount (and on StrictMode's re-run)
    return () => {
      requestIds.current++;
    };
  }, [load]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    load(true);
  }, [load]);

  return { ...data, isRefreshing, refresh };
}
