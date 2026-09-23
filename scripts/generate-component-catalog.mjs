#!/usr/bin/env node
// ============================================================
// Generate Component Catalog — Prebuild Script
// ============================================================
// Scans the installed @rodrigo-barraza/components-library and
// writes src/generated/component-catalog.json for the Developer
// pages (Components, Hooks, Providers, Services, Utilities).
//
// Only modules the library's barrel (src/index.tsx) actually
// re-exports are listed — a folder that exists but is not
// exported cannot be imported by a consumer, so it is not shown.
//
// Every entry: { name, type, category, m3, hasTests, files,
// sizeKb, description } with type "component" | "provider" |
// "hook" | "service" | "utility".
//
// Paths resolve from this script's location, so it can be run
// from any working directory.
//
// Run: node scripts/generate-component-catalog.mjs
// Hooked into: "prebuild" in package.json
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const OUTPUT_PATH = path.join(
  PROJECT_ROOT,
  "src/generated/component-catalog.json",
);
const LIBRARY_NAME = "@rodrigo-barraza/components-library";

// ── Category map (components only) ──────────────────────────────
// Unmapped components fall back to "layout" with a warning, so a new
// library component shows up here to be categorized.
const CATEGORY_MAP = {
  // Actions
  ButtonComponent: "actions",
  CloseButtonComponent: "actions",
  CopyButtonComponent: "actions",
  ExtendedFabComponent: "actions",
  FabComponent: "actions",
  FabMenuComponent: "actions",
  IconButtonComponent: "actions",
  SegmentedControlComponent: "actions",
  SplitButtonComponent: "actions",
  ThemeToggleButtonComponent: "actions",
  // Communication
  AvatarComponent: "communication",
  BadgeComponent: "communication",
  SnackbarComponent: "communication",
  StatBadgeComponent: "communication",
  ToastComponent: "communication",
  TooltipComponent: "communication",
  // Containment
  AgentChatMessageListComponent: "containment",
  AgentChatWindowComponent: "containment",
  CardComponent: "containment",
  CarouselComponent: "containment",
  CollapsibleBlockComponent: "containment",
  DialogComponent: "containment",
  DiscordChatComponent: "containment",
  DrawerComponent: "containment",
  EmptyStateComponent: "containment",
  ErrorBoundaryComponent: "containment",
  ErrorFallbackComponent: "containment",
  MarkdownContentComponent: "containment",
  ModalComponent: "containment",
  StatsCardComponent: "containment",
  ToolCardComponent: "containment",
  // Inputs
  AgentChatInputComponent: "inputs",
  CheckboxComponent: "inputs",
  ChipComponent: "inputs",
  DatePickerComponent: "inputs",
  FormGroupComponent: "inputs",
  InputComponent: "inputs",
  MultiSelectComponent: "inputs",
  RadioComponent: "inputs",
  SearchInputComponent: "inputs",
  SelectComponent: "inputs",
  SliderComponent: "inputs",
  SwitchComponent: "inputs",
  TextAreaComponent: "inputs",
  TextFieldComponent: "inputs",
  ThemePickerComponent: "inputs",
  ToggleComponent: "inputs",
  // Navigation
  BottomAppBarComponent: "navigation",
  MenuComponent: "navigation",
  MobileHeaderComponent: "navigation",
  NavigationDrawerComponent: "navigation",
  NavigationRailComponent: "navigation",
  NavigationSidebarComponent: "navigation",
  PaginationComponent: "navigation",
  TabBarComponent: "navigation",
  TopAppBarComponent: "navigation",
  // Indicators
  ChartLineComponent: "indicators",
  LoadingIndicatorComponent: "indicators",
  LoadingStateComponent: "indicators",
  ProgressBarComponent: "indicators",
  SkeletonComponent: "indicators",
  StatusDotComponent: "indicators",
  StreamingCursorComponent: "indicators",
  // Layout
  CustomThemeBootComponent: "layout",
  DividerComponent: "layout",
  LayoutHeaderComponent: "layout",
  PageHeaderComponent: "layout",
  PageHeroComponent: "layout",
  PageLayoutComponent: "layout",
  SessionTrackerComponent: "layout",
  TableComponent: "layout",
  ToolbarComponent: "layout",
};

const DEFAULT_CATEGORY = "layout";
const SOURCE_FILE_PATTERN = /\.(js|jsx|ts|tsx)$/;
const TEST_FILE_PATTERN = /\.(test|spec)\./;
const DESCRIPTION_MAX_LENGTH = 180;

// ── Library location ────────────────────────────────────────────

/** Find the installed library the way Node resolves a bare specifier:
 *  node_modules/<name> in the project root, then each parent directory.
 *  (`import.meta.resolve` is unavailable under Vite's module runner, and the
 *  library's exports map has no "require" entry for require.resolve.) */
