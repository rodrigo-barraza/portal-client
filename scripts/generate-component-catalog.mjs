#!/usr/bin/env node
// ============================================================
// Generate Component Catalog — Prebuild Script
// ============================================================
// Scans the installed @rodrigo-barraza/components-library package at
// build time and writes src/generated/component-catalog.json.
//
// Outputs entries with a `type` field: "component", "hook",
// "provider", "service", or "utility".
//
// Run: node scripts/generate-component-catalog.mjs
// Hooked into: "prebuild" in package.json
// ============================================================

import fs from "node:fs";
import path from "node:path";



// ── Category map (components only) ──────────────────────────────
const CATEGORY_MAP = {
  ButtonComponent:           "actions",
  IconButtonComponent:       "actions",
  FabComponent:              "actions",
  ExtendedFabComponent:      "actions",
  FabMenuComponent:          "actions",
  SplitButtonComponent:      "actions",
  CopyButtonComponent:       "actions",
  CloseButtonComponent:      "actions",
  SnackbarComponent:         "communication",
  ToastComponent:            "communication",
  TooltipComponent:          "communication",
  BadgeComponent:            "communication",
  CountBadgeComponent:       "communication",
  ResponseTimeBadgeComponent:"communication",
  VisibilityBadgeComponent:  "communication",
  CardComponent:             "containment",
  DialogComponent:           "containment",
  ModalComponent:            "containment",
  CarouselComponent:         "containment",
  CollapsibleBlockComponent: "containment",
  StatsCardComponent:        "containment",
  EmptyStateComponent:       "containment",
  DiscordChatComponent:      "containment",
  TextFieldComponent:        "inputs",
  InputComponent:            "inputs",
  TextAreaComponent:         "inputs",
  SearchInputComponent:      "inputs",
  SelectComponent:           "inputs",
  CheckboxComponent:         "inputs",
  RadioComponent:            "inputs",
  SwitchComponent:           "inputs",
  ToggleComponent:           "inputs",
  SliderComponent:           "inputs",
  DatePickerComponent:       "inputs",
  FormGroupComponent:        "inputs",
  NavigationSidebarComponent:"navigation",
  NavigationDrawerComponent: "navigation",
  NavigationRailComponent:   "navigation",
  TabBarComponent:           "navigation",
  MenuComponent:             "navigation",
  PaginationComponent:       "navigation",
  TopAppBarComponent:        "navigation",
  BottomAppBarComponent:     "navigation",
  ProgressIndicatorComponent:"indicators",
  LoadingIndicatorComponent: "indicators",
  LoadingStateComponent:     "indicators",
  PageHeaderComponent:       "layout",
  ToolbarComponent:          "layout",
  DividerComponent:          "layout",
  TableComponent:            "layout",
};

// ── Known providers (live under components/ but are context wrappers) ─
const PROVIDER_NAMES = new Set(["ThemeProvider", "ComponentsProvider"]);

/**
 * Extract the first JSDoc/block-comment description from a JS file.
 */
function extractDescription(filePath) {
  try {
    const source = fs.readFileSync(filePath, "utf8");
    const dashMatch = source.match(/\*\s+\w+\s*[—–-]\s*(.+?)(?:\n|\*\/)/);
    if (dashMatch) return dashMatch[1].trim();
    const descMatch = source.match(/@description\s+(.+?)(?:\n|\*\/)/);
    if (descMatch) return descMatch[1].trim();

    // Fallback: first @param line hint
    const paramMatch = source.match(/@param\s+\{[^}]+\}\s+\[?\w+\]?\s+[—–-]\s*(.+)/);
    if (paramMatch) return paramMatch[1].trim();
  } catch { /* ignore */ }
  return "";
}

/**
 * Check if a file references M3.
 */
