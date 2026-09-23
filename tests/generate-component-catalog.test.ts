import { describe, it, expect } from "vitest";
import {
  classifyModule,
  extractDescription,
  parseBarrelModules,
} from "../scripts/generate-component-catalog.mjs";

describe("parseBarrelModules", () => {
  it("collects runtime re-exports and skips type-only ones", () => {
    const barrel = [
      'export { default as ButtonComponent } from "./components/ButtonComponent/ButtonComponent.js";',
      'export type { ButtonProps } from "./components/ButtonComponent/Types.js";',
      'export {\n  ThemeProvider,\n  useTheme,\n} from "./components/ThemeProvider/ThemeProvider.js";',
      'export { default as useFetch } from "./hooks/useFetch.js";',
    ].join("\n");

    expect(parseBarrelModules(barrel)).toEqual([
      "components/ButtonComponent/ButtonComponent",
      "components/ThemeProvider/ThemeProvider",
      "hooks/useFetch",
    ]);
  });
});

describe("classifyModule", () => {
  it("classifies each library folder", () => {
    expect(
      classifyModule("components/ButtonComponent/ButtonComponent"),
    ).toEqual({
      name: "ButtonComponent",
      type: "component",
    });
    expect(classifyModule("components/ThemeProvider/ThemeProvider")).toEqual({
      name: "ThemeProvider",
      type: "provider",
    });
    expect(classifyModule("components/ComponentsProvider")).toEqual({
      name: "ComponentsProvider",
      type: "provider",
      isFile: true,
    });
    expect(classifyModule("hooks/useFetch")).toEqual({
      name: "useFetch",
      type: "hook",
    });
    expect(classifyModule("services/SoundService")).toEqual({
      name: "SoundService",
      type: "service",
    });
    expect(classifyModule("utils/colorContrast")).toEqual({
      name: "colorContrast",
      type: "utility",
    });
  });

  it("skips helper modules and non-catalog folders", () => {
    expect(
      classifyModule("components/ThemeProvider/themeConstants"),
    ).toBeNull();
    expect(classifyModule("components/PageHeaderContext")).toBeNull();
    expect(classifyModule("constants/agentChat")).toBeNull();
  });
});

describe("extractDescription", () => {
  it("prefers the comment that introduces the module by name", () => {
    const source = [
      "// ────────────────",
      "// SessionService — Client-side visitor analytics",
      "// ────────────────",
      "// Manages session + visitor IDs.",
    ].join("\n");
    expect(extractDescription(source, "SessionService")).toBe(
      "Client-side visitor analytics",
    );
  });

  it("stops at the first sentence without splitting on abbreviations", () => {
    const source = `/**
 * colorContrast — Helpers for readable foregrounds (e.g. a check icon on a
 * swatch). Second sentence is dropped.
 */`;
    expect(extractDescription(source, "colorContrast")).toBe(
      "Helpers for readable foregrounds (e.g. a check icon on a swatch).",
    );
  });

  it("falls back to the doc comment attached to the export", () => {
    const source = `import x from "y";

/** Unrelated helper doc. */
function helper() {}

/**
 * Debounces a callback by the given delay.
 * @param delay — milliseconds
 */
export default function useDebounce() {}`;
    expect(extractDescription(source, "useDebounce")).toBe(
      "Debounces a callback by the given delay.",
    );
  });

  it("sentence-cases a lowercase lead word but keeps mixed case", () => {
    expect(
      extractDescription("/** Toggle — iOS-style switch. */", "Toggle"),
    ).toBe("iOS-style switch.");
    expect(extractDescription("/** Input — styled input. */", "Input")).toBe(
      "Styled input.",
    );
  });

  it("returns an empty string when nothing describes the module", () => {
    expect(
      extractDescription("const a = 1;\n// note\nexport const b = a;", "X"),
    ).toBe("");
  });
});
