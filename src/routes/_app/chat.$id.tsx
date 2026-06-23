import { createFileRoute } from "@tanstack/react-router";
import { ChatWindow } from "@/components/chat/chat-window";

export const Route = createFileRoute("/_app/chat/$id")({
  component: ChatRoute,
});

function ChatRoute() {
  const { id } = Route.useParams();
  return <ChatWindow key={id} conversationId={id} />;
}
