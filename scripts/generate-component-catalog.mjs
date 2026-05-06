#!/usr/bin/env node
// ============================================================
// Generate Component Catalog — Prebuild Script
// ============================================================
// Scans the installed @rodrigo-barraza/components package at
// build time and writes src/generated/component-catalog.json.
//
// Run: node scripts/generate-component-catalog.mjs
// Hooked into: "prebuild" in package.json
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// ── Category map ─────────────────────────────────────────────────
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
  ThemeProvider:              "providers",
};

function scanComponentLibrary() {
  const indexPath = require.resolve("@rodrigo-barraza/components");
  const componentsDir = path.resolve(path.dirname(indexPath), "components");

  if (!fs.existsSync(componentsDir)) {
    console.warn("⚠  Components directory not found:", componentsDir);
    return [];
  }

  const entries = fs.readdirSync(componentsDir, { withFileTypes: true });
  const catalog = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dirPath = path.join(componentsDir, entry.name);
    const files = fs.readdirSync(dirPath);

    const jsFiles = files.filter((f) => f.endsWith(".js"));
    const testFiles = files.filter(
      (f) => f.includes(".test.") || f.includes(".spec.")
    );

    const totalBytes = files.reduce((sum, f) => {
      try {
        return sum + fs.statSync(path.join(dirPath, f)).size;
      } catch {
        return sum;
      }
    }, 0);

    const mainJsFile = jsFiles.find(
      (f) => !f.includes(".test.") && !f.includes(".spec.")
    );
    let description = "";
    let m3 = false;

    if (mainJsFile) {
      try {
        const source = fs.readFileSync(path.join(dirPath, mainJsFile), "utf8");

        m3 =
          source.includes("m3.material.io") ||
          /Material Design 3/i.test(source) ||
          /\bM3\b/.test(source.slice(0, 2000));

        const dashMatch = source.match(
          /\*\s+\w+\s*[—–-]\s*(.+?)(?:\n|\*\/)/
        );
        if (dashMatch) {
          description = dashMatch[1].trim();
        } else {
          const descMatch = source.match(
            /@description\s+(.+?)(?:\n|\*\/)/
          );
          if (descMatch) {
            description = descMatch[1].trim();
          }
        }
      } catch {
        // Silently ignore read errors
      }
    }

    catalog.push({
      name: entry.name,
      category: CATEGORY_MAP[entry.name] || "layout",
      m3,
      hasTests: testFiles.length > 0,
      files: files.length,
      sizeKb: +(totalBytes / 1024).toFixed(1),
      description,
    });
  }

  return catalog.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Main ─────────────────────────────────────────────────────────
const catalog = scanComponentLibrary();

const outDir = path.resolve(process.cwd(), "src/generated");
fs.mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, "component-catalog.json");
fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + "\n");

console.log(`✔ Generated component catalog: ${catalog.length} components → ${outPath}`);
