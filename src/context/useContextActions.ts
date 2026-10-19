import { useCallback, useEffect, useRef, useState } from "react";
import { buildContextPacket } from "wasp/client/operations";
import type { ContextPacketView } from "./viewTypes";

export type ContextAction = (
  key: string,
  task: () => Promise<unknown>,
  success: string,
  afterSave?: () => void,
) => Promise<void>;

export function useContextActions({
  workspaceId,
  revision,
  refreshing,
  onRefresh,
  onBusyChange,
  onSaved,
}: {
  workspaceId: string;
  revision: string;
  refreshing: boolean;
  onRefresh: () => Promise<unknown>;
  onBusyChange: (busy: boolean) => void;
  onSaved: (message: string) => void;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [packet, setPacket] = useState<ContextPacketView | null>(null);
  const pending = useRef(false);
  const generation = useRef(0);
  const invalidatePacket = useCallback(() => {
    generation.current++;
    setPacket(null);
  }, []);
  useEffect(() => {
    invalidatePacket();
  }, [workspaceId, revision, refreshing, invalidatePacket]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );

  function start(key: string) {
    if (pending.current || refreshing) return false;
    pending.current = true;
    onBusyChange(true);
    setBusy(key);
    onSaved("");
    setError("");
    invalidatePacket();
    return true;
  }
  function finish() {
    pending.current = false;
    setBusy("");
    onBusyChange(false);
  }
  const run: ContextAction = async (key, task, success, afterSave) => {
    if (!start(key)) return;
    let saved = false;
    try {
      await task();
      saved = true;
      afterSave?.();
      onSaved(success);
      await onRefresh();
    } catch (cause) {
      setError(
        saved
          ? "Saved, but the workspace couldn’t refresh. Reload before making another change."
          : cause instanceof Error
            ? cause.message
            : "This action failed. Try again.",
      );
    } finally {
      finish();
    }
  };
  async function build(query: string) {
    const cleaned = query.trim().slice(0, 240);
    if (!cleaned || !start("packet")) return;
    const request = generation.current;
    try {
      const result = (await buildContextPacket({
        workspaceId,
        query: cleaned,
        take: 20,
      })) as ContextPacketView;
      if (
        request === generation.current &&
        result.content.workspace.id === workspaceId
      )
        setPacket(result);
    } catch {
      if (request === generation.current)
        setError(
          "Couldn’t build this context packet. Your query is kept; try again.",
        );
    } finally {
      finish();
    }
  }
  async function reload() {
    if (!start("reload")) return;
    try {
      await onRefresh();
    } catch {
      setError("Couldn’t reload this workspace. Try again.");
    } finally {
      finish();
    }
  }
  return {
    busy,
    error,
    packet,
    run,
    build,
    reload,
    invalidatePacket,
    disabled: !!busy || refreshing,
  };
}
