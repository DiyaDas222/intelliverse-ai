import { createFileRoute, useMatches } from "@tanstack/react-router";
import { ChatWindow } from "@/components/chat/chat-window";

export const Route = createFileRoute("/_app/chat")({
  component: ChatLayout,
});

function ChatLayout() {
  // Read the current conversation id from whichever child route is matched,
  // without remounting ChatWindow across /chat <-> /chat/:id transitions.
  const matches = useMatches();
  const idMatch = matches.find((m) => (m.params as { id?: string })?.id);
  const conversationId = (idMatch?.params as { id?: string } | undefined)?.id;

  return <ChatWindow conversationId={conversationId} />;
}
