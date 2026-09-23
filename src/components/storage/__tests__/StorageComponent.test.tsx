import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, within, waitFor } from "@testing-library/react";
import StorageComponent from "../../StorageComponent";
import ApiService from "../../../services/ApiService";
import type {
  BucketStreamEvent,
  StorageObject,
  StorageObjectListing,
  StorageObjectStat,
} from "../../../types/portal";
import {
  deviceSystemInfo,
  diskUsage,
  storageBucket,
  storageObject,
  storageObjectStat,
} from "../../__tests__/apiFixtures";

vi.mock("@rodrigo-barraza/components-library", () => import("../../__tests__/componentsLibraryStub"));
vi.mock("../../../services/ApiService", () => ({
  default: {
    streamStorageBuckets: vi.fn(),
    getSystemInfo: vi.fn(),
    getStorageSummary: vi.fn(),
    getStorageObjects: vi.fn(),
    statStorageObject: vi.fn(),
    deleteStorageObject: vi.fn(),
    searchStorageObjects: vi.fn(),
    buildStorageDownloadUrl: vi.fn((bucket: string, key: string) => `http://store/${bucket}/${key}`),
  },
}));

const api = vi.mocked(ApiService);

const DISK = diskUsage({
  images: {
    totalSize: 2048,
    count: 1,
    sharedSize: 0,
    items: [
      { id: "abc", tags: ["portal-client:latest"], size: 2048, sharedSize: 0, created: 0, containers: 1 },
    ],
  },
  totalReclaimable: 2048,
});

let emit: (event: BucketStreamEvent) => void;
let closeStream: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  vi.clearAllMocks();
  closeStream = vi.fn<() => void>();
  api.streamStorageBuckets.mockImplementation((onEvent) => {
    emit = (event) => act(() => onEvent(event));
    return { close: closeStream };
  });
  api.getSystemInfo.mockResolvedValue([
    deviceSystemInfo({ deviceId: "nas", deviceName: "NAS", serverVersion: "27.1", disk: DISK }),
    deviceSystemInfo({ deviceId: "desktop", deviceName: "Desktop", serverVersion: "28.0", disk: DISK }),
  ]);
  api.getStorageSummary.mockResolvedValue({
    buckets: [],
    totalObjects: 0,
    totalSize: 0,
    fetchedAt: "2026-09-22T00:00:00.000Z",
  });
});

function streamBuckets(names: string[]) {
  emit({
    type: "init",
    totalBuckets: names.length,
    buckets: names.map((name) => storageBucket({ name, objectCount: null, totalSize: null })),
  });
  for (const name of names) {
    emit({ type: "bucket", bucket: storageBucket({ name, objectCount: 3, totalSize: 1024 }) });
  }
  emit({ type: "done" });
}

/** GET /object-store/buckets/media at `prefix`. */
function listing(objects: StorageObject[], prefixes: string[] = [], prefix = ""): StorageObjectListing {
  return { bucket: "media", prefix, objects, prefixes };
}

