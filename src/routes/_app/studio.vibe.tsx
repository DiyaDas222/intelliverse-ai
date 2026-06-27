import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/studio/vibe")({
  component: () => <Outlet />,
});
