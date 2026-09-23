"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Play, RotateCcw, Square, Undo2, type LucideIcon } from "lucide-react";
import {
  DialogComponent,
  ToastComponent,
  useToast,
} from "@rodrigo-barraza/components-library";
import {
  ACTION_COOLDOWN_LONG_MILLISECONDS,
  ACTION_COOLDOWN_MILLISECONDS,
  TOAST_DURATION_MILLISECONDS,
  getErrorMessage,
} from "@rodrigo-barraza/utilities-library";

export type ContainerAction = "start" | "stop" | "restart" | "rollback";

export interface ActionRequest {
  /** Identity of the target — pending state is tracked per key. */
  key: string;
  /** Human-readable target name for the dialog and toasts. */
  name: string;
  action: ContainerAction;
  run: () => Promise<unknown>;
}

interface ActionCopy {
  verb: string;
  done: string;
  icon: LucideIcon;
  /** How long the buttons stay busy after success while Docker settles. */
  cooldownMilliseconds: number;
  confirm?: { body: string; destructive: boolean };
}

export const ACTION_COPY: Record<ContainerAction, ActionCopy> = {
  start: {
    verb: "Start",
    done: "started",
    icon: Play,
    cooldownMilliseconds: ACTION_COOLDOWN_MILLISECONDS,
  },
  stop: {
    verb: "Stop",
    done: "stopped",
    icon: Square,
    cooldownMilliseconds: ACTION_COOLDOWN_MILLISECONDS,
    confirm: {
      body: "The container stays down until someone starts it again.",
      destructive: true,
    },
  },
  restart: {
    verb: "Restart",
    done: "restarted",
    icon: RotateCcw,
    cooldownMilliseconds: ACTION_COOLDOWN_MILLISECONDS,
    confirm: {
      body: "The container restarts — anything that depends on it is briefly unavailable.",
      destructive: false,
    },
  },
  rollback: {
    verb: "Roll back",
    done: "rolled back",
    icon: Undo2,
    cooldownMilliseconds: ACTION_COOLDOWN_LONG_MILLISECONDS,
    confirm: {
      body: "The container is recreated from its previous image build. The current build is kept as :rollback-backup.",
      destructive: true,
    },
  },
};

export interface ActionRunner {
  /** Action currently running (or cooling down) per target key. */
  pending: Readonly<Record<string, ContainerAction>>;
  /** Ask to run an action — disruptive ones go through a confirm dialog first. */
  requestAction: (request: ActionRequest) => void;
  /** Confirm dialog + result toasts; render once per page. */
  actionUi: ReactNode;
}

/**
 * Start / stop / restart / rollback plumbing shared by the Containers and
 * Projects pages: confirmation for anything disruptive, one pending action
 * per target (every button for that target disables together), a success
 * or error toast, and `onSettled` so the page can refresh its data.
 */
export function useActionRunner({
  onSettled,
}: {
  onSettled?: (request: ActionRequest, succeeded: boolean) => void;
} = {}): ActionRunner {
  const dialogId = useId();
  const [pending, setPending] = useState<Record<string, ContainerAction>>({});
  const [confirming, setConfirming] = useState<ActionRequest | null>(null);
  const { toasts, addToast, removeToast } = useToast(
    TOAST_DURATION_MILLISECONDS,
  );
  const pendingRef = useRef(pending);
  const onSettledRef = useRef(onSettled);
  const cooldownTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    pendingRef.current = pending;
    onSettledRef.current = onSettled;
  });

  useEffect(() => {
    const timers = cooldownTimersRef.current;
    return () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const release = useCallback((key: string) => {
    setPending((previous) => {
      if (!(key in previous)) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }, []);

  const execute = useCallback(
    async (request: ActionRequest) => {
      const copy = ACTION_COPY[request.action];
      pendingRef.current = {
        ...pendingRef.current,
        [request.key]: request.action,
      };
      setPending((previous) => ({
        ...previous,
        [request.key]: request.action,
      }));
      let succeeded = false;
      try {
        await request.run();
        succeeded = true;
        addToast(`${request.name} ${copy.done}`, "success");
      } catch (error) {
        // Errors stay until dismissed — they are the thing worth reading.
        addToast(
          `${copy.verb} failed for ${request.name}: ${getErrorMessage(error)}`,
          "error",
          0,
        );
      }
      onSettledRef.current?.(request, succeeded);
      if (!succeeded) {
        release(request.key);
        return;
      }
      const timer = setTimeout(() => {
        cooldownTimersRef.current.delete(timer);
        release(request.key);
      }, copy.cooldownMilliseconds);
      cooldownTimersRef.current.add(timer);
    },
    [addToast, release],
  );

  const requestAction = useCallback(
    (request: ActionRequest) => {
      if (request.key in pendingRef.current) return;
      if (ACTION_COPY[request.action].confirm) setConfirming(request);
      else void execute(request);
    },
    [execute],
  );

  const confirmCopy = confirming ? ACTION_COPY[confirming.action] : null;
  const ConfirmIcon = confirmCopy?.icon;

  const actionUi = (
    <>
      <DialogComponent
        id={dialogId}
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        icon={ConfirmIcon ? <ConfirmIcon size={22} /> : undefined}
        headline={
          confirming ? `${confirmCopy?.verb} ${confirming.name}?` : undefined
        }
        confirmLabel={confirmCopy?.verb}
        confirmVariant={
          confirmCopy?.confirm?.destructive ? "destructive" : "default"
        }
        onConfirm={() => {
          const request = confirming;
          setConfirming(null);
          if (request) void execute(request);
        }}
      >
        {confirmCopy?.confirm?.body}
      </DialogComponent>
      <ToastComponent toasts={toasts} onRemove={removeToast} />
    </>
  );

  return { pending, requestAction, actionUi };
}
