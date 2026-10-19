export const appNavigation = [
  { to: "/", label: "Today", icon: "today", paths: ["/", "/onboarding"] },
  {
    to: "/memory",
    label: "Memory",
    icon: "memory",
    paths: ["/memory", "/timeline"],
  },
  { to: "/recall", label: "Recall", icon: "recall", paths: ["/recall"] },
  {
    to: "/views",
    label: "Views",
    icon: "views",
    paths: ["/views", "/c", "/categories"],
  },
  { to: "/context", label: "Context", icon: "context", paths: ["/context"] },
] as const;

export function isNavigationActive(
  path: string,
  prefixes: readonly string[],
): boolean {
  return prefixes.some((prefix) =>
    prefix === "/"
      ? path === "/"
      : path === prefix || path.startsWith(`${prefix}/`),
  );
}
