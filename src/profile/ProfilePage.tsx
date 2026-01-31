import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createCategory,
  createEvent,
  deleteCategory,
  exportMyData,
  getCategories,
  getCategoryEvents,
  getProfile,
  requestAccountDeletion,
  requestEmailChange,
  sendPasswordResetForCurrentUser,
  updateCategory,
  updateEvent,
  updateProfile,
  useQuery,
} from "wasp/client/operations";
import { Button } from "../shared/components/Button";
import { usePrivacy } from "../privacy/PrivacyProvider";
import type { PrivacyMode } from "../privacy/types";
import {
  encryptUtf8ToEncryptedString,
  tryDecodeEncryptedString,
  deriveAesGcmKeyFromPassphrase,
  generateCryptoParams,
  isEncryptedString,
} from "../privacy/crypto";
import { decryptCategoryTitle, decryptEventNote } from "../privacy/decryptors";
import {
  localCreateCategory,
  localCreateEvent,
  localDeleteCategory,
  localDeleteEvent,
  localGetCategoryEvents,
  localGetCategoriesWithStats,
  localListCategories,
  localReplaceAll,
  localUpdateCategory,
  localUpdateEvent,
} from "../focus/local";
import type { CategoryWithStats, CategoryEventItem } from "../focus/types";

const inputClassName =
  "h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500";

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function pageAllCategoryEvents(
  categoryId: string,
  fetcher: (args: { categoryId: string; take: number; before?: string }) => Promise<CategoryEventItem[]>,
): Promise<CategoryEventItem[]> {
  const out: CategoryEventItem[] = [];
  let before: string | undefined = undefined;
  for (;;) {
    const page = await fetcher({ categoryId, take: 200, before });
    out.push(...page);
    if (page.length < 200) break;
    const last = page[page.length - 1];
    before = new Date(last.occurredAt as any).toISOString();
  }
  return out;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const q = useQuery(getProfile);
  const privacy = usePrivacy();

  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [pendingMode, setPendingMode] = useState<PrivacyMode>("cloud");
  const [passphrase, setPassphrase] = useState("");
  const [migrationProgress, setMigrationProgress] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!q.data) return;
    setUsername(q.data.username);
    setFirstName(q.data.firstName ?? "");
    setLastName(q.data.lastName ?? "");
  }, [q.data]);

  useEffect(() => {
    setPendingMode(privacy.mode);
  }, [privacy.mode]);

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

  async function ensureCryptoParamsFromExistingEncryptedData(): Promise<void> {
    if (privacy.cryptoParams) return;

    // Try categories first.
    const categories = await getCategories();
    for (const c of categories) {
      const payload = tryDecodeEncryptedString(c.title);
      if (payload) {
        privacy.setCryptoParams(payload.p);
        return;
      }
    }

    // Then scan notes.
    for (const c of categories) {
      const events = await pageAllCategoryEvents(c.id, (args) => getCategoryEvents(args));
      for (const ev of events) {
        const data = ev.data && typeof ev.data === "object" && !Array.isArray(ev.data) ? (ev.data as any) : null;
        const payload = data ? tryDecodeEncryptedString(data.noteEnc) : null;
        if (payload) {
          privacy.setCryptoParams(payload.p);
          return;
        }
      }
    }
  }

  async function ensureUnlocked(): Promise<void> {
    const cleanPass = passphrase.trim();
    if (!cleanPass) {
      window.alert("Enter your passphrase.");
      throw new Error("Missing passphrase");
    }
    if (!privacy.cryptoParams) {
      privacy.setCryptoParams(generateCryptoParams());
    }
    await privacy.unlockWithPassphrase(cleanPass);
  }

  async function migrateCloudToEncrypted(): Promise<void> {
    await ensureUnlocked();
    if (!privacy.key || !privacy.cryptoParams) throw new Error("Encryption not unlocked");

    setMigrationProgress("Encrypting categories…");
    const categories = await getCategories();
    for (const c of categories) {
      if (isEncryptedString(c.title)) continue;
      const encTitle = await encryptUtf8ToEncryptedString(privacy.key, privacy.cryptoParams, c.title);
      await updateCategory({
        categoryId: c.id,
        title: encTitle,
        categoryType: c.categoryType as any,
        period: c.categoryType === "GOAL" ? undefined : (c.period as any) ?? "week",
        unit: c.unit ?? undefined,
        goal: c.goalWeekly ?? undefined,
        goalValue: c.goalValue ?? undefined,
        accentHex: c.accentHex,
        emoji: c.emoji ?? undefined,
      } as any);
    }

    setMigrationProgress("Encrypting notes…");
    for (const c of categories) {
      const events = await pageAllCategoryEvents(c.id, (args) => getCategoryEvents(args));
      for (const ev of events) {
        if (!ev.data || typeof ev.data !== "object" || Array.isArray(ev.data)) continue;
        const data = ev.data as any;
        if (isEncryptedString(data.noteEnc)) continue;
        const note = typeof data.note === "string" ? data.note.trim() : "";
        if (!note) continue;
        const enc = await encryptUtf8ToEncryptedString(privacy.key, privacy.cryptoParams, note);
        await updateEvent({
          eventId: ev.id,
          amount: ev.amount ?? 0,
          occurredAt: toDatetimeLocal(new Date(ev.occurredAt as any)),
          noteEnc: enc,
        });
      }
    }

    privacy.setMode("encrypted");
    setPassphrase("");
  }

  async function migrateEncryptedToCloud(): Promise<void> {
    await ensureCryptoParamsFromExistingEncryptedData();
    await ensureUnlocked();
    if (!privacy.key) throw new Error("Encryption not unlocked");

    setMigrationProgress("Decrypting categories…");
    const categories = await getCategories();
    for (const c of categories) {
      if (!isEncryptedString(c.title)) continue;
      const decTitle = await decryptCategoryTitle(privacy.key as CryptoKey, c.title);
      if (!decTitle) continue;
      await updateCategory({
        categoryId: c.id,
        title: decTitle,
        categoryType: c.categoryType as any,
        period: c.categoryType === "GOAL" ? undefined : (c.period as any) ?? "week",
        unit: c.unit ?? undefined,
        goal: c.goalWeekly ?? undefined,
        goalValue: c.goalValue ?? undefined,
        accentHex: c.accentHex,
        emoji: c.emoji ?? undefined,
      } as any);
    }

    setMigrationProgress("Decrypting notes…");
    for (const c of categories) {
      const events = await pageAllCategoryEvents(c.id, (args) => getCategoryEvents(args));
      for (const ev of events) {
        if (!ev.data || typeof ev.data !== "object" || Array.isArray(ev.data)) continue;
        const note = await decryptEventNote(privacy.key as CryptoKey, ev.data);
        const hasEnc = isEncryptedString((ev.data as any).noteEnc);
        if (!hasEnc) continue;
        await updateEvent({
          eventId: ev.id,
          amount: ev.amount ?? 0,
          occurredAt: toDatetimeLocal(new Date(ev.occurredAt as any)),
          note: note ? note : null,
          noteEnc: null,
        });
      }
    }

    privacy.setMode("cloud");
    privacy.lock();
    setPassphrase("");
  }

  async function migrateCloudToLocal(): Promise<void> {
    if (!privacy.userId) return;

    const ok = window.confirm(
      "Local-only mode stores categories and entries on this device only. Memoato will delete your server data for this account. Continue?",
    );
    if (!ok) return;

    setMigrationProgress("Downloading your data…");
    const categories = await getCategories();
    const now = new Date().toISOString();
    const localCategories = categories.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      categoryType: c.categoryType as any,
      chartType: c.chartType,
      period: (c.period as any) ?? null,
      unit: c.unit ?? null,
      accentHex: c.accentHex,
      emoji: c.emoji ?? null,
      goalWeekly: c.goalWeekly ?? null,
      goalValue: c.goalValue ?? null,
      sourceArchivedAt: null,
      createdAt: now,
      updatedAt: now,
    }));

    const localEvents: Array<any> = [];
    for (const c of categories) {
      const events = await pageAllCategoryEvents(c.id, (args) => getCategoryEvents(args));
      for (const ev of events) {
        localEvents.push({
          id: ev.id,
          kind: "SESSION",
          categoryId: c.id,
          amount: ev.amount ?? 0,
          rawText: ev.rawText ?? null,
          occurredAt: new Date(ev.occurredAt as any).toISOString(),
          occurredOn: toIsoDate(new Date(ev.occurredOn as any)),
          data: ev.data ?? null,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await localReplaceAll({ userId: privacy.userId, categories: localCategories as any, events: localEvents as any });

    setMigrationProgress("Wiping server data…");
    for (const c of categories) {
      await deleteCategory({ categoryId: c.id });
    }

    privacy.setMode("local");
    privacy.lock();
    setPassphrase("");
  }

  async function migrateLocalToCloud(targetMode: "cloud" | "encrypted"): Promise<void> {
    if (!privacy.userId) return;
    const ok = window.confirm("Upload your local-only categories and entries back to the server?");
    if (!ok) return;

    if (targetMode === "encrypted") {
      // If there is existing encrypted data in local, try to re-use its params.
      if (!privacy.cryptoParams) {
        const categories = await localListCategories(privacy.userId);
        for (const c of categories) {
          const payload = tryDecodeEncryptedString(c.title);
          if (payload) {
            privacy.setCryptoParams(payload.p);
            break;
          }
        }
      }
      await ensureUnlocked();
    }

    setMigrationProgress("Reading local data…");
    const localCategories = await localListCategories(privacy.userId);
    const localEventsByCategory: Record<string, CategoryEventItem[]> = {};
    for (const c of localCategories) {
      const all = await pageAllCategoryEvents(c.id, async ({ categoryId, take, before }) =>
        localGetCategoryEvents({ userId: privacy.userId!, categoryId, take, before }),
      );
      localEventsByCategory[c.id] = all;
    }

    setMigrationProgress("Creating categories…");
    const idMap = new Map<string, { id: string; title: string }>();
    for (const c of localCategories) {
      let title = c.title;
      if (targetMode === "encrypted") {
        if (!privacy.key || !privacy.cryptoParams) throw new Error("Encryption not unlocked");
        if (!isEncryptedString(title)) {
          title = await encryptUtf8ToEncryptedString(privacy.key, privacy.cryptoParams, title);
        }
      } else if (isEncryptedString(title)) {
        // Best effort: keep it as-is.
      }

      const created = await createCategory({
        title,
        categoryType: c.categoryType,
        period: c.categoryType === "GOAL" ? undefined : (c.period as any) ?? "week",
        unit: c.unit ?? undefined,
        goal: c.goalWeekly ?? undefined,
        goalValue: c.goalValue ?? undefined,
        accentHex: c.accentHex,
        emoji: c.emoji ?? undefined,
      } as any);
      idMap.set(c.id, { id: created.id, title });
    }

    setMigrationProgress("Creating entries…");
    for (const localCategoryId of Object.keys(localEventsByCategory)) {
      const mapped = idMap.get(localCategoryId);
      if (!mapped) continue;
      const events = localEventsByCategory[localCategoryId] ?? [];
      for (const ev of events) {
        const created = await createEvent({
          categoryId: mapped.id,
          amount: ev.amount ?? 0,
          occurredOn: toIsoDate(new Date(ev.occurredOn as any)),
        });
        // Preserve precise time + note with a follow-up update.
        const data = ev.data && typeof ev.data === "object" && !Array.isArray(ev.data) ? (ev.data as any) : null;
        const note = data && typeof data.note === "string" ? data.note.trim() : "";
        const noteEnc = data && isEncryptedString(data.noteEnc) ? String(data.noteEnc) : null;
        const shouldEncryptNote = targetMode === "encrypted";
        let noteEncToSave: string | null = null;
        let noteToSave: string | null = null;
        if (shouldEncryptNote) {
          if (!privacy.key || !privacy.cryptoParams) throw new Error("Encryption not unlocked");
          const plain = noteEnc ? null : note;
          if (noteEnc) noteEncToSave = noteEnc;
          else if (plain) noteEncToSave = await encryptUtf8ToEncryptedString(privacy.key, privacy.cryptoParams, plain);
        } else {
          noteToSave = noteEnc ? null : (note ? note : null);
        }

        await updateEvent({
          eventId: created.id,
          amount: ev.amount ?? 0,
          occurredAt: toDatetimeLocal(new Date(ev.occurredAt as any)),
          ...(noteEncToSave != null ? { noteEnc: noteEncToSave } : {}),
          ...(noteToSave !== null ? { note: noteToSave } : {}),
          ...(shouldEncryptNote ? {} : { noteEnc: null }),
        } as any);
      }
    }

    privacy.setMode(targetMode);
    if (targetMode === "cloud") privacy.lock();
    setPassphrase("");
  }

  async function onApplyPrivacy() {
    if (!privacy.userId) return;
    setMessage(null);
    setBusy("privacy");
    setMigrationProgress(null);

    try {
      if (pendingMode === privacy.mode) return;

      if (privacy.mode === "cloud" && pendingMode === "encrypted") {
        await migrateCloudToEncrypted();
        setMessage("Encrypted cloud enabled.");
        return;
      }
      if (privacy.mode === "encrypted" && pendingMode === "cloud") {
        await migrateEncryptedToCloud();
        setMessage("Switched to cloud sync.");
        return;
      }
      if (pendingMode === "local") {
        await migrateCloudToLocal();
        setMessage("Switched to local-only mode.");
        return;
      }
      if (privacy.mode === "local" && pendingMode === "cloud") {
        await migrateLocalToCloud("cloud");
        setMessage("Uploaded local data to cloud.");
        return;
      }
      if (privacy.mode === "local" && pendingMode === "encrypted") {
        await migrateLocalToCloud("encrypted");
        setMessage("Uploaded local data to encrypted cloud.");
        return;
      }

      setMessage("Unsupported privacy migration.");
    } catch (e: any) {
      setMessage(e?.message ?? "Privacy change failed.");
    } finally {
      setMigrationProgress(null);
      setBusy(null);
    }
  }

  async function onLock() {
    privacy.lock();
    setPassphrase("");
    setMessage("Locked.");
  }

  if (q.isLoading) {
    return <div className="mx-auto w-full max-w-screen-md px-4 py-6" />;
  }

  return (
    <div className="mx-auto w-full max-w-screen-md px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Profile</h2>
        <p className="text-sm text-neutral-500">Account, privacy, and export.</p>
      </div>

      <div className="space-y-6">
        <div className="card p-4">
          <div className="mb-3 text-sm font-semibold">Account</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="label">Username</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputClassName} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="label">Email</span>
              <input value={emailLabel} disabled className={`${inputClassName} bg-neutral-100`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="label">First name</span>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClassName} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="label">Last name</span>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClassName} />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={onSaveProfile} disabled={busy === "profile"}>
              Save
            </Button>
          </div>
        </div>

        <div className="card p-4">
          <div className="mb-3 text-sm font-semibold">Privacy</div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <label className="flex items-start gap-3">
                <input
                  type="radio"
                  name="privacy"
                  checked={pendingMode === "cloud"}
                  onChange={() => setPendingMode("cloud")}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Cloud sync</div>
                  <div className="text-sm text-neutral-500">Data stored normally (default).</div>
                </div>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="radio"
                  name="privacy"
                  checked={pendingMode === "encrypted"}
                  onChange={() => setPendingMode("encrypted")}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Encrypted cloud</div>
                  <div className="text-sm text-neutral-500">
                    Titles and notes are encrypted before saving to the database.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="radio"
                  name="privacy"
                  checked={pendingMode === "local"}
                  onChange={() => setPendingMode("local")}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Local-only</div>
                  <div className="text-sm text-neutral-500">Data stays on this device (server data wiped).</div>
                </div>
              </label>
            </div>

            {pendingMode === "encrypted" || privacy.mode === "encrypted" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="label">Passphrase</span>
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className={inputClassName}
                    placeholder="Used to unlock on this device"
                    autoComplete="current-password"
                  />
                </label>
                <div className="flex items-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      try {
                        setMessage(null);
                        setBusy("unlock");
                        if (privacy.mode === "encrypted") {
                          await ensureCryptoParamsFromExistingEncryptedData();
                        }
                        await ensureUnlocked();
                        setMessage("Unlocked.");
                      } catch (e: any) {
                        setMessage(e?.message ?? "Failed to unlock.");
                      } finally {
                        setBusy(null);
                      }
                    }}
                    disabled={busy === "unlock"}
                  >
                    Unlock
                  </Button>
                  <Button variant="ghost" onClick={onLock}>
                    Lock
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <Button onClick={onApplyPrivacy} disabled={busy === "privacy"}>
                Apply
              </Button>
            </div>

            {migrationProgress ? <div className="text-sm text-neutral-600">{migrationProgress}</div> : null}
          </div>
        </div>

        <div className="card p-4">
          <div className="mb-3 text-sm font-semibold">Email & security</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="label">Change email</span>
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className={inputClassName}
                placeholder="new@email.com"
              />
            </label>
            <div className="flex items-end justify-end gap-2">
              <Button variant="ghost" onClick={onRequestEmailChange} disabled={busy === "email"}>
                Send confirmation
              </Button>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={onSendPasswordReset} disabled={busy === "password"}>
              Reset password
            </Button>
            <Button variant="ghost" onClick={onRequestDeletion} disabled={busy === "delete"}>
              Delete account
            </Button>
          </div>
        </div>

        <div className="card p-4">
          <div className="mb-3 text-sm font-semibold">Data</div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onExport} disabled={busy === "export"}>
              Export
            </Button>
            <Button variant="ghost" onClick={() => navigate("/")}>
              Back
            </Button>
          </div>
        </div>

        {message ? <div className="text-sm text-neutral-700">{message}</div> : null}
      </div>
    </div>
  );
}

