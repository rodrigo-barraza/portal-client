"use client";

/**
 * ComponentPreviewRegistry — live demo renders for each component.
 *
 * Each entry is a React element showing the component in a realistic
 * but minimal configuration. Components that require complex context
 * (providers, modals, routers) get a simplified static demo instead.
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
} from "lucide-react";
import type { ReactNode } from "react";

import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  CheckboxComponent,
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
  PaginationComponent,
  RadioComponent,
  SearchInputComponent,
  SelectComponent,
  SliderComponent,
  SplitButtonComponent,
  StatsCardComponent,
  SwitchComponent,
  TabBarComponent,
  TextAreaComponent,
  TextFieldComponent,
  ToggleComponent,
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
    <div className={styles.previewRow} style={{ gap }}>
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
    <div className={styles.previewStack} style={{ gap }}>
      {children}
    </div>
  );
}

function PreviewLabel({ children }: { children: ReactNode }) {
  return <span className={styles.previewLabel}>{children}</span>;
}

// ── Preview Registry ─────────────────────────────────────────────
const PREVIEWS = {
  BadgeComponent: () => (
    <PreviewRow>
      <BadgeComponent>Default</BadgeComponent>
      <BadgeComponent variant="success">Active</BadgeComponent>
      <BadgeComponent variant="warning">Pending</BadgeComponent>
      <BadgeComponent variant="danger">Error</BadgeComponent>
      <BadgeComponent variant="info">Info</BadgeComponent>
    </PreviewRow>
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
      <CheckboxComponent label="Enabled" checked={false} onChange={() => {}} />
      <CheckboxComponent label="Checked" checked={true} onChange={() => {}} />
      <CheckboxComponent
        label="Disabled"
        disabled
        checked={false}
        onChange={() => {}}
      />
    </PreviewStack>
  ),

  CloseButtonComponent: () => (
    <PreviewRow>
      <CloseButtonComponent onClick={() => {}} />
      <CloseButtonComponent onClick={() => {}} variant="dark" />
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

  CountBadgeComponent: () => (
    <PreviewRow>
      <BadgeComponent type="count" count={3} />
      <BadgeComponent type="count" count={42} state="new" />
      <BadgeComponent type="count" count="99+" rainbow />
    </PreviewRow>
  ),

  DatePickerComponent: () => (
    <DatePickerComponent
      value=""
      onChange={() => {}}
      placeholder="Select date…"
    />
  ),

  DialogComponent: () => (
    <div className={styles.previewPlaceholder}>
      <AlertCircle size={16} />
      <span>Opens as overlay — click triggers required</span>
    </div>
  ),

  DiscordChatComponent: () => (
    <div className={styles.previewPlaceholder}>
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
      <ExtendedFabComponent icon={Plus} onClick={() => {}}>
        Create
      </ExtendedFabComponent>
      <ExtendedFabComponent icon={Edit} variant="secondary" onClick={() => {}}>
        Edit
      </ExtendedFabComponent>
    </PreviewRow>
  ),

  FabComponent: () => (
    <PreviewRow>
      <FabComponent icon={Plus} size="small" onClick={() => {}} />
      <FabComponent icon={Plus} onClick={() => {}} />
      <FabComponent icon={Plus} size="large" onClick={() => {}} />
      <FabComponent icon={Plus} color="tertiary" onClick={() => {}} />
    </PreviewRow>
  ),

  FabMenuComponent: () => (
    <div className={styles.previewPlaceholder}>
      <Plus size={16} />
      <span>Expands radially on click — requires fixed positioning</span>
    </div>
  ),

  FormGroupComponent: () => (
    <FormGroupComponent
      label="Email Address"
      hint="We'll never share your email."
    >
      <InputComponent
        value=""
        onChange={() => {}}
        placeholder="you@example.com"
      />
    </FormGroupComponent>
  ),

  IconButtonComponent: () => (
    <PreviewRow>
      <IconButtonComponent
        icon={<Star size={14} />}
        onClick={() => {}}
        tooltip="Favorite"
      />
      <IconButtonComponent
        icon={<Copy size={14} />}
        onClick={() => {}}
        tooltip="Copy"
      />
      <IconButtonComponent
        icon={<Trash2 size={14} />}
        onClick={() => {}}
        variant="destructive"
        tooltip="Delete"
      />
      <IconButtonComponent
        icon={<Settings size={14} />}
        onClick={() => {}}
        disabled
      />
    </PreviewRow>
  ),

  InputComponent: () => (
    <PreviewStack>
      <InputComponent
        value=""
        onChange={() => {}}
        placeholder="Standard input…"
      />
      <InputComponent
        value=""
        onChange={() => {}}
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
    <div className={styles.previewPlaceholder}>
      <Menu size={16} />
      <span>Positioned popover — requires trigger click</span>
    </div>
  ),

  ModalComponent: () => (
    <div className={styles.previewPlaceholder}>
      <span>Full-screen overlay — opens via state toggle</span>
    </div>
  ),

  NavigationDrawerComponent: () => (
    <div className={styles.previewCompact}>
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
    <div className={styles.previewCompact}>
      <NavigationRailComponent
        items={[
          { id: "home", label: "Home", icon: Home },
          { id: "search", label: "Search", icon: Search },
          { id: "settings", label: "Settings", icon: Settings },
        ]}
        activeItem="home"
        onNavigate={() => {}}
      />
    </div>
  ),

  NavigationSidebarComponent: () => (
    <div className={styles.previewPlaceholder}>
      <Menu size={16} />
      <span>Full sidebar — used as page chrome</span>
    </div>
  ),

  PageHeaderComponent: () => (
    <div className={styles.previewPlaceholder}>
      <span>Sticky page header — wraps title + actions</span>
    </div>
  ),

  PaginationComponent: () => (
    <PaginationComponent
      currentPage={3}
      totalPages={10}
      onPageChange={() => {}}
    />
  ),

  RadioComponent: () => (
    <PreviewStack gap={6}>
      <RadioComponent
        value="a"
        selectedValue="a"
        onChange={() => {}}
        label="Option A"
      />
      <RadioComponent
        value="b"
        selectedValue="a"
        onChange={() => {}}
        label="Option B"
      />
      <RadioComponent
        value="c"
        selectedValue="a"
        onChange={() => {}}
        label="Option C"
        disabled
      />
    </PreviewStack>
  ),

  ResponseTimeBadgeComponent: () => (
    <PreviewRow>
      <BadgeComponent type="responseTime" ms={42} />
      <BadgeComponent type="responseTime" ms={180} />
      <BadgeComponent type="responseTime" ms={1250} />
    </PreviewRow>
  ),

  SearchInputComponent: () => (
    <SearchInputComponent
      value=""
      onChange={() => {}}
      placeholder="Search anything…"
    />
  ),

  MultiSelectComponent: () => (
    <PreviewStack>
      <SelectComponent
        multiple
        value={[]}
        onChange={() => {}}
        options={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Bravo" },
          { value: "c", label: "Charlie" },
        ]}
        allLabel="All"
        label="Category"
      />
    </PreviewStack>
  ),

  SelectComponent: () => (
    <SelectComponent
      value=""
      onChange={() => {}}
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
      <SliderComponent value={40} min={0} max={100} onChange={() => {}} />
      <SliderComponent value={[20, 80]} min={0} max={100} onChange={() => {}} />
    </PreviewStack>
  ),

  SnackbarComponent: () => (
    <div className={styles.previewPlaceholder}>
      <Bell size={16} />
      <span>Triggered via useSnackbar() hook</span>
    </div>
  ),

  SplitButtonComponent: () => (
    <PreviewRow>
      <SplitButtonComponent
        icon={Download}
        onClick={() => {}}
        onTrailingClick={() => {}}
      >
        Download
      </SplitButtonComponent>
      <SplitButtonComponent
        variant="outlined"
        icon={Share}
        onClick={() => {}}
        onTrailingClick={() => {}}
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
      <SwitchComponent label="Enabled" checked={true} onChange={() => {}} />
      <SwitchComponent label="Disabled" checked={false} onChange={() => {}} />
      <SwitchComponent
        label="Inactive"
        checked={false}
        onChange={() => {}}
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
      onChange={() => {}}
    />
  ),

  TableComponent: () => (
    <div className={styles.previewPlaceholder}>
      <FileText size={16} />
      <span>Data table — requires columns + rows config</span>
    </div>
  ),

  TextAreaComponent: () => (
    <TextAreaComponent
      value=""
      onChange={() => {}}
      placeholder="Write something…"
      minRows={2}
      maxRows={4}
    />
  ),

  TextFieldComponent: () => (
    <PreviewStack>
      <TextFieldComponent
        value=""
        onChange={() => {}}
        label="Label"
        placeholder="Enter text…"
      />
      <TextFieldComponent
        value="Filled"
        onChange={() => {}}
        label="With value"
      />
    </PreviewStack>
  ),

  ToastComponent: () => (
    <div className={styles.previewPlaceholder}>
      <Bell size={16} />
      <span>Triggered via useToast() hook</span>
    </div>
  ),

  ToggleComponent: () => (
    <PreviewRow>
      <ToggleComponent checked={true} onChange={() => {}} label="On" />
      <ToggleComponent checked={false} onChange={() => {}} label="Off" />
    </PreviewRow>
  ),

  ToolbarComponent: () => (
    <ToolbarComponent>
      <ButtonComponent variant="text" size="small" icon={ArrowLeft}>
        Back
      </ButtonComponent>
      <span style={{ flex: 1 }} />
      <IconButtonComponent icon={<Bookmark size={14} />} onClick={() => {}} />
      <IconButtonComponent
        icon={<MoreVertical size={14} />}
        onClick={() => {}}
      />
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
      onNavigationClick={() => {}}
      position="static"
    >
      <TopAppBarComponent.Action
        icon={<Search size={20} />}
        ariaLabel="Search"
        onClick={() => {}}
      />
      <TopAppBarComponent.Action
        icon={<MoreVertical size={20} />}
        ariaLabel="More"
        onClick={() => {}}
      />
    </TopAppBarComponent>
  ),

  BottomAppBarComponent: () => (
    <BottomAppBarComponent position="relative" hideOnScroll={false}>
      <IconButtonComponent icon={<Search size={18} />} onClick={() => {}} />
      <IconButtonComponent icon={<Trash2 size={18} />} onClick={() => {}} />
      <IconButtonComponent icon={<Share size={18} />} onClick={() => {}} />
    </BottomAppBarComponent>
  ),

  CarouselComponent: () => (
    <div className={styles.previewPlaceholder}>
      <span>Multi-item carousel — requires item content</span>
    </div>
  ),

  VisibilityBadgeComponent: () => (
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
  ),

  ThemeProvider: () => (
    <div className={styles.previewPlaceholder}>
      <Settings size={16} />
      <span>Context provider — wraps app for theming</span>
    </div>
  ),
};

/**
 * Get the preview renderer for a given component name.
 * Returns null if no preview is available.
 */
export function getPreview(componentName: string) {
  return PREVIEWS[componentName as keyof typeof PREVIEWS] || null;
}

export default PREVIEWS;
