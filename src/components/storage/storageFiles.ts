/**
 * Pure object-store helpers — file-type detection, key/prefix math,
 * breadcrumbs, listing filters and animation staggering.
 */

import {
  File,
  FileArchive,
  FileCode,
  FileHeadphone,
  FileImage,
  FilePlay,
  FileText,
  type LucideIcon,
} from "lucide-react";
import type { StorageObject, StorageSearchResult } from "../../types/portal";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"]);
const VIDEO_EXTS = new Set([".mp4", ".m4v", ".webm", ".mkv", ".mov", ".avi"]);
const TEXT_EXTS = new Set([".txt", ".md", ".csv", ".log", ".ini", ".yml", ".yaml", ".toml"]);
const CODE_EXTS = new Set([
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".css",
  ".html",
  ".json",
  ".xml",
  ".sh",
]);
const ARCHIVE_EXTS = new Set([".zip", ".gz", ".tar", ".rar", ".7z", ".bz2", ".xz"]);

export type MediaType = "image" | "audio" | "video";

export function getFileExt(name: string): string {
  return (name || "").match(/\.[^./]+$/)?.[0]?.toLowerCase() || "";
}

export function getMediaType(name: string): MediaType | null {
  const ext = getFileExt(name);
  if (IMAGE_EXTS.has(ext)) return "image";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (VIDEO_EXTS.has(ext)) return "video";
  return null;
}

export const isImage = (name: string) => getMediaType(name) === "image";
export const isPreviewable = (name: string) => getMediaType(name) !== null;

export function getFileIcon(name: string): LucideIcon {
  const ext = getFileExt(name);
  if (IMAGE_EXTS.has(ext)) return FileImage;
  if (AUDIO_EXTS.has(ext)) return FileHeadphone;
  if (VIDEO_EXTS.has(ext)) return FilePlay;
  if (TEXT_EXTS.has(ext)) return FileText;
  if (CODE_EXTS.has(ext)) return FileCode;
  if (ARCHIVE_EXTS.has(ext)) return FileArchive;
  return File;
}

/** A key relative to the current prefix (the leaf a listing shows). */
export function displayName(fullKey: string, prefix: string): string {
  return prefix && fullKey.startsWith(prefix) ? fullKey.slice(prefix.length) : fullKey;
}

/** A sub-prefix as a folder label relative to the current prefix, sans trailing slash. */
export function folderLabel(folderPrefix: string, currentPrefix: string): string {
  return displayName(folderPrefix, currentPrefix).replace(/\/$/, "");
}

/** Split an object key into its file name and folder path (with trailing slash). */
export function splitObjectKey(key: string): { fileName: string; folderPath: string } {
  const slash = key.lastIndexOf("/");
  if (slash === -1) return { fileName: key, folderPath: "" };
  return { fileName: key.slice(slash + 1) || key, folderPath: key.slice(0, slash + 1) };
}

export interface BreadcrumbSegment {
  label: string;
  /** null = the bucket list; "" = bucket root; otherwise a folder prefix */
  prefix: string | null;
}

export function buildBreadcrumbs(bucket: string | null, prefix: string): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [{ label: "Buckets", prefix: null }];
  if (!bucket) return segments;
  segments.push({ label: bucket, prefix: "" });
  let accumulated = "";
  for (const part of prefix.split("/").filter(Boolean)) {
    accumulated += `${part}/`;
    segments.push({ label: part, prefix: accumulated });
  }
  return segments;
}

/** Case-insensitive filter of a listing by the names shown to the user. */
export function filterListing(
  objects: StorageObject[],
  prefixes: string[],
  search: string,
  prefix: string,
): { objects: StorageObject[]; prefixes: string[] } {
  const needle = search.trim().toLowerCase();
  if (!needle) return { objects, prefixes };
  return {
    objects: objects.filter((object) => displayName(object.name, prefix).toLowerCase().includes(needle)),
    prefixes: prefixes.filter((folder) => folderLabel(folder, prefix).toLowerCase().includes(needle)),
  };
}

/** Search hits grouped by bucket, in first-seen order. */
export function groupResultsByBucket(
  results: StorageSearchResult[],
): { bucket: string; results: StorageSearchResult[] }[] {
  const groups = new Map<string, StorageSearchResult[]>();
  for (const result of results) {
    const group = groups.get(result.bucket);
    if (group) group.push(result);
    else groups.set(result.bucket, [result]);
  }
  return [...groups].map(([bucket, bucketResults]) => ({ bucket, results: bucketResults }));
}

/**
 * Entry-animation delay for the index-th item. Capped so a folder with
 * thousands of objects doesn't take tens of seconds to finish fading in.
 */
export function staggerDelay(index: number, stepMs: number, maxSteps = 20): string {
  return `${Math.min(index, maxSteps) * stepMs}ms`;
}

export function formatDate(value: string | undefined, withTime = false): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return withTime ? date.toLocaleString() : date.toLocaleDateString();
}
