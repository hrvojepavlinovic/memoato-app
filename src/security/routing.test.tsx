import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  createMemoryRouter, RouterProvider, Link, Navigate,
  Outlet, useParams, useSearchParams,
} from "react-router-dom";

afterEach(cleanup);

function Category() {
  return <h1>Category {useParams().id}</h1>;
}

function EmailCallback() {
  const [params] = useSearchParams();
  return <h1>Confirm {params.get("token")}</h1>;
}

function makeRouter(path: string) {
  return createMemoryRouter([{
    path: "/",
    element: <><Link to="/category/training">Training</Link><Outlet /></>,
    children: [
      { index: true, element: <h1>Home</h1> },
      { path: "category/:id", element: <Category /> },
      { path: "context", element: <Navigate to="/login" replace /> },
      { path: "login", element: <h1>Log in</h1> },
      { path: "confirm-email-change", element: <EmailCallback /> },
      { path: "*", element: <h1>Not found</h1> },
    ],
  }], { initialEntries: [path] });
}

it("preserves Wasp-style nested routes, links and path parameters on Router 7", async () => {
  const router = makeRouter("/");
  render(<RouterProvider router={router} />);
  expect(screen.getByRole("heading", { name: "Home" })).toBeTruthy();
  fireEvent.click(screen.getByRole("link", { name: "Training" }));
  expect(await screen.findByRole("heading", { name: "Category training" })).toBeTruthy();
  expect(router.state.location.pathname).toBe("/category/training");
  router.dispose();
});

it.each([
  ["/context", "Log in"],
  ["/confirm-email-change?token=demo", "Confirm demo"],
  ["/missing/page", "Not found"],
])("preserves redirects, callback queries and fallback routes: %s", async (path, heading) => {
  const router = makeRouter(path);
  render(<RouterProvider router={router} />);
  expect(await screen.findByRole("heading", { name: heading })).toBeTruthy();
  router.dispose();
});
