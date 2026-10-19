import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { CategoryPage } from "./CategoryPage";
const mock = vi.hoisted(() => ({
  create: vi.fn(),
  categories: [
    {
      id: "notes",
      title: "Notes",
      slug: "notes",
      chartType: "bar",
      categoryType: "NUMBER",
      accentHex: "#526b54",
      unit: null,
      goalWeekly: null,
      thisWeekTotal: 0,
      period: "week",
    },
  ],
  empty: [],
}));
vi.mock("wasp/client/operations", () => ({
  createEvent: mock.create,
  getCategories: "categories",
  getCategorySeries: "series",
  getCategoryLineSeries: "line",
  getCategoryContributions: "contributions",
  useQuery: (operation: string) => ({
    data: operation === "categories" ? mock.categories : mock.empty,
    isSuccess: true,
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("../privacy/PrivacyProvider", () => ({
  usePrivacy: () => ({ mode: "cloud", key: null }),
}));
vi.mock("../theme/ThemeProvider", () => ({
  useTheme: () => ({ isDark: false }),
}));
vi.mock("./components/BarChart", () => ({ BarChart: () => null }));
vi.mock("./components/LineChart", () => ({ LineChart: () => null }));
vi.mock("./components/ContributionsChart", () => ({
  ContributionsChart: () => null,
}));
vi.mock("./components/HistoryList", () => ({ HistoryList: () => null }));
vi.mock("wasp/client/router", async () => {
  const { Link } = await import("react-router-dom");
  return {
    routes: { EditCategoryRoute: { to: "/c/:categorySlug/edit" } },
    Link: ({ to, params, ...props }: any) => (
      <Link to={params ? `/c/${params.categorySlug}/edit` : to} {...props} />
    ),
  };
});
afterEach(cleanup);
beforeEach(() => {
  mock.create.mockReset();
});
function mount() {
  render(
    <MemoryRouter initialEntries={["/c/notes"]}>
      <Routes>
        <Route path="/c/:categorySlug" element={<CategoryPage />} />
      </Routes>
    </MemoryRouter>,
  );
}
describe("View entry capture", () => {
  it("keeps a failed draft available and makes the save failure visible", async () => {
    mock.create.mockRejectedValue(new Error("Connection unavailable."));
    mount();
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "Keep this draft." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByRole("alert");
    expect((screen.getByLabelText("Note") as HTMLTextAreaElement).value).toBe(
      "Keep this draft.",
    );
  });
  it("prevents duplicate entries while preserving the existing raw note payload", async () => {
    let finish!: () => void;
    mock.create.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    mount();
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "A useful note." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(mock.create).toHaveBeenCalledTimes(1);
    expect(mock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: "notes",
        amount: 1,
        note: "A useful note.",
        rawText: "A useful note.",
        occurredOn: expect.any(String),
      }),
    );
    expect(screen.getByLabelText("Note").closest("fieldset")?.disabled).toBe(
      true,
    );
    finish();
    await screen.findByDisplayValue("");
  });
});