function isM3(filePath) {
  try {
    const source = fs.readFileSync(filePath, "utf8");
    return (
      source.includes("m3.material.io") ||
      /Material Design 3/i.test(source) ||
      /\bM3\b/.test(source.slice(0, 2000))
    );
  } catch {
    return false;
  }
}

/**
 * Calculate total size of files in a directory or of a single file.
 */
function totalSize(targetPath) {
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return stat.size;

  return fs.readdirSync(targetPath).reduce((sum, f) => {
    try { return sum + fs.statSync(path.join(targetPath, f)).size; }
    catch { return sum; }
  }, 0);
}

// ── Scan component directories ──────────────────────────────────
function scanComponents(componentsDir) {
  if (!fs.existsSync(componentsDir)) return [];

  const entries = fs.readdirSync(componentsDir, { withFileTypes: true });
  const catalog = [];

  for (const entry of entries) {
    const name = entry.name.replace(/\.(js|ts|tsx)$/, "");

    // Skip providers — they get their own section
    if (PROVIDER_NAMES.has(name)) continue;

    if (entry.isDirectory()) {
      const dirPath = path.join(componentsDir, entry.name);
      const files = fs.readdirSync(dirPath);
      const testFiles = files.filter((f) => f.includes(".test.") || f.includes(".spec."));
      const mainFile = files.find((f) => /\.(js|ts|tsx)$/.test(f) && !f.includes(".test.") && !f.includes(".spec.") && !f.endsWith(".d.ts"));
      const mainPath = mainFile ? path.join(dirPath, mainFile) : null;

      catalog.push({
        name: entry.name,
        type: "component",
        category: CATEGORY_MAP[entry.name] || "layout",
        m3: mainPath ? isM3(mainPath) : false,
        hasTests: testFiles.length > 0,
        files: files.length,
        sizeKb: +(totalSize(dirPath) / 1024).toFixed(1),
        description: mainPath ? extractDescription(mainPath) : "",
      });
    }
  }

  return catalog;
}

// ── Scan hooks directory ────────────────────────────────────────
function scanHooks(hooksDir) {
  if (!fs.existsSync(hooksDir)) return [];

  const files = fs.readdirSync(hooksDir);
  const catalog = [];

  const hookFiles = files.filter(
    (f) => /\.(js|ts|tsx)$/.test(f) && !f.includes(".test.") && !f.includes(".spec.") && !f.endsWith(".d.ts")
  );

  for (const file of hookFiles) {
    const name = file.replace(/\.(js|ts|tsx)$/, "");
    const filePath = path.join(hooksDir, file);
    const testExists = files.some(
      (f) => f.startsWith(name) && (f.includes(".test.") || f.includes(".spec."))
    );

    catalog.push({
      name,
      type: "hook",
      category: "hooks",
      m3: false,
      hasTests: testExists,
      files: testExists ? 2 : 1,
      sizeKb: +(totalSize(filePath) / 1024).toFixed(1),
      description: extractDescription(filePath),
    });
  }

  return catalog;
}

// ── Scan services directory ─────────────────────────────────────
function scanServices(servicesDir) {
  if (!fs.existsSync(servicesDir)) return [];

  const files = fs.readdirSync(servicesDir);
  const catalog = [];

  const serviceFiles = files.filter(
    (f) => /\.(js|ts|tsx)$/.test(f) && !f.includes(".test.") && !f.includes(".spec.") && !f.endsWith(".d.ts")
  );

  for (const file of serviceFiles) {
    const name = file.replace(/\.(js|ts|tsx)$/, "");
    const filePath = path.join(servicesDir, file);
    const testExists = files.some(
      (f) => f.startsWith(name) && (f.includes(".test.") || f.includes(".spec."))
    );

    catalog.push({
      name,
      type: "service",
      category: "services",
      m3: false,
      hasTests: testExists,
      files: testExists ? 2 : 1,
      sizeKb: +(totalSize(filePath) / 1024).toFixed(1),
      description: extractDescription(filePath),
    });
  }

  return catalog;
}

