import { useEffect, useMemo, useState } from "react";
import { Link } from "wasp/client/router";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Button } from "../shared/components/Button";

const STORAGE_KEY = "memoato:reminders:v1";
const NOTIFICATION_ID = 101;

type ReminderSettings = {
  enabled: boolean;
  time: string; // "HH:MM"
};

function parseTime(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function loadSettings(): ReminderSettings {
  if (typeof window === "undefined") return { enabled: false, time: "20:00" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: false, time: "20:00" };
    const parsed = JSON.parse(raw);
    const enabled = !!parsed?.enabled;
    const time = typeof parsed?.time === "string" ? parsed.time : "20:00";
    return { enabled, time };
  } catch {
    return { enabled: false, time: "20:00" };
  }
}

function saveSettings(s: ReminderSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

export function RemindersPage() {
  const isNative = useMemo(() => Capacitor.isNativePlatform(), []);
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("20:00");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSettings();
    setEnabled(s.enabled);
    setTime(s.time);
  }, []);

  async function ensurePermissions(): Promise<boolean> {
    const perm = await LocalNotifications.requestPermissions();
    return perm.display === "granted";
  }

  async function cancelReminder(): Promise<void> {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
  }

  async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
    await cancelReminder();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIFICATION_ID,
          title: "Memoato",
          body: "Time to check in.",
          schedule: {
            on: { hour, minute },
            repeats: true,
          },
        },
      ],
    });
  }

  async function onSave() {
    setMessage(null);
    setBusy("save");
    try {
      const parsed = parseTime(time);
      if (!parsed) {
        setMessage("Pick a valid time (HH:MM).");
        return;
      }

      if (!isNative) {
        setMessage("Reminders are available in the mobile app.");
        return;
      }

      const ok = await ensurePermissions();
      if (!ok) {
        setMessage("Notifications permission not granted.");
        return;
      }

      if (enabled) {
        await scheduleDailyReminder(parsed.hour, parsed.minute);
      } else {
        await cancelReminder();
      }

      saveSettings({ enabled, time });
      setMessage(enabled ? "Reminder scheduled." : "Reminder disabled.");
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to update reminder.");
    } finally {
      setBusy(null);
    }
  }

  async function onTest() {
    setMessage(null);
    setBusy("test");
    try {
      if (!isNative) {
        setMessage("Test notifications work only in the mobile app.");
        return;
      }
      const ok = await ensurePermissions();
      if (!ok) {
        setMessage("Notifications permission not granted.");
        return;
      }
      const at = new Date(Date.now() + 5000);
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 999,
            title: "Memoato",
            body: "Test notification (5s).",
            schedule: { at },
          },
        ],
      });
      setMessage("Scheduled test notification.");
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to schedule test notification.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-md px-4 py-6">
      <div className="mb-4">
        <div className="text-sm text-neutral-500 dark:text-neutral-400">
          <Link to="/profile" className="hover:underline">
            ← Back to profile
          </Link>
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Reminders</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Schedule a daily reminder. Notification text is generic for privacy.
        </p>
      </div>

      <div className="space-y-3">
        {!isNative ? (
          <div className="card p-4">
            <div className="text-sm font-semibold">Mobile app required</div>
            <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Install memoato on your phone to enable reminders.
            </div>
          </div>
        ) : null}

        <div className="card p-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-semibold">Daily reminder</span>
          </label>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="flex flex-col gap-1">
              <span className="label">Time</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              />
            </label>
            <Button onClick={onSave} disabled={busy === "save"} className="h-10 w-full sm:w-auto">
              Save
            </Button>
          </div>

          <div className="mt-3 flex justify-end">
            <Button variant="ghost" onClick={onTest} disabled={busy === "test"} className="w-full sm:w-auto">
              Test notification
            </Button>
          </div>
        </div>
      </div>

      {message ? <div className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{message}</div> : null}
    </div>
  );
}
