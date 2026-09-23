"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NodePosition } from "../../types/portal";
import {
  fitViewport,
  zoomAtPoint,
  type Rect,
  type Viewport,
} from "./topologyLayout";

type Interaction =
  | { kind: "idle" }
  | { kind: "pan"; startX: number; startY: number; startPan: NodePosition }
  | { kind: "node"; nodeId: string; offsetX: number; offsetY: number }
  | {
      kind: "cluster";
      startX: number;
      startY: number;
      origins: Record<string, NodePosition>;
    };

const IDLE: Interaction = { kind: "idle" };
const WHEEL_ZOOM_IN = 1.1;
const WHEEL_ZOOM_OUT = 0.9;
const BUTTON_ZOOM_IN = 1.25;
const BUTTON_ZOOM_OUT = 0.8;

/**
 * Pan / zoom / drag state for the topology canvas.
 *
 * Window listeners are attached once and read the live interaction from a
 * ref, so panning no longer re-subscribes them on every mouse move. Moves
 * are coalesced to one state update per animation frame. The wheel
 * listener binds to the canvas element as soon as it mounts (it renders
 * only after the first load), and every frame is cancelled on unmount.
 */
export function useTopologyViewport() {
  const [viewport, setViewport] = useState<Viewport>({
    pan: { x: 0, y: 0 },
    zoom: 1,
  });
  const [positionOverrides, setPositionOverrides] = useState<
    Record<string, NodePosition>
  >({});
  const [isPanning, setIsPanning] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLDivElement | null>(
    null,
  );

  const viewportRef = useRef(viewport);
  const interactionRef = useRef<Interaction>(IDLE);
  const pointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const commitViewport = useCallback((next: Viewport) => {
    viewportRef.current = next;
    setViewport(next);
  }, []);

  const canvasRefCallback = useCallback((element: HTMLDivElement | null) => {
    canvasRef.current = element;
    setCanvasElement(element);
  }, []);

  /** Client (screen) coordinates → graph coordinates. */
  const toGraphPoint = useCallback(
    (clientX: number, clientY: number): NodePosition => {
      const rect = canvasRef.current?.getBoundingClientRect();
      const { pan, zoom } = viewportRef.current;
      if (!rect) return { x: clientX, y: clientY };
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [],
  );

  const applyPointer = useCallback(() => {
    frameRef.current = null;
    const pointer = pointerRef.current;
    const interaction = interactionRef.current;
    if (!pointer) return;

    switch (interaction.kind) {
      case "pan":
        commitViewport({
          ...viewportRef.current,
          pan: {
            x: interaction.startPan.x + (pointer.clientX - interaction.startX),
            y: interaction.startPan.y + (pointer.clientY - interaction.startY),
          },
        });
        break;
      case "node": {
        const point = toGraphPoint(pointer.clientX, pointer.clientY);
        setPositionOverrides((previous) => ({
          ...previous,
          [interaction.nodeId]: {
            x: point.x - interaction.offsetX,
            y: point.y - interaction.offsetY,
          },
        }));
        break;
      }
      case "cluster": {
        const point = toGraphPoint(pointer.clientX, pointer.clientY);
        const deltaX = point.x - interaction.startX;
        const deltaY = point.y - interaction.startY;
        setPositionOverrides((previous) => {
          const next = { ...previous };
          for (const [nodeId, origin] of Object.entries(interaction.origins)) {
            next[nodeId] = { x: origin.x + deltaX, y: origin.y + deltaY };
          }
          return next;
        });
        break;
      }
      case "idle":
        break;
    }
  }, [commitViewport, toGraphPoint]);

  const endInteraction = useCallback(() => {
    if (interactionRef.current.kind === "idle") return;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      applyPointer(); // land the final position
    }
    interactionRef.current = IDLE;
    pointerRef.current = null;
    setIsPanning(false);
    setDraggingNodeId(null);
  }, [applyPointer]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (interactionRef.current.kind === "idle") return;
      pointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      if (frameRef.current === null)
        frameRef.current = requestAnimationFrame(applyPointer);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", endInteraction);
    // A release outside the window (alt-tab mid-drag) never sends mouseup
    window.addEventListener("blur", endInteraction);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", endInteraction);
      window.removeEventListener("blur", endInteraction);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [applyPointer, endInteraction]);

  useEffect(() => {
    if (!canvasElement) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvasElement.getBoundingClientRect();
      commitViewport(
        zoomAtPoint(
          viewportRef.current,
          { x: event.clientX - rect.left, y: event.clientY - rect.top },
          event.deltaY > 0 ? WHEEL_ZOOM_OUT : WHEEL_ZOOM_IN,
        ),
      );
    };
    canvasElement.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvasElement.removeEventListener("wheel", handleWheel);
  }, [canvasElement, commitViewport]);

  const beginPan = useCallback((event: React.MouseEvent) => {
    interactionRef.current = {
      kind: "pan",
      startX: event.clientX,
      startY: event.clientY,
      startPan: viewportRef.current.pan,
    };
    setIsPanning(true);
  }, []);

  const beginNodeDrag = useCallback(
    (event: React.MouseEvent, nodeId: string, position: NodePosition) => {
      const point = toGraphPoint(event.clientX, event.clientY);
      interactionRef.current = {
        kind: "node",
        nodeId,
        offsetX: point.x - position.x,
        offsetY: point.y - position.y,
      };
      setDraggingNodeId(nodeId);
    },
    [toGraphPoint],
  );

  const beginClusterDrag = useCallback(
    (event: React.MouseEvent, origins: Record<string, NodePosition>) => {
      const point = toGraphPoint(event.clientX, event.clientY);
      interactionRef.current = {
        kind: "cluster",
        startX: point.x,
        startY: point.y,
        origins,
      };
    },
    [toGraphPoint],
  );

  /** Zoom about the canvas center (buttons). */
  const zoomBy = useCallback(
    (direction: 1 | -1) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      commitViewport(
        zoomAtPoint(
          viewportRef.current,
          { x: rect.width / 2, y: rect.height / 2 },
          direction > 0 ? BUTTON_ZOOM_IN : BUTTON_ZOOM_OUT,
        ),
      );
    },
    [commitViewport],
  );

  /** Shift the view by screen pixels (keyboard panning). */
  const panBy = useCallback(
    (deltaX: number, deltaY: number) => {
      const { pan, zoom } = viewportRef.current;
      commitViewport({ pan: { x: pan.x + deltaX, y: pan.y + deltaY }, zoom });
    },
    [commitViewport],
  );

  /** Fit `bounds` (graph coords) into the canvas. Returns false if the canvas has no size yet. */
  const fitTo = useCallback(
    (bounds: Rect | null) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect || !bounds) return false;
      const next = fitViewport(bounds, rect.width, rect.height);
      if (!next) return false;
      commitViewport(next);
      return true;
    },
    [commitViewport],
  );

  const resetOverrides = useCallback(() => setPositionOverrides({}), []);

  return {
    viewport,
    positionOverrides,
    isPanning,
    draggingNodeId,
    canvasElement,
    canvasRef: canvasRefCallback,
    beginPan,
    beginNodeDrag,
    beginClusterDrag,
    panBy,
    zoomBy,
    fitTo,
    resetOverrides,
  };
}
