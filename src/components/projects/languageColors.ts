/**
 * GitHub Linguist language colours. Intentionally literal: these are
 * external canonical colours with no design-token counterpart (they must
 * match GitHub's language palette).
 */
export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  Java: "#b07219",
  Go: "#00add8",
  Rust: "#dea584",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4f5d95",
  Swift: "#f05138",
  Kotlin: "#a97bff",
  Dart: "#00b4ab",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Lua: "#000080",
  Perl: "#0298c3",
  R: "#198ce7",
  Scala: "#c22d40",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
  Clojure: "#db5855",
  "Objective-C": "#438eff",
  Dockerfile: "#384d54",
  Makefile: "#427819",
  Nix: "#7e7eff",
  Zig: "#ec915c",
  Astro: "#ff5a03",
  MDX: "#fcb32c",
};

/** Unlisted languages. */
export const DEFAULT_LANGUAGE_COLOR = "var(--text-muted)";
