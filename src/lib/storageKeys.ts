/**
 * Browser-storage keys the portal owns, in one place — so the
 * Settings → "Clear local data" action can find every one of them.
 */

/** Selected theme (read pre-paint by the theme init script). */
export const THEME_STORAGE_KEY = "portal:theme";

/** The settings store (src/lib/settings.ts). */
export const SETTINGS_STORAGE_KEY = "portal:settings";

/** Sidebar collapsed state — historical hyphenated spelling, kept so
 *  existing browsers keep their sidebar state. */
export const NAV_COLLAPSED_STORAGE_KEY = "portal-nav-collapsed";

/**
 * Prefixes of every preference the portal persists: its own keys (both
 * spellings) plus the column/sort layouts the library TableComponent
 * stores as `table-hidden-cols:<id>` / `table-sort:<id>`.
 */
const PREFERENCE_KEY_PREFIXES = [
  "portal:",
  "portal-",
  "table-hidden-cols:",
  "table-sort:",
] as const;

export function isPreferenceStorageKey(key: string): boolean {
  return PREFERENCE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Remove every portal preference from `storage`. Keys the portal does not
 * own (e.g. the analytics visitor id) are left alone. Returns how many
 * keys were removed; storage that is unavailable counts as empty.
 */
export function clearPreferenceStorage(storage?: Storage): number {
  try {
    const target = storage ?? window.localStorage;
    const keys: string[] = [];
    for (let index = 0; index < target.length; index++) {
      const key = target.key(index);
      if (key !== null && isPreferenceStorageKey(key)) keys.push(key);
    }
    for (const key of keys) target.removeItem(key);
    return keys.length;
  } catch {
    return 0;
  }
}
