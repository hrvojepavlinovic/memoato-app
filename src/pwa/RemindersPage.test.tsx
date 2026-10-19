import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RemindersPage } from "./RemindersPage";
const native = vi.hoisted(() => ({
  enabled: true,
  request: vi.fn(),
  check: vi.fn(),
  cancel: vi.fn(),
  schedule: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => native.enabled },
}));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    requestPermissions: native.request,
    checkPermissions: native.check,
    cancel: native.cancel,
    schedule: native.schedule,
  },
}));
vi.mock("wasp/client/router", async () => {
  const router = await import("react-router-dom");
  return { Link: router.Link };
});
afterEach(cleanup);
beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  native.enabled = true;
  native.check.mockResolvedValue({ display: "prompt" });
  native.request.mockResolvedValue({ display: "granted" });
  native.schedule.mockResolvedValue({});
  native.cancel.mockResolvedValue({});
});
function mount() {
  render(
    <MemoryRouter>
      <RemindersPage />
    </MemoryRouter>,
  );
}
describe("Reminder settings", () => {
  it("does not ask for permissions on mount or while disabling", async () => {
    mount();
    expect(native.request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Reminder disabled.");
    expect(native.request).not.toHaveBeenCalled();
    expect(native.schedule).not.toHaveBeenCalled();
    expect(native.cancel).toHaveBeenCalledWith({
      notifications: [{ id: 101 }],
    });
  });
  it("requests permission only after save and keeps private notification content", async () => {
    mount();
    fireEvent.click(screen.getByRole("checkbox", { name: "Daily reminder" }));
    fireEvent.change(screen.getByLabelText("Time"), {
      target: { value: "19:30" },
    });
    expect(native.request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Reminder scheduled.");
    expect(native.request).toHaveBeenCalledTimes(1);
    expect(native.schedule).toHaveBeenCalledWith({
      notifications: [
        {
          id: 101,
          title: "Memoato",
          body: "Time to check in.",
          schedule: { on: { hour: 19, minute: 30 }, repeats: true },
        },
      ],
    });
  });
  it("does not persist enabled reminders if permission is denied", async () => {
    native.request.mockResolvedValue({ display: "denied" });
    mount();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Notifications permission not granted.");
    expect(native.schedule).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("memoato:reminders:v1")).toBeNull();
  });
  it("keeps scheduling controls unavailable in a browser", () => {
    native.enabled = false;
    mount();
    expect(screen.getByText("Mobile app required")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(native.request).not.toHaveBeenCalled();
  });
});
