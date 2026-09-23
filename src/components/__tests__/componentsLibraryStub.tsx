/**
 * The one set of stand-ins for @rodrigo-barraza/components-library in
 * component tests. The real library needs ResizeObserver / canvas and
 * sound, and its dist imports `.module.css`, so tests that render portal
 * components swap the module for these plain, accessible elements:
 *
 *   vi.mock("@rodrigo-barraza/components-library", () => import("<path>/components/__tests__/componentsLibraryStub"));
 *
 * Each stub keeps the library's accessible roles (alertdialog, progressbar,
 * radiogroup, searchbox, tablist) and only the behaviour tests exercise —
 * labels, click handlers, disabled state, table rows, dialog
 * confirm/cancel, toasts. Add to this file; never start a second stub.
 */

import { useCallback, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

type Children = { children?: ReactNode };

export function ButtonComponent({
  children,
  onClick,
  href,
  disabled,
  loading,
  title,
  "aria-label": ariaLabel,
}: Children & {
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  href?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: string;
  size?: string;
  icon?: unknown;
  title?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const label = ariaLabel ?? title;
  if (href) {
    return (
      <a href={href} aria-label={label} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      aria-busy={loading || undefined}
    >
      {children}
    </button>
  );
}

export function IconButtonComponent({
  icon,
  onClick,
  tooltip,
  disabled,
  ...rest
}: {
  icon?: ReactNode;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  tooltip?: string;
  disabled?: boolean;
  variant?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      title={tooltip}
      aria-label={rest["aria-label"] ?? tooltip}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
    </button>
  );
}

export function LoadingIndicatorComponent({ label }: { label?: string; size?: string; className?: string }) {
  return <div role="progressbar">{label}</div>;
}

export function StatsCardComponent({
  label,
  value,
  subtitle,
}: {
  label?: ReactNode;
  value?: ReactNode;
  subtitle?: ReactNode;
  icon?: unknown;
  variant?: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <span>{value}</span>
      <span>{subtitle}</span>
    </div>
  );
}

export function SelectComponent({
  value,
  options,
  onChange,
  placeholder,
  label,
}: {
  value?: string | string[];
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  if (Array.isArray(value)) return null;
  return (
    <select
      aria-label={label ?? placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function TabBarComponent({
  tabs,
  activeTab,
  onChange,
  ariaLabel,
}: {
  tabs: { key: string; label: ReactNode }[];
  activeTab?: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === activeTab}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function DrawerComponent({
  open,
  title,
  headerActions,
  children,
}: Children & { open: boolean; title?: string; headerActions?: ReactNode; onClose?: () => void }) {
  if (!open) return null;
  return (
    <aside aria-label={title}>
      {headerActions}
      {children}
    </aside>
  );
}

export function SearchInputComponent({
  value = "",
  onChange,
  placeholder,
}: {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  compact?: boolean;
  id?: string;
}) {
  return (
    <input
      type="search"
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}

export function SegmentedControlComponent({
  value,
  onChange,
  segments,
}: {
  value: string;
  onChange: (value: string) => void;
  segments: { value: string; label?: ReactNode; icon?: ReactNode }[];
  compact?: boolean;
}) {
  return (
    <div role="radiogroup">
      {segments.map((segment) => (
        <button
          key={segment.value}
          type="button"
          role="radio"
          aria-checked={segment.value === value}
          aria-label={typeof segment.label === "string" ? segment.label : segment.value}
          onClick={() => segment.value !== value && onChange(segment.value)}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}

export function ToggleComponent({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label?: ReactNode;
  size?: string;
}) {
  return (
    <label>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

export function EmptyStateComponent({
  icon,
  title,
  subtitle,
  children,
}: Children & { icon?: ReactNode; title?: ReactNode; subtitle?: ReactNode; className?: string }) {
  return (
    <div>
      {icon}
      {title && <h2>{title}</h2>}
      {subtitle && <p>{subtitle}</p>}
      {children}
    </div>
  );
}

export function PageHeaderComponent({
  title,
  subtitle,
  children,
}: Children & { title?: ReactNode; subtitle?: ReactNode; sticky?: boolean }) {
  return (
    <header>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      {children}
    </header>
  );
}

export function ModalComponent({
  title,
  children,
  footer,
  onClose,
}: Children & { title?: ReactNode; footer?: ReactNode; onClose: () => void; size?: string; className?: string }) {
  return (
    <div role="dialog" aria-label={typeof title === "string" ? title : undefined}>
      <h2>{title}</h2>
      {children}
      {footer}
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

export function DialogComponent({
  open,
  onClose,
  headline,
  onConfirm,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  confirmDisabled,
  children,
}: Children & {
  open: boolean;
  onClose: () => void;
  headline?: ReactNode;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  confirmVariant?: string;
  icon?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div role="alertdialog" aria-label={typeof headline === "string" ? headline : undefined}>
      <h2>{headline}</h2>
      <div>{children}</div>
      <button type="button" onClick={onClose}>
        {cancelLabel}
      </button>
      <button type="button" onClick={onConfirm} disabled={confirmDisabled}>
        {confirmLabel}
      </button>
    </div>
  );
}

/** Typed badges render what the real one shows: status words or their one value. */
export function BadgeComponent({
  children,
  type,
  healthy,
  ...rest
}: Children & {
  variant?: string;
  type?: string;
  healthy?: boolean;
  device?: ReactNode;
  domain?: ReactNode;
  port?: ReactNode;
  address?: ReactNode;
  visibility?: ReactNode;
  icons?: unknown;
}) {
  if (type === "status") return <span>{healthy ? "Healthy" : "Down"}</span>;
  const shown = rest.device ?? rest.domain ?? rest.port ?? rest.address ?? rest.visibility;
  return <span>{children ?? shown ?? null}</span>;
}

export function StatusDotComponent({ variant }: { variant?: string; size?: string; pulse?: boolean }) {
  return <span data-status={variant} />;
}

export function CollapsibleBlockComponent({
  label,
  badge,
  children,
}: Children & { label?: ReactNode; badge?: ReactNode; defaultCollapsed?: boolean }) {
  return (
    <section>
      <h3>
        {label} {badge}
      </h3>
      {children}
    </section>
  );
}

export function ChartLineComponent({ data }: { data: number[] }) {
  return <div data-testid="chart-line" data-points={data.join(",")} />;
}

interface StubColumn<Row> {
  key: string;
  label?: ReactNode;
  render?: (row: Row, index: number) => ReactNode;
}

export function TableComponent<Row>({
  columns,
  data,
  getRowKey,
  emptyText,
  onRowClick,
  title,
}: {
  columns: StubColumn<Row>[];
  data: Row[] | null | undefined;
  getRowKey: (row: Row, index: number) => string;
  emptyText?: string;
  onRowClick?: (row: Row) => void;
  title?: string;
}) {
  const rows = data ?? [];
  if (rows.length === 0) return <p>{emptyText}</p>;
  // Clickable rows answer Enter/Space like the library's interactive rows.
  const rowProps = (row: Row) =>
    onRowClick
      ? {
          onClick: () => onRowClick(row),
          onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
            if (event.key === "Enter" || event.key === " ") onRowClick(row);
          },
        }
      : {};
  return (
    <table aria-label={title}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={getRowKey(row, index)} {...rowProps(row)}>
            {columns.map((column) => (
              <td key={column.key}>
                {column.render
                  ? column.render(row, index)
                  : String((row as Record<string, unknown>)[column.key] ?? "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface StubToast {
  id: number;
  message: string;
  type: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<StubToast[]>([]);
  const addToast = useCallback((message: string, type = "info") => {
    setToasts((previous) => [...previous, { id: previous.length + 1, message, type }]);
  }, []);
  const removeToast = useCallback((id: number) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);
  return { toasts, addToast, removeToast };
}

export function ToastComponent({ toasts }: { toasts?: StubToast[]; onDismiss?: (id: number) => void }) {
  return (
    <div>
      {(toasts ?? []).map((toast) => (
        <div key={toast.id} role="status" data-type={toast.type}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
