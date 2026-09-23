import { describe, it, expect } from "vitest";
import { FileArchive, FileHeadphone, FileImage, FilePlay, File } from "lucide-react";
import {
  buildBreadcrumbs,
  displayName,
  filterListing,
  folderLabel,
  formatDate,
  getFileExt,
  getFileIcon,
  getMediaType,
  groupResultsByBucket,
  isPreviewable,
  splitObjectKey,
  staggerDelay,
} from "../storageFiles";
import {
  bucketSegments,
  diskSegments,
  normalizeDockerHosts,
  summarizeBuckets,
  truncateMiddle,
} from "../storageOverview";
import type { DiskUsage, StorageBucket } from "../../../types/portal";

describe("file types", () => {
  it("reads the extension of the leaf only", () => {
    expect(getFileExt("photos/cat.JPG")).toBe(".jpg");
    expect(getFileExt("releases.v2/readme")).toBe("");
    expect(getFileExt("")).toBe("");
  });

  it("maps extensions to media types and icons", () => {
    expect(getMediaType("a/b.webp")).toBe("image");
    expect(getMediaType("song.flac")).toBe("audio");
    expect(getMediaType("clip.m4v")).toBe("video");
    expect(getMediaType("notes.txt")).toBeNull();
    expect(isPreviewable("clip.mov")).toBe(true);
    expect(getFileIcon("x.png")).toBe(FileImage);
    expect(getFileIcon("x.mp3")).toBe(FileHeadphone);
    expect(getFileIcon("x.mp4")).toBe(FilePlay);
    expect(getFileIcon("x.7z")).toBe(FileArchive);
    expect(getFileIcon("Makefile")).toBe(File);
  });
});

describe("keys and prefixes", () => {
  it("shows keys and folders relative to the current prefix", () => {
    expect(displayName("a/b/c.png", "a/b/")).toBe("c.png");
    expect(displayName("x/c.png", "a/")).toBe("x/c.png");
    expect(folderLabel("a/b/", "a/")).toBe("b");
    expect(folderLabel("top/", "")).toBe("top");
  });

  it("splits keys into file name and folder path", () => {
    expect(splitObjectKey("a/b/c.png")).toEqual({ fileName: "c.png", folderPath: "a/b/" });
    expect(splitObjectKey("root.txt")).toEqual({ fileName: "root.txt", folderPath: "" });
  });

  it("builds breadcrumbs down to the current folder", () => {
    expect(buildBreadcrumbs(null, "")).toEqual([{ label: "Buckets", prefix: null }]);
    expect(buildBreadcrumbs("media", "a/b/")).toEqual([
      { label: "Buckets", prefix: null },
      { label: "media", prefix: "" },
      { label: "a", prefix: "a/" },
      { label: "b", prefix: "a/b/" },
    ]);
  });

  it("filters a listing by the names shown, case-insensitively", () => {
    const objects = [
      { name: "a/Report.pdf", size: 1 },
      { name: "a/photo.png", size: 2 },
    ];
    const filtered = filterListing(objects, ["a/reports/", "a/misc/"], " REPORT ", "a/");
    expect(filtered.objects.map((object) => object.name)).toEqual(["a/Report.pdf"]);
    expect(filtered.prefixes).toEqual(["a/reports/"]);
    // Matching is on the relative name, not the shared prefix
    expect(filterListing(objects, [], "a/", "a/").objects).toEqual([]);
    expect(filterListing(objects, [], "", "a/").objects).toBe(objects);
  });

  it("groups search hits by bucket in first-seen order", () => {
    const groups = groupResultsByBucket([
      { bucket: "b", name: "1", size: 1 },
      { bucket: "a", name: "2", size: 1 },
      { bucket: "b", name: "3", size: 1 },
    ]);
    expect(groups.map((group) => [group.bucket, group.results.map((result) => result.name)])).toEqual([
      ["b", ["1", "3"]],
      ["a", ["2"]],
    ]);
  });

  it("caps the entry-animation stagger", () => {
    expect(staggerDelay(3, 20)).toBe("60ms");
    expect(staggerDelay(5000, 20)).toBe("400ms");
  });

  it("formats missing or invalid dates as a dash", () => {
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not a date")).toBe("—");
    expect(formatDate("2026-01-02T03:04:05Z")).not.toBe("—");
  });
});

describe("overview shaping", () => {
  const disk: DiskUsage = {
    images: { totalSize: 100, count: 2 },
    volumes: { totalSize: 0, count: 0 },
    buildCache: { totalSize: 50, count: 3 },
    containers: { totalWritableSize: 10, count: 1 },
    totalReclaimable: 160,
  };

  it("normalizes /stats/system — one entry per Docker host, disk required", () => {
    expect(normalizeDockerHosts(null)).toEqual([]);
    expect(normalizeDockerHosts([{ deviceId: "nas", disk }, { deviceId: "down" }])).toEqual([
      { deviceId: "nas", disk },
    ]);
    expect(normalizeDockerHosts({ deviceId: "nas", disk })).toEqual([{ deviceId: "nas", disk }]);
  });

  it("drops empty disk categories", () => {
    expect(diskSegments(disk).map((segment) => segment.label)).toEqual([
      "Images",
      "Build Cache",
      "Containers",
    ]);
  });

  it("orders non-empty buckets largest first", () => {
    const buckets: StorageBucket[] = [
      { name: "small", objectCount: 1, totalSize: 10 },
      { name: "empty", objectCount: 0, totalSize: 0 },
      { name: "big", objectCount: 5, totalSize: 99 },
      { name: "pending", objectCount: null, totalSize: null },
    ];
    expect(bucketSegments(buckets).map((segment) => segment.label)).toEqual(["big", "small"]);
    expect(summarizeBuckets(buckets)).toEqual({ objects: 6, bytes: 109 });
  });

  it("truncates long names in the middle", () => {
    expect(truncateMiddle("short", 10, 2, 2)).toBe("short");
    expect(truncateMiddle("abcdefghijklmnop", 10, 3, 4)).toBe("abc…mnop");
    expect(truncateMiddle("abcdefghijklmnop", 10, 0, 4)).toBe("…mnop");
  });
});
