import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { logout } from "wasp/client/auth";
import { confirmAccountDeletion } from "wasp/client/operations";
import { Button, ButtonLink } from "../shared/components/Button";

export function ConfirmDeleteAccountPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onConfirm() {
    setStatus("busy");
    setMessage(null);
    try {
      await confirmAccountDeletion({ token });
      try {
        await logout();
      } catch {
        // ignore
      }
      setStatus("done");
      setMessage("Account deleted.");
    } catch (e: any) {
      setStatus("error");
      setMessage(e?.message ?? "Invalid or expired link.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-sm px-4 py-10">
      <div className="card p-5">
        <div className="text-xl font-semibold tracking-tight">Delete account</div>
        <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
          {message ?? "This will permanently delete your Memoato data."}
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={!token || status === "busy" || status === "done"}
          >
            {status === "busy" ? "Deleting…" : status === "done" ? "Deleted" : "Delete my account"}
          </Button>
          <ButtonLink to="/" variant="ghost">
            Home
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
