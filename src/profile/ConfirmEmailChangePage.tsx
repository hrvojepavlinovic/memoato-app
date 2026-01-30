import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { confirmEmailChange } from "wasp/client/operations";
import { Button, ButtonLink } from "../shared/components/Button";

export function ConfirmEmailChangePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onConfirm() {
    setStatus("busy");
    setMessage(null);
    try {
      await confirmEmailChange({ token });
      setStatus("done");
      setMessage("Email updated.");
    } catch (e: any) {
      setStatus("error");
      setMessage(e?.message ?? "Invalid or expired link.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-sm px-4 py-10">
      <div className="card p-5">
        <div className="text-xl font-semibold tracking-tight">Confirm email change</div>
        <div className="mt-2 text-sm text-neutral-600">
          {message ?? "Click confirm to update your Memoato email."}
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={onConfirm} disabled={!token || status === "busy" || status === "done"}>
            {status === "busy" ? "Confirming…" : status === "done" ? "Confirmed" : "Confirm"}
          </Button>
          <ButtonLink to="/login" variant="ghost">
            Login
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

