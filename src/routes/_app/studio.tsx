import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/studio")({
  head: () => ({ meta: [{ title: "AI Creation Studio — IntelliVerse" }] }),
  component: () => <Outlet />,
});
