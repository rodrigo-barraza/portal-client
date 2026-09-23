import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import IntegrationsComponent from "../../IntegrationsComponent";
import ApiService from "../../../services/ApiService";
import { categoryStatus, filterCategories } from "../integrationsModel";
import type { IntegrationCategory } from "@/types/portal";

vi.mock(
  "@rodrigo-barraza/components-library",
  () => import("../../__tests__/componentsLibraryStub"),
);
vi.mock("../../../services/ApiService", () => ({
  default: { getIntegrations: vi.fn() },
}));

const getIntegrations = vi.mocked(ApiService.getIntegrations);

const CATEGORIES: IntegrationCategory[] = [
  {
    category: "AI / LLM",
    configuredCount: 1,
    totalCount: 2,
    integrations: [
      {
        provider: "OpenAI",
        envKey: "OPENAI_API_KEY",
        category: "AI / LLM",
        configured: true,
        fingerprint: "1a2b3c4d",
        docs: "https://platform.openai.com/api-keys",
      },
      {
        provider: "Anthropic",
        envKey: "ANTHROPIC_API_KEY",
        category: "AI / LLM",
        configured: false,
        fingerprint: null,
        docs: "",
      },
    ],
  },
  {
    category: "Finance",
    configuredCount: 0,
    totalCount: 1,
    integrations: [
      {
        provider: "FRED",
        envKey: "FRED_API_KEY",
        category: "Finance",
        configured: false,
        fingerprint: null,
        docs: "",
      },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("integrationsModel", () => {
  it("filters by provider, key or category and recounts", () => {
    const [ai] = filterCategories(CATEGORIES, " openai ");
    expect(ai.integrations.map((item) => item.provider)).toEqual(["OpenAI"]);
    expect([ai.configuredCount, ai.totalCount]).toEqual([1, 1]);
    expect(
      filterCategories(CATEGORIES, "finance").map(
        (category) => category.category,
      ),
    ).toEqual(["Finance"]);
    expect(filterCategories(CATEGORIES, "nothing")).toEqual([]);
    expect(filterCategories(CATEGORIES, "")).toBe(CATEGORIES);
  });

  it("grades a category by how many keys are configured", () => {
    expect(categoryStatus(CATEGORIES[0])).toBe("partial");
    expect(categoryStatus(CATEGORIES[1])).toBe("none");
    expect(categoryStatus({ ...CATEGORIES[1], configuredCount: 1 })).toBe(
      "complete",
    );
  });
});

describe("IntegrationsComponent", () => {
  it("shows a key fingerprint, never key material, for configured keys", async () => {
    getIntegrations.mockResolvedValue({
      categories: CATEGORIES,
      totalCount: 3,
      configuredCount: 1,
    });
    render(<IntegrationsComponent />);

    expect(await screen.findByText("sha256:1a2b3c4d")).toBeInTheDocument();
    expect(screen.getAllByText("Not configured")).toHaveLength(2);
  });

  it("links docs only for real URLs", async () => {
    getIntegrations.mockResolvedValue({
      categories: CATEGORIES,
      totalCount: 3,
      configuredCount: 1,
    });
    render(<IntegrationsComponent />);
    await screen.findByText("OpenAI");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "Open OpenAI dashboard" }),
    ).toHaveAttribute("href", "https://platform.openai.com/api-keys");
  });

  it("collapses a category from its header button", async () => {
    getIntegrations.mockResolvedValue({
      categories: CATEGORIES,
      totalCount: 3,
      configuredCount: 1,
    });
    render(<IntegrationsComponent />);
    const header = await screen.findByRole("button", { name: /AI \/ LLM/ });
    expect(header).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("OpenAI")).not.toBeInTheDocument();
  });

  it("shows an error state with retry instead of '0 of 0 configured'", async () => {
    getIntegrations.mockRejectedValueOnce(new Error("portal-service is down"));
    render(<IntegrationsComponent />);
    expect(
      await screen.findByText("portal-service is down"),
    ).toBeInTheDocument();

    getIntegrations.mockResolvedValue({
      categories: CATEGORIES,
      totalCount: 3,
      configuredCount: 1,
    });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("OpenAI")).toBeInTheDocument();
  });

  it("keeps the list when a refresh fails", async () => {
    getIntegrations.mockResolvedValueOnce({
      categories: CATEGORIES,
      totalCount: 3,
      configuredCount: 1,
    });
    render(<IntegrationsComponent />);
    await screen.findByText("OpenAI");

    getIntegrations.mockRejectedValueOnce(new Error("timeout"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText(/Refresh failed/)).toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
  });
});
