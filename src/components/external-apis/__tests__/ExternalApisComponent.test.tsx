import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import ExternalApisComponent from "../../ExternalApisComponent";
import ApiService from "../../../services/ApiService";
import type { ExternalApiUsageData } from "../../../types/portal";
import {
  externalApiUsage,
  externalApiUsageData,
} from "../../__tests__/apiFixtures";

vi.mock(
  "@rodrigo-barraza/components-library",
  () => import("../../__tests__/componentsLibraryStub"),
);
vi.mock("../../../services/ApiService", () => ({
  default: {
    getExternalApiUsageSummary: vi.fn(),
    getExternalApiUsageTimeSeries: vi.fn(),
  },
}));

const api = vi.mocked(ApiService);

function summary(
  period: string,
  overrides: Partial<ExternalApiUsageData> = {},
): ExternalApiUsageData {
  return externalApiUsageData({
    services: [
      externalApiUsage({
        serviceIdentifier: `gemini-${period}`,
        displayName: `Gemini ${period}`,
        category: "AI / LLM",
        consumer: "prism-service",
        documentationUrl: "https://ai.google.dev",
        totalRequests: 1500,
        successRequests: 1400,
        errorRequests: 100,
        errorRate: 100 / 1500,
      }),
      externalApiUsage({
        serviceIdentifier: "llm:mystery",
        displayName: "Mystery LLM",
        category: "AI / LLM",
        consumer: "prism-service",
        totalRequests: 10,
        successRequests: 10,
      }),
    ],
    totalRequests: 1510,
    totalErrors: 100,
    period,
    fetchedAt: "2026-09-22T12:00:00Z",
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ExternalApisComponent", () => {
  it("never shows an older period's answer after a newer period was picked", async () => {
    let resolveThirty: (value: ExternalApiUsageData) => void = () => {};
    api.getExternalApiUsageSummary.mockImplementation((period?: string) =>
      period === "30d"
        ? new Promise((resolve) => (resolveThirty = resolve))
        : Promise.resolve(summary(period ?? "")),
    );

    render(<ExternalApisComponent />);
    fireEvent.click(screen.getByRole("radio", { name: "7d" }));
    expect(
      await screen.findByRole("button", { name: /Gemini 7d/ }),
    ).toBeInTheDocument();

    await act(async () => resolveThirty(summary("30d")));
    expect(
      screen.queryByRole("button", { name: /Gemini 30d/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Gemini 7d/ }),
    ).toBeInTheDocument();
  });

  it("formats counts without rounding 1,500 up to 2K", async () => {
    api.getExternalApiUsageSummary.mockResolvedValue(summary("30d"));
    render(<ExternalApisComponent />);
    const card = (await screen.findByRole("button", { name: /Gemini 30d/ }))
      .parentElement!;
    expect(within(card).getByText("1.5K")).toBeInTheDocument();
  });

  it("hides the Docs link when a provider has no documentation URL", async () => {
    api.getExternalApiUsageSummary.mockResolvedValue(summary("30d"));
    render(<ExternalApisComponent />);
    await screen.findByRole("button", { name: /Mystery LLM/ });
    const links = screen.getAllByRole("link", { name: /docs/i });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "https://ai.google.dev");
  });

  it("says when usage sources were unreachable instead of presenting partial totals", async () => {
    api.getExternalApiUsageSummary.mockResolvedValue(
      summary("30d", { unreachableSources: ["google-cloud-monitoring"] }),
    );
    render(<ExternalApisComponent />);
    expect(
      await screen.findByText(/totals are incomplete: google-cloud-monitoring/),
    ).toBeInTheDocument();
  });

  it("expands a card from its header button and shows a failed breakdown as such", async () => {
    api.getExternalApiUsageSummary.mockResolvedValue(summary("30d"));
    api.getExternalApiUsageTimeSeries.mockRejectedValue(new Error("boom"));

    render(<ExternalApisComponent />);
    const toggle = await screen.findByRole("button", { name: /Gemini 30d/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(api.getExternalApiUsageTimeSeries).toHaveBeenCalledWith(
      "gemini-30d",
      "30d",
      {
        signal: expect.any(AbortSignal),
      },
    );
    expect(
      await screen.findByText("Couldn't load the daily breakdown."),
    ).toBeInTheDocument();
  });

  it("shows an error state with retry when the first load fails", async () => {
    api.getExternalApiUsageSummary.mockRejectedValueOnce(
      new Error("Monitoring API 403"),
    );
    render(<ExternalApisComponent />);
    expect(await screen.findByText("Monitoring API 403")).toBeInTheDocument();

    api.getExternalApiUsageSummary.mockResolvedValue(summary("30d"));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("button", { name: /Gemini 30d/ }),
    ).toBeInTheDocument();
  });
});
