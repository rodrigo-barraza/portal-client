import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  ComponentPreviewDemo,
  hasPreview,
} from "@/components/ComponentPreviewRegistryComponent";
import { catalogEntriesOfType } from "@/lib/libraryCatalog";

describe("ComponentPreviewRegistry", () => {
  it("has a preview for every component the library exports", () => {
    const missing = catalogEntriesOfType("component")
      .map((entry) => entry.name)
      .filter((name) => !hasPreview(name));
    expect(missing).toEqual([]);
  });

  it("renders nothing for unknown names", () => {
    expect(hasPreview("NotAComponent")).toBe(false);
    expect(hasPreview("toString")).toBe(false);
    const { container } = render(<ComponentPreviewDemo name="NotAComponent" />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(catalogEntriesOfType("component").map((entry) => entry.name))(
    "renders the %s demo without throwing",
    (name) => {
      expect(() => render(<ComponentPreviewDemo name={name} />)).not.toThrow();
    },
  );

  it("renders a live demo", () => {
    const { getByText } = render(<ComponentPreviewDemo name="BadgeComponent" />);
    expect(getByText("Active")).toBeInTheDocument();
  });
});
