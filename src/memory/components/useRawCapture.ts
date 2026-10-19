import { useRef, useState } from "react";
import { createRawLog, queryClientInitialized } from "wasp/client/operations";

export function useRawCapture() {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const pending = useRef(false);
  const revision = useRef(0);
  const attempt = useRef(0);

  function updateText(value: string) {
    revision.current += 1;
    setText(value);
    setError("");
    setNotice("");
  }

  async function save() {
    const raw = text.trim();
    if (!raw || pending.current) return;
    pending.current = true;
    const submittedRevision = revision.current;
    const currentAttempt = ++attempt.current;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await createRawLog({ text: raw });
    } catch {
      setError(
        "Couldn’t confirm the save. Your draft is still here. Check Memory before trying again.",
      );
      pending.current = false;
      setSaving(false);
      return;
    }

    // Only clear the submitted draft. Typing during the request starts a new one.
    if (revision.current === submittedRevision) setText("");
    setNotice("Original saved. Processing continues in the background.");
    pending.current = false;
    setSaving(false);
    try {
      const client = await queryClientInitialized;
      const results = await Promise.allSettled(
        [
          "operations/get-memory-overview",
          "operations/get-memory-feed",
          "operations/get-categories",
        ].map((key) =>
          client.invalidateQueries({ queryKey: [key] }, { throwOnError: true }),
        ),
      );
      if (results.some((result) => result.status === "rejected"))
        throw new Error("Refresh failed");
    } catch {
      if (attempt.current === currentAttempt) {
        setNotice(
          "Original saved. The list couldn’t refresh yet; you don’t need to save again.",
        );
      }
    }
  }

  return { text, updateText, saving, notice, error, save };
}
