import { describe, expect, it } from "vitest";
import { loggableContainer } from "../../__tests__/apiFixtures";
import { buildContainerOptions, findLinkedContainer } from "../logContainers";

const containers = [
  loggableContainer({ name: "prism-service", device: "workstation", deviceName: "Workstation" }),
  loggableContainer({ name: "b-exited", device: "synology", state: "exited" }),
  loggableContainer({
    name: "prism-service",
    device: "synology",
    deviceName: "Synology NAS",
    state: "exited",
  }),
  loggableContainer({ name: "a-running", device: "synology" }),
];

describe("buildContainerOptions", () => {
  it("groups by host, running first, and labels names that repeat", () => {
    expect(buildContainerOptions(containers).map((option) => [option.value, option.label])).toEqual([
      ["synology::a-running", "a-running"],
      ["synology::b-exited", "b-exited"],
      ["synology::prism-service", "prism-service (Synology NAS)"],
      ["workstation::prism-service", "prism-service (Workstation)"],
    ]);
  });
});

describe("findLinkedContainer", () => {
  it("honours the device in the link", () => {
    expect(findLinkedContainer(containers, "prism-service", "synology")?.device).toBe("synology");
  });

  it("prefers the running copy when no device is given", () => {
    expect(findLinkedContainer(containers, "prism-service")?.device).toBe("workstation");
  });

  it("returns null for unknown names", () => {
    expect(findLinkedContainer(containers, "nope")).toBeNull();
  });
});
