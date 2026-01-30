import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  exportMyData,
  getProfile,
  requestAccountDeletion,
  requestEmailChange,
  sendPasswordResetForCurrentUser,
  updateProfile,
  useQuery,
} from "wasp/client/operations";
import { Button } from "../shared/components/Button";

const inputClassName =
  "h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500";

export function ProfilePage() {
  const navigate = useNavigate();
  const q = useQuery(getProfile);

  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!q.data) return;
    setUsername(q.data.username);
    setFirstName(q.data.firstName ?? "");
    setLastName(q.data.lastName ?? "");
  }, [q.data]);

  const emailLabel = useMemo(() => {
    if (!q.data?.email) return "—";
    return q.data.isEmailVerified ? q.data.email : `${q.data.email} (unverified)`;
  }, [q.data?.email, q.data?.isEmailVerified]);

  async function onSaveProfile() {
    setMessage(null);
    setBusy("profile");
    try {
      await updateProfile({
        username,
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
      });
      setMessage("Profile updated.");
      await q.refetch();
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to update profile.");
    } finally {
      setBusy(null);
    }
  }

  async function onRequestEmailChange() {
    setMessage(null);
    setBusy("email");
    try {
      await requestEmailChange({ newEmail });
      setNewEmail("");
      setMessage("Confirmation email sent (check your inbox).");
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to request email change.");
    } finally {
      setBusy(null);
    }
  }

  async function onSendPasswordReset() {
    setMessage(null);
    setBusy("password");
    try {
      await sendPasswordResetForCurrentUser();
      setMessage("Password reset email sent.");
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to send password reset email.");
    } finally {
      setBusy(null);
    }
  }

  async function onRequestDeletion() {
    const ok = window.confirm(
      "Send a confirmation email to delete your account? This will permanently delete your data.",
    );
    if (!ok) return;

    setMessage(null);
    setBusy("delete");
    try {
      await requestAccountDeletion();
      setMessage("Account deletion email sent.");
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to request account deletion.");
    } finally {
      setBusy(null);
    }
  }

  async function onExport() {
    setMessage(null);
    setBusy("export");
    try {
      const payload = await exportMyData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `memoato-export-${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage("Export downloaded.");
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to export data.");
    } finally {
      setBusy(null);
    }
  }

  if (q.isLoading) return <div className="mx-auto w-full max-w-screen-lg px-4 py-10" />;
  if (!q.isSuccess) {
    return (
      <div className="mx-auto w-full max-w-screen-lg px-4 py-10">
        <div className="text-2xl font-semibold tracking-tight">Profile</div>
        <div className="mt-2 text-sm text-neutral-600">Failed to load profile.</div>
        <div className="mt-4">
          <Button onClick={() => navigate("/")}>Go home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-md px-4 py-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Profile</h2>
          <p className="mt-1 text-sm text-neutral-500">Manage your account details.</p>
        </div>
      </div>

      {message ? (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-800 shadow-sm">
          {message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4">
        <div className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Account</div>
              <div className="mt-1 text-xs font-medium text-neutral-500">
                Username and optional name fields.
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="label">Username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClassName}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="label">First name (optional)</span>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClassName}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="label">Last name (optional)</span>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClassName}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              className="h-10 w-full sm:w-auto"
              variant="ghost"
              onClick={onExport}
              disabled={busy != null}
            >
              {busy === "export" ? "Exporting…" : "Export data"}
            </Button>
            <Button className="h-10 w-full sm:w-auto" onClick={onSaveProfile} disabled={busy != null}>
              {busy === "profile" ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>

        <div className="card p-4">
          <div className="text-sm font-semibold text-neutral-900">Email</div>
          <div className="mt-1 text-xs font-medium text-neutral-500">
            Changing your email requires confirming the new address.
          </div>
          <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
            <span className="font-medium text-neutral-600">Current:</span>{" "}
            <span className="font-semibold text-neutral-900">{emailLabel}</span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="flex flex-col gap-1 sm:col-span-1">
              <span className="label">New email</span>
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                inputMode="email"
                placeholder="you@example.com"
                className={inputClassName}
              />
            </label>
            <div className="flex">
              <Button
                className="h-10 w-full sm:w-auto"
                onClick={onRequestEmailChange}
                disabled={busy != null || !newEmail.trim()}
              >
                {busy === "email" ? "Sending…" : "Send confirmation"}
              </Button>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="text-sm font-semibold text-neutral-900">Password</div>
          <div className="mt-1 text-xs font-medium text-neutral-500">
            We’ll email you a password reset link.
          </div>
          <div className="mt-4 flex">
            <Button className="h-10 w-full sm:w-auto sm:ml-auto" onClick={onSendPasswordReset} disabled={busy != null}>
              {busy === "password" ? "Sending…" : "Send reset email"}
            </Button>
          </div>
        </div>

        <div className="card p-4">
          <div className="text-sm font-semibold text-neutral-900">Danger zone</div>
          <div className="mt-1 text-xs font-medium text-neutral-500">
            Delete account (requires email confirmation).
          </div>
          <div className="mt-4 flex">
            <Button
              className="h-10 w-full sm:w-auto sm:ml-auto"
              variant="danger"
              onClick={onRequestDeletion}
              disabled={busy != null}
            >
              {busy === "delete" ? "Sending…" : "Delete account"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