// ── Scan utilities directory ────────────────────────────────────
function scanUtilities(utilsDir) {
  if (!fs.existsSync(utilsDir)) return [];

  const files = fs.readdirSync(utilsDir);
  const catalog = [];

  const utilFiles = files.filter(
    (f) => /\.(js|ts|tsx)$/.test(f) && !f.includes(".test.") && !f.includes(".spec.") && !f.endsWith(".d.ts")
  );

  for (const file of utilFiles) {
    const name = file.replace(/\.(js|ts|tsx)$/, "");
    const filePath = path.join(utilsDir, file);
    const testExists = files.some(
      (f) => f.startsWith(name) && (f.includes(".test.") || f.includes(".spec."))
    );

    catalog.push({
      name,
      type: "utility",
      category: "utilities",
      m3: false,
      hasTests: testExists,
      files: testExists ? 2 : 1,
      sizeKb: +(totalSize(filePath) / 1024).toFixed(1),
      description: extractDescription(filePath),
    });
  }

  return catalog;
}

// ── Scan providers ──────────────────────────────────────────────
function scanProviders(componentsDir) {
  if (!fs.existsSync(componentsDir)) return [];

  const entries = fs.readdirSync(componentsDir, { withFileTypes: true });
  const catalog = [];

  for (const entry of entries) {
    const name = entry.name.replace(/\.(js|ts|tsx)$/, "");
    if (!PROVIDER_NAMES.has(name)) continue;

    if (entry.isDirectory()) {
      const dirPath = path.join(componentsDir, entry.name);
      const files = fs.readdirSync(dirPath);
      const testFiles = files.filter((f) => f.includes(".test.") || f.includes(".spec."));
      const mainFile = files.find((f) => /\.(js|ts|tsx)$/.test(f) && !f.includes(".test.") && !f.includes(".spec.") && !f.endsWith(".d.ts"));

      catalog.push({
        name,
        type: "provider",
        category: "providers",
        m3: false,
        hasTests: testFiles.length > 0,
        files: files.length,
        sizeKb: +(totalSize(dirPath) / 1024).toFixed(1),
        description: mainFile ? extractDescription(path.join(dirPath, mainFile)) : "",
      });
    } else if (entry.isFile() && /\.(js|ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      const filePath = path.join(componentsDir, entry.name);
      catalog.push({
        name,
        type: "provider",
        category: "providers",
        m3: false,
        hasTests: false,
        files: 1,
        sizeKb: +(totalSize(filePath) / 1024).toFixed(1),
        description: extractDescription(filePath),
      });
    }
  }

  return catalog;
}

// ── Main ─────────────────────────────────────────────────────────
function main() {
  // Resolve directly to src/ — the library uses source-first architecture
  // so require.resolve() fails on the strict exports map.
  const libRoot = path.resolve(process.cwd(), "node_modules/@rodrigo-barraza/components-library");
  const srcDir = path.join(libRoot, "src");
  const componentsDir = path.resolve(srcDir, "components");
  const hooksDir = path.resolve(srcDir, "hooks");
  const servicesDir = path.resolve(srcDir, "services");
  const utilsDir = path.resolve(srcDir, "utils");

  const catalog = [
    ...scanComponents(componentsDir),
    ...scanProviders(componentsDir),
    ...scanHooks(hooksDir),
    ...scanServices(servicesDir),
    ...scanUtilities(utilsDir),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const outDir = path.resolve(process.cwd(), "src/generated");
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "component-catalog.json");
  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + "\n");

  // Print summary by type
  const byType = {};
  for (const item of catalog) {
    byType[item.type] = (byType[item.type] || 0) + 1;
  }
  const summary = Object.entries(byType).map(([t, n]) => `${n} ${t}s`).join(", ");
  console.log(`✔ Generated catalog: ${catalog.length} entries (${summary}) → ${outPath}`);
}

main();
