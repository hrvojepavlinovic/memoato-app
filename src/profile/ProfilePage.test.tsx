import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProfilePage } from "./ProfilePage";
const mock = vi.hoisted(() => ({
  profile: {
    username: "example",
    email: "example@example.test",
    firstName: "Example",
    lastName: "Person",
    hasEmailAuth: true,
    hasGoogleAuth: false,
    nextUpEnabled: true,
    quickLogFabSide: "right",
    homeCategoryLayout: "list",
    activeKcalRollupEnabled: null,
    publicStatsEnabled: false,
    publicStatsCategoryIds: [],
    apiKeys: [],
  },
  failed: false,
  refreshFailed: false,
  refetch: vi.fn(),
  privacy: { mode: "cloud", key: null, userId: "example" },
  categories: [],
  overview: { processing: { openRouterConfigured: false } },
  update: vi.fn(),
  createKey: vi.fn(),
  deletion: vi.fn(),
}));
vi.mock("wasp/client/operations", () => ({
  createCategory: vi.fn(),
  createApiKey: mock.createKey,
  createEvent: vi.fn(),
  deleteApiKey: vi.fn(),
  deleteCategory: vi.fn(),
  ensureDefaultCategories: vi.fn(),
  exportMyData: vi.fn(),
  getCategories: "categories",
  getCategoryEvents: vi.fn(),
  getMemoryOverview: "overview",
  getProfile: "profile",
  requestAccountDeletion: mock.deletion,
  requestEmailChange: vi.fn(),
  revokeApiKey: vi.fn(),
  rotatePublicStatsToken: vi.fn(),
  sendPasswordResetForCurrentUser: vi.fn(),
  setActiveKcalRollupMode: vi.fn(),
  setHomeCategoryLayout: vi.fn(),
  setNextUpEnabled: vi.fn(),
  setPublicStatsCategories: vi.fn(),
  setPublicStatsEnabled: vi.fn(),
  setQuickLogFabSide: vi.fn(),
  updateCategory: vi.fn(),
  updateEvent: vi.fn(),
  updateProfile: mock.update,
  useQuery: (operation: string) => ({
    data: mock.failed
      ? undefined
      : operation === "profile"
        ? mock.profile
        : operation === "categories"
          ? mock.categories
          : mock.overview,
    isLoading: false,
    isError: mock.failed || (operation === "profile" && mock.refreshFailed),
    refetch: mock.refetch,
  }),
}));
vi.mock("../privacy/PrivacyProvider", () => ({
  usePrivacy: () => mock.privacy,
}));
vi.mock("../theme/ThemeProvider", () => ({
  useTheme: () => ({
    preference: "light",
    isDark: false,
    setPreference: vi.fn(),
  }),
}));
vi.mock("wasp/client/router", async () => {
  const router = await import("react-router-dom");
  return { Link: router.Link };
});
beforeEach(() => {
  mock.failed = false;
  mock.refreshFailed = false;
  mock.privacy.mode = "cloud";
  vi.clearAllMocks();
  mock.refetch.mockResolvedValue({});
  mock.update.mockResolvedValue({});
  mock.createKey.mockResolvedValue({ token: "synthetic-token" });
});
afterEach(cleanup);
function mount(hash = "") {
  return render(
    <MemoryRouter initialEntries={["/profile" + hash]}>
      <ProfilePage />
    </MemoryRouter>,
  );
}
describe("Profile settings", () => {
  it("uses linked sections and preserves drafts while moving between them", () => {
    mount();
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Unsaved" },
    });
    fireEvent.click(screen.getByRole("link", { name: "Privacy" }));
    expect(screen.queryByRole("heading", { name: "Account" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Privacy" })).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Account" }));
    expect(
      (screen.getByLabelText("First name") as HTMLInputElement).value,
    ).toBe("Unsaved");
  });
  it("locks overlapping settings changes while preserving the existing profile payload", async () => {
    let finish!: () => void;
    mock.update.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    mount();
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "  Updated  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.getByLabelText("Username").closest("fieldset")?.disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("link", { name: "Privacy" }));
    expect(screen.getByRole("heading", { name: "Account" })).toBeTruthy();
    expect(mock.update).toHaveBeenCalledWith({
      username: "example",
      firstName: "Updated",
      lastName: "Person",
    });
    finish();
    await screen.findByText("Profile updated.");
  });
  it("does not overwrite an account draft after unrelated profile preferences refresh", () => {
    const view = mount();
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Unsaved" },
    });
    mock.profile = {
      ...mock.profile,
      nextUpEnabled: !mock.profile.nextUpEnabled,
    };
    view.rerender(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );
    expect(
      (screen.getByLabelText("First name") as HTMLInputElement).value,
    ).toBe("Unsaved");
  });
  it("keeps irreversible deletion behind the existing confirmation", () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(mock.deletion).not.toHaveBeenCalled();
  });
  it("supports direct privacy links and does not make any privacy change on navigation", () => {
    mount("#privacy");
    expect(screen.getByRole("heading", { name: "Privacy" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create key" })).toBeNull();
    expect(mock.update).not.toHaveBeenCalled();
  });
  it("creates a key only with the explicitly chosen access and retains its one-time token across sections", async () => {
    mount("#ai");
    fireEvent.click(
      screen.getByRole("radio", { name: "Context packets only" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    await waitFor(() =>
      expect(mock.createKey).toHaveBeenCalledWith({
        name: "ChatGPT MCP",
        access: "context",
        expiresAt: null,
      }),
    );
    await screen.findByDisplayValue("synthetic-token");
    fireEvent.click(screen.getByRole("link", { name: "Account" }));
    fireEvent.click(screen.getByRole("link", { name: "AI & API" }));
    expect(screen.getByDisplayValue("synthetic-token")).toBeTruthy();
  });
  it("keeps the one-time API token visible when the follow-up profile refresh fails", async () => {
    mock.refetch.mockImplementation(async () => {
      mock.refreshFailed = true;
      return { error: new Error("Offline") };
    });
    mount("#ai");
    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    await screen.findByDisplayValue("synthetic-token");
    expect(screen.getByRole("alert").textContent).toContain(
      "any new API key remain available",
    );
    expect(screen.getByDisplayValue("synthetic-token")).toBeTruthy();
  });
  it("shows a failed profile fetch without enabling account operations", () => {
    mock.failed = true;
    mount();
    expect(screen.getByRole("alert").textContent).toContain(
      "couldn’t be loaded",
    );
    expect(screen.queryByRole("button", { name: "Delete account" })).toBeNull();
  });
});