describe("StorageComponent", () => {
  it("renders one Docker disk panel per host from the per-device array", async () => {
    render(<StorageComponent />);
    expect(await screen.findByText("NAS · v27.1")).toBeInTheDocument();
    expect(screen.getByText("Desktop · v28.0")).toBeInTheDocument();
    expect(screen.getAllByText("Docker Disk Usage")).toHaveLength(2);
  });

  it("closes the bucket stream on unmount", () => {
    const { unmount } = render(<StorageComponent />);
    unmount();
    expect(closeStream).toHaveBeenCalled();
  });

  it("shows an error state instead of 'No buckets found' when the stream fails", async () => {
    render(<StorageComponent />);
    emit({ type: "error", message: "MinIO unreachable" });
    expect(await screen.findByText("Couldn't list buckets")).toBeInTheDocument();
    expect(screen.queryByText("No buckets found")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(api.streamStorageBuckets).toHaveBeenCalledTimes(2);
  });

  it("stops shimmering stats the stream never delivered", async () => {
    render(<StorageComponent />);
    emit({
      type: "init",
      totalBuckets: 1,
      buckets: [storageBucket({ name: "media", objectCount: null, totalSize: null })],
    });
    emit({ type: "done" });
    const card = await screen.findByRole("button", { name: /media/ });
    expect(within(card).getAllByText("—")).toHaveLength(2);
  });

  it("never lets a slow folder listing land under a newer breadcrumb", async () => {
    let resolveSlow: (value: StorageObjectListing) => void = () => {};
    api.getStorageObjects.mockImplementation((_bucket: string, { prefix }: { prefix?: string } = {}) => {
      if (prefix === "slow/") return new Promise((resolve) => (resolveSlow = resolve));
      if (prefix === "fast/") {
        return Promise.resolve(listing([storageObject({ name: "fast/new.txt", size: 1 })], [], prefix));
      }
      return Promise.resolve(listing([], ["slow/", "fast/"]));
    });

    render(<StorageComponent />);
    streamBuckets(["media"]);
    fireEvent.click(await screen.findByRole("button", { name: /media/ }));
    fireEvent.click(await screen.findByRole("button", { name: /slow/ }));
    // Back to the bucket root, then into the fast folder before slow/ answers
    fireEvent.click(screen.getByRole("button", { name: "media" }));
    fireEvent.click(await screen.findByRole("button", { name: /fast/ }));
    expect(await screen.findByText("new.txt")).toBeInTheDocument();

    await act(async () =>
      resolveSlow(listing([storageObject({ name: "slow/stale.txt", size: 1 })], [], "slow/")),
    );
    expect(screen.queryByText("stale.txt")).not.toBeInTheDocument();
    expect(screen.getByText("new.txt")).toBeInTheDocument();
  });

  it("confirms deletes in a dialog and surfaces failures", async () => {
    api.getStorageObjects.mockResolvedValue(listing([storageObject({ name: "doc.txt", size: 10 })]));
    api.deleteStorageObject.mockRejectedValueOnce(new Error("Access denied"));

    render(<StorageComponent />);
    streamBuckets(["media"]);
    fireEvent.click(await screen.findByRole("button", { name: /media/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete doc.txt" }));

    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(await within(dialog).findByText("Access denied")).toBeInTheDocument();
    expect(api.deleteStorageObject).toHaveBeenCalledWith("media", "doc.txt");

    api.deleteStorageObject.mockResolvedValueOnce({ success: true, bucket: "media", object: "doc.txt" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(api.getStorageObjects).toHaveBeenCalledTimes(2); // reloaded after the delete
  });

  it("debounces global search and shows failures as errors, not empty results", async () => {
    vi.useFakeTimers();
    try {
      api.searchStorageObjects.mockRejectedValueOnce(new Error("search timed out"));
      render(<StorageComponent />);
      fireEvent.change(screen.getByRole("searchbox", { name: "Search files across all stores…" }), {
        target: { value: "cat" },
      });
      expect(screen.getByText("Searching across all stores…")).toBeInTheDocument();
      expect(api.searchStorageObjects).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      expect(api.searchStorageObjects).toHaveBeenCalledTimes(1);
      expect(api.searchStorageObjects).toHaveBeenCalledWith("cat", {}, { signal: expect.any(AbortSignal) });
      expect(screen.getByText("Search failed")).toBeInTheDocument();
      expect(screen.getByText("search timed out")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts a search still in flight when the query changes", async () => {
    vi.useFakeTimers();
    try {
      api.searchStorageObjects.mockReturnValue(new Promise(() => {}));
      render(<StorageComponent />);
      const searchbox = screen.getByRole("searchbox", { name: "Search files across all stores…" });
      fireEvent.change(searchbox, { target: { value: "cat" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      const firstSignal = api.searchStorageObjects.mock.calls[0][2]?.signal;
      expect(firstSignal?.aborted).toBe(false);

      fireEvent.change(searchbox, { target: { value: "cats" } });
      expect(firstSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears the previous object's metadata when previewing another", async () => {
    let resolveSecond: (value: StorageObjectStat) => void = () => {};
    api.getStorageObjects.mockResolvedValue(
      listing([
        storageObject({ name: "one.png", size: 1 }),
        storageObject({ name: "two.png", size: 2 }),
      ]),
    );
    api.statStorageObject
      .mockResolvedValueOnce(
        storageObjectStat({ bucket: "media", object: "one.png", size: 1, contentType: "image/one" }),
      )
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));

    render(<StorageComponent />);
    streamBuckets(["media"]);
    fireEvent.click(await screen.findByRole("button", { name: /media/ }));

    fireEvent.click(await screen.findByRole("button", { name: "Preview one.png" }));
    expect(await screen.findByText("image/one")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByRole("button", { name: "Preview two.png" }));
    expect(screen.queryByText("image/one")).not.toBeInTheDocument();
    await act(async () =>
      resolveSecond(
        storageObjectStat({ bucket: "media", object: "two.png", size: 2, contentType: "image/two" }),
      ),
    );
    expect(screen.getByText("image/two")).toBeInTheDocument();
  });
});
