import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, within, waitFor } from "@testing-library/react";
import StorageComponent from "../../StorageComponent";
import ApiService from "../../../services/ApiService";
import type { BucketStreamEvent } from "../../../types/portal";

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

const DISK = {
  images: { totalSize: 2048, count: 1, items: [{ id: "abc", tags: ["portal-client:latest"], size: 2048 }] },
  volumes: { totalSize: 0, count: 0, items: [] },
  buildCache: { totalSize: 0, count: 0 },
  containers: { totalWritableSize: 0, count: 0 },
  totalReclaimable: 2048,
};

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
    { deviceId: "nas", deviceName: "NAS", serverVersion: "27.1", disk: DISK },
    { deviceId: "desktop", deviceName: "Desktop", serverVersion: "28.0", disk: DISK },
  ]);
  api.getStorageSummary.mockResolvedValue({ buckets: [], totalObjects: 0, totalSize: 0 });
});

function streamBuckets(names: string[]) {
  emit({
    type: "init",
    totalBuckets: names.length,
    buckets: names.map((name) => ({ name, objectCount: null, totalSize: null })),
  });
  for (const name of names) {
    emit({ type: "bucket", bucket: { name, objectCount: 3, totalSize: 1024 } });
  }
  emit({ type: "done" });
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
    emit({ type: "init", totalBuckets: 1, buckets: [{ name: "media", objectCount: null, totalSize: null }] });
    emit({ type: "done" });
    const card = await screen.findByRole("button", { name: /media/ });
    expect(within(card).getAllByText("—")).toHaveLength(2);
  });

  it("never lets a slow folder listing land under a newer breadcrumb", async () => {
    let resolveSlow: (value: unknown) => void = () => {};
    api.getStorageObjects.mockImplementation((_bucket: string, { prefix }: { prefix?: string } = {}) => {
      if (prefix === "slow/") return new Promise((resolve) => (resolveSlow = resolve));
      if (prefix === "fast/") return Promise.resolve({ objects: [{ name: "fast/new.txt", size: 1 }], prefixes: [] });
      return Promise.resolve({ objects: [], prefixes: ["slow/", "fast/"] });
    });

    render(<StorageComponent />);
    streamBuckets(["media"]);
    fireEvent.click(await screen.findByRole("button", { name: /media/ }));
    fireEvent.click(await screen.findByRole("button", { name: /slow/ }));
    // Back to the bucket root, then into the fast folder before slow/ answers
    fireEvent.click(screen.getByRole("button", { name: "media" }));
    fireEvent.click(await screen.findByRole("button", { name: /fast/ }));
    expect(await screen.findByText("new.txt")).toBeInTheDocument();

    await act(async () => resolveSlow({ objects: [{ name: "slow/stale.txt", size: 1 }], prefixes: [] }));
    expect(screen.queryByText("stale.txt")).not.toBeInTheDocument();
    expect(screen.getByText("new.txt")).toBeInTheDocument();
  });

  it("confirms deletes in a dialog and surfaces failures", async () => {
    api.getStorageObjects.mockResolvedValue({ objects: [{ name: "doc.txt", size: 10 }], prefixes: [] });
    api.deleteStorageObject.mockRejectedValueOnce(new Error("Access denied"));

    render(<StorageComponent />);
    streamBuckets(["media"]);
    fireEvent.click(await screen.findByRole("button", { name: /media/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete doc.txt" }));

    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(await within(dialog).findByText("Access denied")).toBeInTheDocument();
    expect(api.deleteStorageObject).toHaveBeenCalledWith("media", "doc.txt");

    api.deleteStorageObject.mockResolvedValueOnce({ success: true });
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
      expect(api.searchStorageObjects).toHaveBeenCalledWith("cat");
      expect(screen.getByText("Search failed")).toBeInTheDocument();
      expect(screen.getByText("search timed out")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears the previous object's metadata when previewing another", async () => {
    let resolveSecond: (value: unknown) => void = () => {};
    api.getStorageObjects.mockResolvedValue({
      objects: [
        { name: "one.png", size: 1 },
        { name: "two.png", size: 2 },
      ],
      prefixes: [],
    });
    api.statStorageObject
      .mockResolvedValueOnce({ name: "one.png", size: 1, contentType: "image/one" })
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));

    render(<StorageComponent />);
    streamBuckets(["media"]);
    fireEvent.click(await screen.findByRole("button", { name: /media/ }));

    fireEvent.click(await screen.findByRole("button", { name: "Preview one.png" }));
    expect(await screen.findByText("image/one")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByRole("button", { name: "Preview two.png" }));
    expect(screen.queryByText("image/one")).not.toBeInTheDocument();
    await act(async () => resolveSecond({ name: "two.png", size: 2, contentType: "image/two" }));
    expect(screen.getByText("image/two")).toBeInTheDocument();
  });
});