function resolveLibraryRoot() {
  let directory = PROJECT_ROOT;
  for (;;) {
    const candidate = path.join(directory, "node_modules", LIBRARY_NAME);
    if (fs.existsSync(path.join(candidate, "package.json"))) {
      return fs.realpathSync(candidate);
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      throw new Error(`${LIBRARY_NAME} is not installed — run pnpm install`);
    }
    directory = parent;
  }
}

// ── Barrel parsing ──────────────────────────────────────────────

/**
 * Every module path the barrel re-exports a runtime value from, relative to
 * src/ and without extension (e.g. "components/ButtonComponent/ButtonComponent").
 * Type-only exports are skipped.
 */
export function parseBarrelModules(barrelSource) {
  const modules = new Set();
  const exportPattern =
    /export\s+(type\s+)?\{[^}]*\}\s+from\s+["']\.\/([^"']+)["']/g;
  for (const match of barrelSource.matchAll(exportPattern)) {
    if (match[1]) continue;
    modules.add(match[2].replace(SOURCE_FILE_PATTERN, ""));
  }
  return [...modules];
}

/** Map a barrel module path to its catalog type, or null when it is not a
 *  catalog entry (constants, a component's helper module, …). */
export function classifyModule(modulePath) {
  const segments = modulePath.split("/");
  const [folder] = segments;
  const name = segments.at(-1);

  if (folder === "hooks" && segments.length === 2)
    return { name, type: "hook" };
  if (folder === "services" && segments.length === 2) {
    return { name, type: "service" };
  }
  if (folder === "utils" && segments.length === 2)
    return { name, type: "utility" };
  if (folder !== "components") return null;

  const isProvider = name.endsWith("Provider");
  if (segments.length === 2) {
    return isProvider ? { name, type: "provider", isFile: true } : null;
  }
  // components/<Dir>/<File> — only the folder's main module, not helpers
  // such as ThemeProvider/themeConstants.
  if (segments.length === 3 && segments[1] === name) {
    return { name, type: isProvider ? "provider" : "component" };
  }
  return null;
}

// ── Description extraction ──────────────────────────────────────

/** Comment blocks in source order, each normalized to plain text lines. */
function commentBlocks(source) {
  const blocks = [];
  const pattern = /\/\*[\s\S]*?\*\/|(?:^[ \t]*\/\/.*(?:\r?\n|$))+/gm;
  for (const match of source.matchAll(pattern)) {
    const lines = match[0]
      .replace(/^\/\*+|\*+\/$/g, "")
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*(?:\/\/+|\*)?\s?/, "").trimEnd())
      // A ruler line (─── / ===) separates a title from its body: treat it
      // as a paragraph break.
      .map((line) => (/^[─━═=\-*\s]+$/.test(line) ? "" : line));
    blocks.push({
      index: match.index,
      end: match.index + match[0].length,
      lines,
    });
  }
  return blocks;
}

