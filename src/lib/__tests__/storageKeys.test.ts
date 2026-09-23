import { describe, it, expect } from "vitest";
import {
  clearPreferenceStorage,
  isPreferenceStorageKey,
  NAV_COLLAPSED_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "@/lib/storageKeys";

/** Minimal in-memory Storage — jsdom's localStorage is shadowed by Node's here. */
function createMemoryStorage(entries: Record<string, string>): Storage {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
  };
}

describe("isPreferenceStorageKey", () => {
  it("recognises the portal's own keys", () => {
    expect(isPreferenceStorageKey(THEME_STORAGE_KEY)).toBe(true);
    expect(isPreferenceStorageKey(SETTINGS_STORAGE_KEY)).toBe(true);
    expect(isPreferenceStorageKey(NAV_COLLAPSED_STORAGE_KEY)).toBe(true);
    expect(isPreferenceStorageKey("portal-container-view-mode")).toBe(true);
  });

  it("recognises library table layouts", () => {
    expect(isPreferenceStorageKey("table-sort:container-table")).toBe(true);
    expect(isPreferenceStorageKey("table-hidden-cols:project-table")).toBe(
      true,
    );
  });

  it("leaves keys the portal does not own", () => {
    expect(isPreferenceStorageKey("session:visitor-id")).toBe(false);
    expect(isPreferenceStorageKey("tablet")).toBe(false);
  });
});

describe("clearPreferenceStorage", () => {
  it("removes every preference and keeps the rest", () => {
    const storage = createMemoryStorage({
      [THEME_STORAGE_KEY]: '"daylight"',
      [NAV_COLLAPSED_STORAGE_KEY]: "true",
      "table-sort:container-table": "{}",
      "portal-container-view-mode": "grid",
      "session:visitor-id": "abc",
    });

    expect(clearPreferenceStorage(storage)).toBe(4);
    expect(storage.length).toBe(1);
    expect(storage.getItem("session:visitor-id")).toBe("abc");
  });

  it("treats unavailable storage as empty", () => {
    const broken = {
      get length(): number {
        throw new Error("SecurityError");
      },
    } as unknown as Storage;
    expect(clearPreferenceStorage(broken)).toBe(0);
  });
});
