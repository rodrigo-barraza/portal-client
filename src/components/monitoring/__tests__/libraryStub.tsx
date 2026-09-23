/**
 * Minimal stand-ins for @rodrigo-barraza/components-library in component
 * tests. vitest externalizes the library (its dist imports raw .css and
 * needs ResizeObserver / canvas), so tests that render portal components
 * mock it with these plain elements:
 *
 *   vi.mock("@rodrigo-barraza/components-library", () => import("<path>/monitoring/__tests__/libraryStub"));
 *
 * Each stub keeps only the behaviour the tests exercise — labels, click
 * handlers, disabled state, table rows, dialog confirm/cancel.
 */
import { useCallback, useState, type MouseEvent, type ReactNode } from "react";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

export function ButtonComponent({
  children,
  onClick,
  disabled,
  loading,
  href,
  title,
  "aria-label": ariaLabel,
}: AnyProps) {
  const label = (ariaLabel as string | undefined) ?? (title as string | undefined);
  if (href) {
    return (
      <a href={href as string} aria-label={label} onClick={onClick as never}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      disabled={Boolean(disabled)}
      data-loading={loading ? "true" : undefined}
      onClick={onClick as (event: MouseEvent<HTMLButtonElement>) => void}
    >
      {children}
    </button>
  );
}

export function IconButtonComponent({ onClick, disabled, tooltip, "aria-label": ariaLabel }: AnyProps) {
  return (
    <button
      type="button"
      aria-label={(ariaLabel as string | undefined) ?? (tooltip as string)}
      disabled={Boolean(disabled)}
      onClick={onClick as () => void}
    />
  );
}

export function BadgeComponent({ type, healthy, children, ...rest }: AnyProps) {
  if (type === "status") return <span>{healthy ? "Healthy" : "Down"}</span>;
  const shown = rest.device ?? rest.domain ?? rest.port ?? rest.address ?? rest.visibility;
  return <span>{children ?? (shown as ReactNode) ?? null}</span>;
}

export function PageHeaderComponent({ title, subtitle }: AnyProps) {
  return (
    <header>
      <h1>{title as ReactNode}</h1>
      <p>{subtitle as ReactNode}</p>
    </header>
  );
}

export function LoadingIndicatorComponent({ label }: AnyProps) {
  return <div role="progressbar">{label as ReactNode}</div>;
}

export function StatsCardComponent({ label, value, subtitle }: AnyProps) {
  return (
    <div>
      <span>{label as ReactNode}</span>
      <span>{value as ReactNode}</span>
      <span>{subtitle as ReactNode}</span>
    </div>
  );
}

export function ChartLineComponent() {
  return null;
}

export function SearchInputComponent({ value, onChange, placeholder }: AnyProps) {
  return (
    <input
      value={value as string}
      placeholder={placeholder as string}
      onChange={(event) => (onChange as (value: string) => void)(event.target.value)}
    />
  );
}

export function SelectComponent({ value, options, onChange, placeholder, label }: AnyProps) {
  if (Array.isArray(value)) return null;
  return (
    <select
      aria-label={(label as string | undefined) ?? (placeholder as string | undefined)}
      value={value as string}
      onChange={(event) => (onChange as (value: string) => void)(event.target.value)}
    >
      <option value="">{placeholder as string}</option>
      {(options as { value: string; label: string }[]).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function SegmentedControlComponent({ segments, onChange }: AnyProps) {
  return (
    <div>
      {(segments as { value: string }[]).map((segment) => (
        <button
          key={segment.value}
          type="button"
          aria-label={`View ${segment.value}`}
          onClick={() => (onChange as (value: string) => void)(segment.value)}
        />
      ))}
    </div>
  );
}

export function TabBarComponent({ tabs, onChange }: AnyProps) {
  return (
    <div role="tablist">
      {(tabs as { key: string; label: string }[]).map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          onClick={() => (onChange as (key: string) => void)(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

interface StubColumn {
  key: string;
  render?: (row: unknown, index: number) => ReactNode;
}

export function TableComponent({ columns, data, getRowKey, onRowClick, title }: AnyProps) {
  const rows = (data as unknown[]) ?? [];
  return (
    <table aria-label={title as string | undefined}>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={(getRowKey as (row: unknown, index: number) => string)(row, index)}
            onClick={() => (onRowClick as ((row: unknown) => void) | undefined)?.(row)}
          >
            {(columns as StubColumn[]).map((column) => (
              <td key={column.key}>{column.render ? column.render(row, index) : null}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DrawerComponent({ open, title, headerActions, children }: AnyProps) {
  if (!open) return null;
  return (
    <aside aria-label={title as string}>
      {headerActions as ReactNode}
      {children}
    </aside>
  );
}

export function DialogComponent({
  open,
  headline,
  children,
  onConfirm,
  onClose,
  confirmLabel = "OK",
}: AnyProps) {
  if (!open) return null;
  return (
    <div role="dialog" aria-label={headline as string}>
      <p>{children}</p>
      <button type="button" onClick={onClose as () => void}>
        Cancel
      </button>
      <button type="button" onClick={onConfirm as () => void}>
        {confirmLabel as string}
      </button>
    </div>
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

export function ToastComponent({ toasts }: { toasts?: StubToast[] }) {
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