/** First paragraph → first sentence, capped in length. Stops at JSDoc tags. */
function firstSentence(lines) {
  const paragraph = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("@")) break;
    if (!trimmed) {
      if (paragraph.length) break;
      continue;
    }
    paragraph.push(trimmed);
  }
  const joined = paragraph.join(" ").replace(/\s+/g, " ").trim();
  // Sentence-case a lowercase lead word ("styled input" → "Styled input"),
  // but leave mixed-case words such as "iOS" alone.
  const text = /^[a-z]+\b/.test(joined)
    ? joined.charAt(0).toUpperCase() + joined.slice(1)
    : joined;
  // A sentence ends at . ! ? followed by an uppercase start or the end —
  // "e.g. a" does not end one.
  const end = text.search(/[.!?](?=\s+[A-Z`"(]|$)/);
  const sentence = end === -1 ? text : text.slice(0, end + 1);
  if (sentence.length <= DESCRIPTION_MAX_LENGTH) return sentence;
  const cut = sentence.slice(0, DESCRIPTION_MAX_LENGTH);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:—–-]$/, "")}…`;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Pick the best description comment for `name` in `source`:
 * 1. a comment introducing the module by name ("Name — does X"),
 * 2. the doc comment directly above the default/named export of `name`,
 * 3. the file's leading comment, if it precedes all code.
 */
export function extractDescription(source, name) {
  const blocks = commentBlocks(source);
  // "ThemeProvider — …" or its context's name ("ThemeContext — …").
  const names = [name, name.replace(/Provider$/, "Context")].map(escapeRegExp);
  const namePattern = new RegExp(
    `^(?:${names.join("|")})(?:\\(\\))?\\s*[—–:-]\\s*(.*)$`,
    "i",
  );

  for (const block of blocks) {
    const start = block.lines.findIndex((line) =>
      namePattern.test(line.trim()),
    );
    if (start === -1) continue;
    const [, rest] = block.lines[start].trim().match(namePattern);
    const description = firstSentence([rest, ...block.lines.slice(start + 1)]);
    if (description) return description;
  }

  const exportPattern = new RegExp(
    `export\\s+(?:default\\s+)?(?:async\\s+)?(?:function|class|const)\\s+${escapeRegExp(name)}\\b|export\\s+default\\s+(?:async\\s+)?(?:function|class)\\b`,
  );
  const exportMatch = exportPattern.exec(source);
  if (exportMatch) {
    // Only a comment that sits directly on top of the export counts.
    const attached = blocks.findLast(
      (block) =>
        block.end <= exportMatch.index &&
        !source.slice(block.end, exportMatch.index).trim(),
    );
    const description = attached ? firstSentence(attached.lines) : "";
    if (description) return description;
  }

  const leading = blocks[0];
  if (leading) {
    const beforeFirstComment = source.slice(0, leading.index);
    if (!beforeFirstComment.replace(/["']use client["'];?/, "").trim()) {
      return firstSentence(leading.lines);
    }
  }
  return "";
}

// ── File helpers ────────────────────────────────────────────────

function isSourceFile(fileName) {
  return (
    SOURCE_FILE_PATTERN.test(fileName) &&
    !TEST_FILE_PATTERN.test(fileName) &&
    !fileName.endsWith(".d.ts")
  );
}

function sizeOf(targetPath) {
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return stat.size;
  return fs.readdirSync(targetPath).reduce((sum, fileName) => {
    const filePath = path.join(targetPath, fileName);
    return fs.statSync(filePath).isFile()
      ? sum + fs.statSync(filePath).size
      : sum;
  }, 0);
}

function toKb(bytes) {
  return +(bytes / 1024).toFixed(1);
}

function readSource(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function isM3(source) {
  return (
    source.includes("m3.material.io") ||
    /Material Design 3/i.test(source) ||
    /\bM3\b/.test(source.slice(0, 2000))
  );
}

/** Build the catalog entry for one classified barrel module. */
function buildEntry(sourceDirectory, modulePath, { name, type, isFile }) {
  const folder = path.join(sourceDirectory, path.dirname(modulePath));
  const siblings = fs.readdirSync(folder);
  const mainFile = siblings.find(
    (fileName) =>
      isSourceFile(fileName) &&
      fileName.replace(SOURCE_FILE_PATTERN, "") === name,
  );
  const mainPath = mainFile ? path.join(folder, mainFile) : null;
  const source = mainPath ? readSource(mainPath) : "";
  const ownsFolder = (type === "component" || type === "provider") && !isFile;

  const testFiles = siblings.filter(
    (fileName) =>
      TEST_FILE_PATTERN.test(fileName) &&
      (ownsFolder || fileName.startsWith(`${name}.`)),
  );

  let category = type === "hook" ? "hooks" : `${type}s`;
  if (type === "utility") category = "utilities";
  if (type === "component") {
    category = CATEGORY_MAP[name] ?? DEFAULT_CATEGORY;
    if (!CATEGORY_MAP[name]) {
      console.warn(
        `⚠ ${name} has no category in CATEGORY_MAP — listed under "${DEFAULT_CATEGORY}"`,
      );
    }
  }

  return {
    name,
    type,
    category,
    m3: type === "component" ? isM3(source) : false,
    hasTests: testFiles.length > 0,
    files: ownsFolder ? siblings.length : 1 + testFiles.length,
    sizeKb: toKb(ownsFolder ? sizeOf(folder) : mainPath ? sizeOf(mainPath) : 0),
    description: extractDescription(source, name),
  };
}

// ── Main ─────────────────────────────────────────────────────────

/** Scan the library and write the catalog JSON. Returns the entries. */
export function writeCatalog({ quiet = false } = {}) {
  const libraryRoot = resolveLibraryRoot();
  // The library ships its sources; scan them (dist has no tests or CSS
  // modules to count, and its comments are stripped of context).
  const sourceDirectory = path.join(libraryRoot, "src");
  const barrelSource = fs.readFileSync(
    path.join(sourceDirectory, "index.tsx"),
    "utf8",
  );

  const catalog = [];
  for (const modulePath of parseBarrelModules(barrelSource)) {
    const classification = classifyModule(modulePath);
    if (!classification) continue;
    catalog.push(buildEntry(sourceDirectory, modulePath, classification));
  }
  catalog.sort((a, b) => a.name.localeCompare(b.name));

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
  if (quiet) return catalog;

  const countsByType = {};
  for (const entry of catalog) {
    countsByType[entry.type] = (countsByType[entry.type] ?? 0) + 1;
  }
  const plural = (type) => (type === "utility" ? "utilities" : `${type}s`);
  const summary = Object.entries(countsByType)
    .map(([type, count]) => `${count} ${plural(type)}`)
    .join(", ");
  console.log(
    `✔ Generated catalog: ${catalog.length} entries (${summary}) → ${path.relative(process.cwd(), OUTPUT_PATH) || OUTPUT_PATH}`,
  );
  return catalog;
}

// Run only when executed directly, so the helpers above can be unit-tested.
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  writeCatalog();
}
