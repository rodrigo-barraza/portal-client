import fs from "node:fs";
import path from "node:path";
import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import ComponentsComponent from "@/components/ComponentsComponent";

export const metadata = {
  title: "Components — Portal",
};

// ── Category map ─────────────────────────────────────────────────
// Domain knowledge that can't be reliably inferred from code.
// Everything else (name, files, size, tests, M3, description) is
// derived programmatically from the installed package.

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

/**
 * Scan the installed @rodrigo-barraza/components package and build
 * a component catalog from the filesystem at server-render time.
 */
function scanComponentLibrary() {
  // Resolve the package's index.js, then navigate to /src/components
  const indexPath = require.resolve("@rodrigo-barraza/components");
  const componentsDir = path.resolve(path.dirname(indexPath), "components");

  if (!fs.existsSync(componentsDir)) return [];

  const entries = fs.readdirSync(componentsDir, { withFileTypes: true });
  const catalog = [];

  for (const entry of entries) {
    // Skip non-directories and the standalone ComponentsProvider.js
    if (!entry.isDirectory()) continue;

    const dirPath = path.join(componentsDir, entry.name);
    const files = fs.readdirSync(dirPath);

    // File counts
    const jsFiles = files.filter((f) => f.endsWith(".js"));
    const testFiles = files.filter(
      (f) => f.includes(".test.") || f.includes(".spec.")
    );

    // Total size in bytes
    const totalBytes = files.reduce((sum, f) => {
      try {
        return sum + fs.statSync(path.join(dirPath, f)).size;
      } catch {
        return sum;
      }
    }, 0);

    // Read main JS file and extract description + M3 compliance
    const mainJsFile = jsFiles.find(
      (f) => !f.includes(".test.") && !f.includes(".spec.")
    );
    let description = "";
    let m3 = false;

    if (mainJsFile) {
      try {
        const source = fs.readFileSync(path.join(dirPath, mainJsFile), "utf8");

        // M3 detection: look for M3 indicators in comments/code
        m3 =
          source.includes("m3.material.io") ||
          /Material Design 3/i.test(source) ||
          /\bM3\b/.test(source.slice(0, 2000));

        // Extract description from JSDoc or first block comment
        // Pattern: first line after "* ComponentName —" or "* ComponentName -"
        const dashMatch = source.match(
          /\*\s+\w+\s*[—–-]\s*(.+?)(?:\n|\*\/)/
        );
        if (dashMatch) {
          description = dashMatch[1].trim();
        } else {
          // Fallback: first @description or first sentence in JSDoc
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

  // Sort alphabetically by name
  return catalog.sort((a, b) => a.name.localeCompare(b.name));
}

export default function ComponentsPage() {
  const catalog = scanComponentLibrary();

  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <ComponentsComponent catalog={catalog} />
      </main>
    </div>
  );
}
