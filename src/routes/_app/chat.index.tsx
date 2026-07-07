import { createFileRoute } from "@tanstack/react-router";

// The chat UI is rendered once by the parent /_app/chat layout so state is
// preserved across /chat <-> /chat/:id transitions. This child route only
// exists so the URL is valid; it renders nothing on its own.
export const Route = createFileRoute("/_app/chat/")({
  component: () => null,
});
