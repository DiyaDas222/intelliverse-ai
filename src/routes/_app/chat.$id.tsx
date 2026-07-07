import { createFileRoute } from "@tanstack/react-router";

// The chat UI is rendered by the parent /_app/chat layout, keyed on the URL
// param, so we don't remount ChatWindow (which would drop in-flight streaming)
// when navigating from /chat to /chat/:id after starting a new conversation.
export const Route = createFileRoute("/_app/chat/$id")({
  component: () => null,
});
