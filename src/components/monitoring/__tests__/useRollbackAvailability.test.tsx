import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/services/ApiService", () => ({
  default: {
    getRollbackStatus: vi.fn(),
    getRollbackStatuses: vi.fn(),
  },
}));

import ApiService from "@/services/ApiService";
import { useRollbackAvailability } from "../useRollbackAvailability";

const api = vi.mocked(ApiService);

beforeEach(() => {
  vi.clearAllMocks();
  api.getRollbackStatuses.mockResolvedValue({
    "api-service": { available: true, device: "nas", service: "API" },
    "web-client": { available: false, reason: "No previous image found" },
    "unrequested-bot": { available: true, device: "nas" },
  });
});

describe("useRollbackAvailability", () => {
  it("asks once for every service and keeps only the requested ids", async () => {
    const { result } = renderHook(() =>
      useRollbackAvailability(["web-client", "api-service"]),
    );

    await waitFor(() =>
      expect(result.current.statuses["api-service"]).toBeDefined(),
    );
    expect(api.getRollbackStatuses).toHaveBeenCalledTimes(1);
    expect(api.getRollbackStatus).not.toHaveBeenCalled();
    expect(result.current.statuses).toEqual({
      "api-service": { available: true, device: "nas" },
      "web-client": { available: false, device: null },
    });
  });

  it("does not re-query when polling hands over the same ids in a new array", async () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useRollbackAvailability(ids),
      {
        initialProps: { ids: ["api-service", "web-client"] },
      },
    );
    await waitFor(() =>
      expect(result.current.statuses["api-service"]).toBeDefined(),
    );

    rerender({ ids: ["web-client", "api-service"] });
    expect(api.getRollbackStatuses).toHaveBeenCalledTimes(1);
  });

  it("re-checks one service after a rollback consumes its previous image", async () => {
    const { result } = renderHook(() =>
      useRollbackAvailability(["api-service"]),
    );
    await waitFor(() =>
      expect(result.current.statuses["api-service"]?.available).toBe(true),
    );

    api.getRollbackStatus.mockResolvedValue({
      available: false,
      reason: "No previous image found",
    });
    await result.current.recheck("api-service");
    await waitFor(() =>
      expect(result.current.statuses["api-service"]?.available).toBe(false),
    );
  });
});
