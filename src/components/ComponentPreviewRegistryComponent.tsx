"use client";

/**
 * ComponentPreviewRegistry — live demo renders for each library component.
 *
 * Keyed by the catalog name of every component the library exports (see
 * scripts/generate-component-catalog.mjs). Each entry shows the component in
 * a realistic but minimal configuration; components that need app context
 * (overlays, routers, providers, analytics, theme switching) get a short
 * static placeholder instead of a live instance.
 */

import {
  Plus,
  Edit,
  Trash2,
  Star,
  Settings,
  Search,
  Copy,
  Check,
  Bell,
  Home,
  FileText,
  Zap,
  Globe,
  Lock,
  ArrowLeft,
  Menu,
  MoreVertical,
  Share,
  Download,
  Bookmark,
  AlertCircle,
  Info,
  Blocks,
  MessageSquare,
  Palette,
  Activity,
  LayoutGrid,
  Table2,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  AvatarComponent,
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  ChartLineComponent,
  CheckboxComponent,
  ChipComponent,
  CloseButtonComponent,
  CollapsibleBlockComponent,
  CopyButtonComponent,
  DatePickerComponent,
  DividerComponent,
  EmptyStateComponent,
  ExtendedFabComponent,
  FabComponent,
  FormGroupComponent,
  InputComponent,
  LoadingIndicatorComponent,
  LoadingStateComponent,
  MultiSelectComponent,
  PageHeroComponent,
  PaginationComponent,
  ProgressBarComponent,
  RadioComponent,
  SearchInputComponent,
  SegmentedControlComponent,
  SelectComponent,
  SkeletonComponent,
  SliderComponent,
  SplitButtonComponent,
  StatBadgeComponent,
  StatsCardComponent,
  StatusDotComponent,
  StreamingCursorComponent,
  SwitchComponent,
  TabBarComponent,
  TextAreaComponent,
  TextFieldComponent,
  ToggleComponent,
  ToolCardComponent,
  ToolbarComponent,
  TooltipComponent,
  TopAppBarComponent,
  BottomAppBarComponent,
  NavigationRailComponent,
  IconButtonComponent,
  NavigationDrawerComponent,
} from "@rodrigo-barraza/components-library";

import styles from "./ComponentPreviewRegistryComponent.module.css";

// ── Helpers ──────────────────────────────────────────────────────
function PreviewRow({
  children,
  gap = 8,
}: {
  children: ReactNode;
  gap?: number;
}) {
  return (
    <div className={styles["preview-row"]} style={{ gap }}>
      {children}
    </div>
  );
}

function PreviewStack({
  children,
  gap = 8,
}: {
  children: ReactNode;
  gap?: number;
}) {
  return (
    <div
      className={`component-preview-registry-component ${styles["preview-stack"]}`}
      style={{ gap }}
    >
      {children}
    </div>
  );
}

function PreviewLabel({ children }: { children: ReactNode }) {
  return <span className={styles["preview-label"]}>{children}</span>;
}

/** Static stand-in for components that need app context to render. */
function PreviewPlaceholder({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles["preview-placeholder"]}>
      {icon}
      <span>{children}</span>
    </div>
  );
}

const noop = () => {};

