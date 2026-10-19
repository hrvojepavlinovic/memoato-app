import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ViewsPage } from "./ViewsPage";
const state = vi.hoisted(() => ({
  data: undefined as any,
  isLoading: false,
  isError: false,
}));
vi.mock("wasp/client/operations", () => ({
  getCategories: "categories",
  useQuery: () => state,
}));
vi.mock("../privacy/PrivacyProvider", () => ({
  usePrivacy: () => ({ mode: "cloud", key: null }),
}));
vi.mock("../theme/ThemeProvider", () => ({
  useTheme: () => ({ isDark: false }),
}));
vi.mock("wasp/client/router", async () => {
  const { Link } = await import("react-router-dom");
  return {
    Link: ({ to, params, ...props }: any) => (
      <Link to={params ? `/c/${params.categorySlug}` : to} {...props} />
    ),
    routes: { CategoryRoute: { to: "/c/:categorySlug" } },
  };
});
afterEach(cleanup);
beforeEach(() => {
  state.data = undefined;
  state.isLoading = false;
  state.isError = false;
});
function mount() {
  render(
    <MemoryRouter>
      <ViewsPage />
    </MemoryRouter>,
  );
}
describe("Views", () => {
  it("distinguishes loading and failure from an empty account without a render loop", () => {
    state.isLoading = true;
    const result = render(
      <MemoryRouter>
        <ViewsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("status").textContent).toContain("Loading");
    expect(screen.queryByText(/No views yet/)).toBeNull();
    state.isLoading = false;
    state.isError = true;
    result.rerender(
      <MemoryRouter>
        <ViewsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText(/No views yet/)).toBeNull();
  });
  it("keeps cached views visible when a background refresh fails", () => {
    state.data = [
      {
        id: "walk",
        slug: "walking",
        title: "Walking",
        accentHex: "#526b54",
        unit: "min",
        categoryType: "NUMBER",
        chartType: "bar",
        period: "week",
        thisWeekTotal: 20,
      },
    ];
    state.isError = true;
    mount();
    expect(screen.getByRole("alert").textContent).toContain("last loaded");
    expect(
      screen.getByRole("link", { name: /Walking Activity 20 min/ }),
    ).toBeTruthy();
  });
  it("keeps creation available for a genuinely empty account", () => {
    state.data = [];
    mount();
    expect(
      screen
        .getByRole("link", { name: "Create your first view" })
        .getAttribute("href"),
    ).toBe("/categories/new");
  });
  it("uses each view's aggregate period and the latest value for trends", () => {
    state.data = [
      {
        id: "monthly",
        slug: "walking",
        title: "Walking",
        accentHex: "#526b54",
        unit: "min",
        categoryType: "NUMBER",
        chartType: "bar",
        period: "month",
        thisWeekTotal: 120,
        todayTotal: 20,
      },
      {
        id: "trend",
        slug: "sleep",
        title: "Sleep",
        accentHex: "#526b54",
        unit: "h",
        categoryType: "NUMBER",
        chartType: "line",
        lastValue: 7.5,
      },
    ];
    mount();
    expect(
      screen
        .getByRole("link", { name: /Walking Activity 120 min this month/ })
        .getAttribute("href"),
    ).toBe("/c/walking");
    expect(
      screen.getByRole("link", { name: /Sleep Trend 7.5 h latest/ }),
    ).toBeTruthy();
  });
});
