import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  answerMemoryRecall,
  recallMemory,
  useQuery,
} from "wasp/client/operations";
import type { RecallAnswer, RecallResults } from "./viewTypes";

export function useMemoryRecall(enabled: boolean) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<RecallAnswer | null>(null);
  const [answerError, setAnswerError] = useState("");
  const [answering, setAnswering] = useState(false);
  const generation = useRef(0);
  const answerPending = useRef<number | null>(null);
  const fast = useQuery(
    recallMemory,
    { query, take: 30, semantic: false },
    { enabled: enabled && !!query, staleTime: 300000, retry: false },
  );
  const fastData =
    (fast.data as RecallResults | undefined)?.query === query
      ? (fast.data as RecallResults)
      : null;
  const semantic = useQuery(
    recallMemory,
    { query, take: 30, semantic: true },
    {
      enabled: enabled && !!query && !!fastData,
      staleTime: 300000,
      retry: false,
    },
  );
  const semanticData =
    (semantic.data as RecallResults | undefined)?.query === query
      ? (semantic.data as RecallResults)
      : null;
  const data = semanticData ?? fastData;
  const evidence = useMemo(
    () =>
      (data?.entries ?? [])
        .filter((entry) => entry.processingStatus !== "legacy")
        .slice(0, 8),
    [data],
  );
  const evidenceIds = evidence.map((entry) => entry.id);
  const evidenceVersion = useMemo(() => JSON.stringify(evidence), [evidence]);

  const invalidateAnswer = useCallback(() => {
    generation.current++;
    answerPending.current = null;
    setAnswer(null);
    setAnswerError("");
    setAnswering(false);
  }, []);
  useEffect(() => {
    invalidateAnswer();
  }, [evidenceVersion, invalidateAnswer]);
  useEffect(() => {
    if (!enabled) invalidateAnswer();
  }, [enabled, invalidateAnswer]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  function submit(value = draft) {
    if (!enabled) return;
    const cleaned = value.trim().slice(0, 240);
    if (!cleaned) return;
    invalidateAnswer();
    setDraft(cleaned);
    setQuery(cleaned);
    if (cleaned === query) {
      void fast.refetch();
      if (fastData) void semantic.refetch();
    }
  }
  async function answerFromEvidence() {
    if (!enabled || !evidenceIds.length || answerPending.current !== null)
      return;
    const request = generation.current;
    answerPending.current = request;
    setAnswering(true);
    setAnswerError("");
    setAnswer(null);
    try {
      const result = (await answerMemoryRecall({
        query,
        entryIds: evidenceIds,
      })) as RecallAnswer;
      if (generation.current !== request) return;
      if (result.available) setAnswer(result);
      else
        setAnswerError(
          "AI answers are unavailable right now. Your original notes are still below.",
        );
    } catch {
      if (generation.current === request)
        setAnswerError(
          "Couldn’t prepare an AI answer. Your original notes are unchanged.",
        );
    } finally {
      if (generation.current === request) {
        answerPending.current = null;
        setAnswering(false);
      }
    }
  }
  async function refreshEvidence() {
    invalidateAnswer();
    await fast.refetch({ throwOnError: true });
    if (fastData) await semantic.refetch({ throwOnError: true });
  }
  return {
    draft,
    setDraft,
    query,
    submit,
    fast,
    semantic,
    data,
    answer,
    answerError,
    answering,
    answerFromEvidence,
    refreshEvidence,
    canAnswer: evidenceIds.length > 0,
    initialLoading: !!query && !fastData && (fast.isLoading || fast.isFetching),
    addingMeaning: !!fastData && !semanticData && semantic.isFetching,
  };
}