// ── Preview Registry ─────────────────────────────────────────────
/** Render functions (no hooks) keyed by catalog component name. */
const PREVIEWS: Record<string, () => ReactNode> = {
  BadgeComponent: () => (
    <PreviewStack>
      <PreviewRow>
        <BadgeComponent>Default</BadgeComponent>
        <BadgeComponent variant="success">Active</BadgeComponent>
        <BadgeComponent variant="warning">Pending</BadgeComponent>
        <BadgeComponent variant="danger">Error</BadgeComponent>
        <BadgeComponent variant="info">Info</BadgeComponent>
      </PreviewRow>
      <PreviewRow>
        <BadgeComponent type="count" count={3} />
        <BadgeComponent type="count" count={42} state="new" />
        <BadgeComponent type="count" count="99+" rainbow />
        <BadgeComponent type="responseTime" ms={42} />
        <BadgeComponent type="responseTime" ms={1250} />
      </PreviewRow>
      <PreviewRow>
        <BadgeComponent
          type="visibility"
          visibility="external"
          icons={{ Globe, Lock }}
        />
        <BadgeComponent
          type="visibility"
          visibility="internal"
          icons={{ Globe, Lock }}
        />
      </PreviewRow>
    </PreviewStack>
  ),

  ButtonComponent: () => (
    <PreviewStack>
      <PreviewRow>
        <ButtonComponent variant="filled">Filled</ButtonComponent>
        <ButtonComponent variant="tonal">Tonal</ButtonComponent>
        <ButtonComponent variant="outlined">Outlined</ButtonComponent>
        <ButtonComponent variant="text">Text</ButtonComponent>
      </PreviewRow>
      <PreviewRow>
        <ButtonComponent variant="filled" icon={Plus} size="small">
          Small
        </ButtonComponent>
        <ButtonComponent variant="filled" disabled>
          Disabled
        </ButtonComponent>
      </PreviewRow>
    </PreviewStack>
  ),

  CardComponent: () => (
    <CardComponent>
      <div style={{ padding: "12px 16px", fontSize: 13 }}>
        <strong>Card Title</strong>
        <p style={{ margin: "6px 0 0", fontSize: 12, opacity: 0.7 }}>
          A surface container with elevation.
        </p>
      </div>
    </CardComponent>
  ),

  CheckboxComponent: () => (
    <PreviewStack gap={6}>
      <CheckboxComponent label="Enabled" checked={false} onChange={noop} />
      <CheckboxComponent label="Checked" checked={true} onChange={noop} />
      <CheckboxComponent
        label="Disabled"
        disabled
        checked={false}
        onChange={noop}
      />
    </PreviewStack>
  ),

  CloseButtonComponent: () => (
    <PreviewRow>
      <CloseButtonComponent onClick={noop} />
      <CloseButtonComponent onClick={noop} variant="dark" />
    </PreviewRow>
  ),

  CollapsibleBlockComponent: () => (
    <CollapsibleBlockComponent
      label="Collapsible Section"
      icon={<Info size={14} />}
    >
      <div style={{ padding: "8px 12px", fontSize: 12 }}>
        Content is revealed when expanded. Supports smooth height animations.
      </div>
    </CollapsibleBlockComponent>
  ),

  CopyButtonComponent: () => (
    <PreviewRow>
      <CopyButtonComponent text="Hello, World!" showLabel />
    </PreviewRow>
  ),

  DatePickerComponent: () => (
    <DatePickerComponent onChange={noop} placeholder="Select date…" />
  ),

  DialogComponent: () => (
    <div className={styles["preview-placeholder"]}>
      <AlertCircle size={16} />
      <span>Opens as overlay — click triggers required</span>
    </div>
  ),

  DiscordChatComponent: () => (
    <div className={styles["preview-placeholder"]}>
      <span>Requires Discord message data context</span>
    </div>
  ),

  DividerComponent: () => (
    <PreviewStack gap={12}>
      <PreviewLabel>Full width</PreviewLabel>
      <DividerComponent />
      <PreviewLabel>Inset</PreviewLabel>
      <DividerComponent variant="inset" />
    </PreviewStack>
  ),

  EmptyStateComponent: () => (
    <EmptyStateComponent
      icon={<FileText size={28} strokeWidth={1.2} />}
      title="Nothing here yet"
      subtitle="Create your first item to get started."
    />
  ),

  ExtendedFabComponent: () => (
    <PreviewRow>
      <ExtendedFabComponent icon={Plus} onClick={noop}>
        Create
      </ExtendedFabComponent>
      <ExtendedFabComponent icon={Edit} variant="secondary" onClick={noop}>
        Edit
      </ExtendedFabComponent>
    </PreviewRow>
  ),

  FabComponent: () => (
    <PreviewRow>
      <FabComponent icon={Plus} size="small" onClick={noop} />
      <FabComponent icon={Plus} onClick={noop} />
      <FabComponent icon={Plus} size="large" onClick={noop} />
      <FabComponent icon={Plus} color="tertiary" onClick={noop} />
    </PreviewRow>
  ),

  FabMenuComponent: () => (
    <div className={styles["preview-placeholder"]}>
      <Plus size={16} />
      <span>Expands radially on click — requires fixed positioning</span>
    </div>
  ),

  FormGroupComponent: () => (
    <FormGroupComponent
      label="Email Address"
      hint="We'll never share your email."
    >
      <InputComponent value="" onChange={noop} placeholder="you@example.com" />
    </FormGroupComponent>
  ),

  IconButtonComponent: () => (
    <PreviewRow>
      <IconButtonComponent
        icon={<Star size={14} />}
        onClick={noop}
        tooltip="Favorite"
      />
      <IconButtonComponent
        icon={<Copy size={14} />}
        onClick={noop}
        tooltip="Copy"
      />
      <IconButtonComponent
        icon={<Trash2 size={14} />}
        onClick={noop}
        variant="destructive"
        tooltip="Delete"
      />
      <IconButtonComponent
        icon={<Settings size={14} />}
        onClick={noop}
        disabled
      />
    </PreviewRow>
  ),

  InputComponent: () => (
    <PreviewStack>
      <InputComponent value="" onChange={noop} placeholder="Standard input…" />
      <InputComponent
        value=""
        onChange={noop}
        placeholder="With label…"
        label="Email"
      />
    </PreviewStack>
  ),

  LoadingIndicatorComponent: () => (
    <PreviewRow>
      <LoadingIndicatorComponent variant="circular" size="small" />
      <LoadingIndicatorComponent variant="circular" size="medium" />
      <LoadingIndicatorComponent variant="linear" />
    </PreviewRow>
  ),

  LoadingStateComponent: () => (
    <LoadingStateComponent message="Fetching data…" />
  ),

  MenuComponent: () => (
    <div className={styles["preview-placeholder"]}>
      <Menu size={16} />
      <span>Positioned popover — requires trigger click</span>
    </div>
  ),

  ModalComponent: () => (
    <div className={styles["preview-placeholder"]}>
      <span>Full-screen overlay — opens via state toggle</span>
    </div>
  ),

  NavigationDrawerComponent: () => (
    <div className={styles["preview-compact"]}>
      <NavigationDrawerComponent
        variant="standard"
        open={true}
        headline="Mail"
        style={{ height: "100%", width: 240 }}
      >
        <NavigationDrawerComponent.SectionHeader>
          Folders
        </NavigationDrawerComponent.SectionHeader>
        <NavigationDrawerComponent.Item
          icon={Home}
          label="Inbox"
          badge="24"
          active
        />
        <NavigationDrawerComponent.Item icon={FileText} label="Drafts" />
        <NavigationDrawerComponent.Item icon={Star} label="Starred" />
        <NavigationDrawerComponent.Divider />
        <NavigationDrawerComponent.SectionHeader>
          Labels
        </NavigationDrawerComponent.SectionHeader>
        <NavigationDrawerComponent.Item icon={Bell} label="Updates" badge="3" />
        <NavigationDrawerComponent.Item icon={Globe} label="Social" />
      </NavigationDrawerComponent>
    </div>
  ),

  NavigationRailComponent: () => (
    <div className={styles["preview-compact"]}>
      <NavigationRailComponent
        items={[
          { id: "home", label: "Home", icon: Home },
          { id: "search", label: "Search", icon: Search },
          { id: "settings", label: "Settings", icon: Settings },
        ]}
        activeItem="home"
        onNavigate={noop}
      />
    </div>
  ),

  NavigationSidebarComponent: () => (
    <div className={styles["preview-placeholder"]}>
      <Menu size={16} />
      <span>Full sidebar — used as page chrome</span>
    </div>
  ),

  PageHeaderComponent: () => (
    <div className={styles["preview-placeholder"]}>
      <span>Sticky page header — wraps title + actions</span>
    </div>
  ),

  PaginationComponent: () => (
    <PaginationComponent
      page={3}
      totalPages={10}
      totalItems={100}
      onPageChange={noop}
    />
  ),

  RadioComponent: () => (
    <PreviewStack gap={6}>
      <RadioComponent
        value="a"
        selectedValue="a"
        onChange={noop}
        label="Option A"
      />
      <RadioComponent
        value="b"
        selectedValue="a"
        onChange={noop}
        label="Option B"
      />
      <RadioComponent
        value="c"
        selectedValue="a"
        onChange={noop}
        label="Option C"
        disabled
      />
    </PreviewStack>
  ),

  SearchInputComponent: () => (
    <SearchInputComponent
      value=""
      onChange={noop}
      placeholder="Search anything…"
    />
  ),

  MultiSelectComponent: () => (
    <MultiSelectComponent
      value={["a"]}
      onChange={noop}
      options={[
        { value: "a", label: "Alpha" },
        { value: "b", label: "Bravo" },
        { value: "c", label: "Charlie" },
      ]}
      allLabel="All"
      label="Category"
    />
  ),

  SelectComponent: () => (
    <SelectComponent
      value=""
      onChange={noop}
      options={[
        { value: "opt1", label: "Option One" },
        { value: "opt2", label: "Option Two" },
        { value: "opt3", label: "Option Three" },
      ]}
      placeholder="Choose…"
      label="Sort by"
    />
  ),

  SliderComponent: () => (
    <PreviewStack>
      <SliderComponent value={40} min={0} max={100} onChange={noop} />
      <SliderComponent value={[20, 80]} min={0} max={100} onChange={noop} />
    </PreviewStack>
  ),

  SnackbarComponent: () => (
    <div className={styles["preview-placeholder"]}>
      <Bell size={16} />
      <span>Triggered via useSnackbar() hook</span>
    </div>
  ),

  SplitButtonComponent: () => (
    <PreviewRow>
      <SplitButtonComponent
        icon={Download}
        onClick={noop}
        onTrailingClick={noop}
      >
        Download
      </SplitButtonComponent>
      <SplitButtonComponent
        variant="outlined"
        icon={Share}
        onClick={noop}
        onTrailingClick={noop}
      >
        Share
      </SplitButtonComponent>
    </PreviewRow>
  ),

  StatsCardComponent: () => (
    <PreviewRow>
      <StatsCardComponent
        label="Requests"
        value="12.4k"
        icon={Zap}
        variant="accent"
        glow
      />
      <StatsCardComponent
        label="Uptime"
        value="99.9%"
        icon={Check}
        variant="success"
      />
    </PreviewRow>
  ),

  SwitchComponent: () => (
    <PreviewStack gap={6}>
      <SwitchComponent label="Enabled" checked={true} onChange={noop} />
      <SwitchComponent label="Disabled" checked={false} onChange={noop} />
      <SwitchComponent
        label="Inactive"
        checked={false}
        onChange={noop}
        disabled
      />
    </PreviewStack>
  ),

  TabBarComponent: () => (
    <TabBarComponent
      tabs={[
        { key: "overview", label: "Overview" },
        { key: "details", label: "Details" },
        { key: "settings", label: "Settings" },
      ]}
      activeTab="overview"
      onChange={noop}
    />
  ),

  TableComponent: () => (
    <div className={styles["preview-placeholder"]}>
      <FileText size={16} />
      <span>Data table — requires columns + rows config</span>
    </div>
  ),

  TextAreaComponent: () => (
    <TextAreaComponent
      value=""
      onChange={noop}
      placeholder="Write something…"
      minRows={2}
      maxRows={4}
    />
  ),

  TextFieldComponent: () => (
    <PreviewStack>
      <TextFieldComponent
        value=""
        onChange={noop}
        label="Label"
        placeholder="Enter text…"
      />
      <TextFieldComponent value="Filled" onChange={noop} label="With value" />
    </PreviewStack>
  ),

  ToastComponent: () => (
    <div className={styles["preview-placeholder"]}>
      <Bell size={16} />
      <span>Triggered via useToast() hook</span>
    </div>
  ),

  ToggleComponent: () => (
    <PreviewRow>
      <ToggleComponent checked={true} onChange={noop} label="On" />
      <ToggleComponent checked={false} onChange={noop} label="Off" />
    </PreviewRow>
  ),

  ToolbarComponent: () => (
    <ToolbarComponent>
      <ButtonComponent variant="text" size="small" icon={ArrowLeft}>
        Back
      </ButtonComponent>
      <span style={{ flex: 1 }} />
      <IconButtonComponent icon={<Bookmark size={14} />} onClick={noop} />
      <IconButtonComponent icon={<MoreVertical size={14} />} onClick={noop} />
    </ToolbarComponent>
  ),

  TooltipComponent: () => (
    <PreviewRow>
      <TooltipComponent label="I'm a tooltip!" position="top">
        <ButtonComponent variant="outlined" size="small">
          Hover me
        </ButtonComponent>
      </TooltipComponent>
    </PreviewRow>
  ),

  TopAppBarComponent: () => (
    <TopAppBarComponent
      variant="small"
      title="App Title"
      navigationIcon={<ArrowLeft size={20} />}
      onNavigationClick={noop}
      position="static"
    >
      <TopAppBarComponent.Action
        icon={Search}
        ariaLabel="Search"
        onClick={noop}
      />
      <TopAppBarComponent.Action
        icon={MoreVertical}
        ariaLabel="More"
        onClick={noop}
      />
    </TopAppBarComponent>
  ),

  BottomAppBarComponent: () => (
    <BottomAppBarComponent position="relative" hideOnScroll={false}>
      <IconButtonComponent icon={<Search size={18} />} onClick={noop} />
      <IconButtonComponent icon={<Trash2 size={18} />} onClick={noop} />
      <IconButtonComponent icon={<Share size={18} />} onClick={noop} />
    </BottomAppBarComponent>
  ),

  CarouselComponent: () => (
    <div className={styles["preview-placeholder"]}>
      <span>Multi-item carousel — requires item content</span>
    </div>
  ),

  AvatarComponent: () => (
    <PreviewRow>
      <AvatarComponent name="Ada Lovelace" size="sm" />
      <AvatarComponent name="Grace Hopper" status="online" />
      <AvatarComponent icon={Star} size="lg" />
    </PreviewRow>
  ),

  ChartLineComponent: () => (
    <ChartLineComponent
      data={[12, 18, 15, 26, 22, 31, 28, 36, 33, 41]}
      maxValue={50}
      height={48}
    />
  ),

  ChipComponent: () => (
    <PreviewRow gap={6}>
      <ChipComponent variant="assist" icon={Star}>
        Assist
      </ChipComponent>
      <ChipComponent variant="filter" selected>
        Selected
      </ChipComponent>
      <ChipComponent variant="input" removable onRemove={noop}>
        Removable
      </ChipComponent>
    </PreviewRow>
  ),

  PageHeroComponent: () => (
    <PageHeroComponent
      icon={Blocks}
      title="Page title"
      subtitle="In-content page introduction."
      stats={[
        { value: 42, label: "items" },
        { value: 3, label: "errors", variant: "danger" },
      ]}
    />
  ),

  ProgressBarComponent: () => (
    <PreviewStack gap={10}>
      <ProgressBarComponent value={64} showValue label="Upload" />
      <ProgressBarComponent value={null} />
    </PreviewStack>
  ),

  SegmentedControlComponent: () => (
    <SegmentedControlComponent
      value="grid"
      onChange={noop}
      segments={[
        { value: "grid", label: "Cards", icon: <LayoutGrid size={12} /> },
        { value: "table", label: "Table", icon: <Table2 size={12} /> },
      ]}
    />
  ),

  SkeletonComponent: () => (
    <PreviewRow gap={12}>
      <SkeletonComponent variant="avatar" />
      <div style={{ flex: 1 }}>
        <SkeletonComponent variant="text" lines={2} />
      </div>
    </PreviewRow>
  ),

  StatBadgeComponent: () => (
    <PreviewRow>
      <StatBadgeComponent value={42} label="models" />
      <StatBadgeComponent
        value="99.9%"
        label="uptime"
        variant="success"
        icon={Activity}
      />
    </PreviewRow>
  ),

  StatusDotComponent: () => (
    <PreviewRow gap={14}>
      <StatusDotComponent variant="healthy" />
      <StatusDotComponent variant="warning" />
      <StatusDotComponent variant="unhealthy" />
      <StatusDotComponent variant="inactive" pulse={false} />
    </PreviewRow>
  ),

  StreamingCursorComponent: () => (
    <PreviewRow>
      <span style={{ fontSize: 13 }}>
        Streaming a response
        <StreamingCursorComponent active />
      </span>
    </PreviewRow>
  ),

  ToolCardComponent: () => (
    <ToolCardComponent
      name="get_weather"
      description="Current conditions for a city."
      emoji="🌤️"
      domain="weather"
    />
  ),

  AgentChatWindowComponent: () => (
    <PreviewPlaceholder icon={<MessageSquare size={16} />}>
      Streams from prism-service — needs a live service URL
    </PreviewPlaceholder>
  ),

  AgentChatMessageListComponent: () => (
    <PreviewPlaceholder icon={<MessageSquare size={16} />}>
      Message list of the agent chat window
    </PreviewPlaceholder>
  ),

  AgentChatInputComponent: () => (
    <PreviewPlaceholder icon={<MessageSquare size={16} />}>
      Input of the agent chat window
    </PreviewPlaceholder>
  ),

  CustomThemeBootComponent: () => (
    <PreviewPlaceholder icon={<Palette size={16} />}>
      Invisible — injects custom theme styles on mount
    </PreviewPlaceholder>
  ),

  DrawerComponent: () => (
    <PreviewPlaceholder>
      Slides in over the page — opens via state
    </PreviewPlaceholder>
  ),

  ErrorBoundaryComponent: () => (
    <PreviewPlaceholder icon={<AlertCircle size={16} />}>
      Catches render errors — wraps each preview on this page
    </PreviewPlaceholder>
  ),

  ErrorFallbackComponent: () => (
    <PreviewPlaceholder icon={<AlertCircle size={16} />}>
      Recovery UI for Next.js error.js boundaries
    </PreviewPlaceholder>
  ),

  LayoutHeaderComponent: () => (
    <PreviewPlaceholder>
      Page header bar — used as page chrome
    </PreviewPlaceholder>
  ),

  MarkdownContentComponent: () => (
    <PreviewPlaceholder icon={<FileText size={16} />}>
      Renders markdown with LaTeX, Mermaid and embeds
    </PreviewPlaceholder>
  ),

  MobileHeaderComponent: () => (
    <PreviewPlaceholder icon={<Menu size={16} />}>
      Compact top bar — shown on mobile viewports
    </PreviewPlaceholder>
  ),

  PageLayoutComponent: () => (
    <PreviewPlaceholder icon={<Menu size={16} />}>
      Sidebar + header + main — the chrome of this portal
    </PreviewPlaceholder>
  ),

  SessionTrackerComponent: () => (
    <PreviewPlaceholder icon={<Activity size={16} />}>
      Invisible — sends session telemetry
    </PreviewPlaceholder>
  ),

  ThemePickerComponent: () => (
    <PreviewPlaceholder icon={<Palette size={16} />}>
      Theme dropup — in this sidebar&apos;s footer
    </PreviewPlaceholder>
  ),

  ThemeToggleButtonComponent: () => (
    <PreviewPlaceholder icon={<Palette size={16} />}>
      Cycles the app theme on click
    </PreviewPlaceholder>
  ),

  ThemeProvider: () => (
    <div className={styles["preview-placeholder"]}>
      <Settings size={16} />
      <span>Context provider — wraps app for theming</span>
    </div>
  ),
};

/** Whether the registry has a live demo for this catalog component. */
export function hasPreview(componentName: string): boolean {
  return Object.hasOwn(PREVIEWS, componentName);
}

/**
 * Renders the live demo of a catalog component (nothing when there is
 * none). Rendering happens inside this component, so an error boundary
 * around it catches a demo that throws.
 */
export function ComponentPreviewDemo({ name }: { name: string }) {
  return hasPreview(name) ? PREVIEWS[name]() : null;
}
