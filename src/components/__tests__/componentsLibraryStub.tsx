/**
 * Minimal stand-ins for @rodrigo-barraza/components-library, for component
 * tests. vitest externalizes node_modules and the library's dist imports
 * its `.module.css` files, which Node cannot load — so tests that render
 * library components swap the module for these accessible equivalents:
 *
 *   vi.mock("@rodrigo-barraza/components-library", () => import("<path>/componentsLibraryStub"));
 */

import type { ReactNode } from "react";

type Children = { children?: ReactNode };

export function ButtonComponent({
  children,
  onClick,
  href,
  disabled,
  loading,
}: Children & {
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: string;
  size?: string;
  icon?: unknown;
}) {
  if (href) return <a href={href}>{children}</a>;
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-busy={loading || undefined}>
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
  icon: ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
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
  return <div role="status">{label}</div>;
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

export function BadgeComponent({ children }: Children & { variant?: string }) {
  return <span>{children}</span>;
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
  label: ReactNode;
  render?: (row: Row) => ReactNode;
}

export function TableComponent<Row>({
  columns,
  data,
  getRowKey,
  emptyText,
}: {
  columns: StubColumn<Row>[];
  data: Row[];
  getRowKey: (row: Row) => string;
  emptyText?: string;
}) {
  if (data.length === 0) return <p>{emptyText}</p>;
  return (
    <table>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={getRowKey(row)}>
            {columns.map((column) => (
              <td key={column.key}>
                {column.render
                  ? column.render(row)
                  : String((row as Record<string, unknown>)[column.key] ?? "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
