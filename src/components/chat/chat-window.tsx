import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  Copy,
  RefreshCcw,
  Sparkles,
  Square,
  FileText as FileIcon,
  X,
  Loader2,
  ChevronDown,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CHAT_MODELS, DEFAULT_MODEL, isValidModel } from "@/lib/models";

type Msg = { id: string; role: "user" | "assistant"; content: string; created_at?: string };

type DocumentRow = { id: string; filename: string };

const SUGGESTIONS = [
  "Explain quantum entanglement like I'm 12",
  "Draft a polite email asking for a deadline extension",
  "Write a Python function to debounce calls",
  "Plan a 7-day Tokyo trip in October",
];

export function ChatWindow({ conversationId }: { conversationId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [attachedDocIds, setAttachedDocIds] = useState<string[]>([]);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = localStorage.getItem("iv:model");
    if (isValidModel(m)) setModel(m);
  }, []);

  const updateModel = (id: string) => {
    setModel(id);
    localStorage.setItem("iv:model", id);
    setShowModelMenu(false);
  };

  const currentModel = CHAT_MODELS.find((m) => m.id === model) ?? CHAT_MODELS[0];

  // Load messages when conversationId changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,role,content,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) {
        toast.error("Couldn't load this chat");
        return;
      }
      setMessages((data ?? []) as Msg[]);
    })();
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [conversationId]);

  const { data: documents = [] } = useQuery({
    queryKey: ["documents", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<DocumentRow[]> => {
      const { data, error } = await supabase
        .from("documents")
        .select("id,filename")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming || !user) return;
    setInput("");

    let convId = conversationId;
    if (!convId) {
      const title = text.slice(0, 60);
      const { data, error } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title })
        .select("id")
        .single();
      if (error || !data) {
        toast.error("Couldn't start a chat");
        return;
      }
      convId = data.id;
      qc.invalidateQueries({ queryKey: ["conversations"] });
      // navigate but keep state by rendering optimistic
      navigate({ to: "/chat/$id", params: { id: convId } });
    }

    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);

    // persist user message
    await supabase
      .from("messages")
      .insert({ conversation_id: convId, user_id: user.id, role: "user", content: text });

    // bump conversation updated_at
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);

    // call streaming endpoint
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          documentIds: attachedDocIds,
          model,
        }),
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        if (res.status === 429) toast.error("Rate limit reached. Please wait a moment.");
        else if (res.status === 402) toast.error("AI credits exhausted. Please add credits.");
        else toast.error(errText || "AI request failed");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)),
        );
      }
      // persist final assistant message
      await supabase.from("messages").insert({
        conversation_id: convId,
        user_id: user.id,
        role: "assistant",
        content: acc,
      });
      // auto-rename short titles
      if (messages.length === 0) {
        const newTitle = text.slice(0, 60);
        await supabase.from("conversations").update({ title: newTitle }).eq("id", convId);
        qc.invalidateQueries({ queryKey: ["conversations"] });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // Persist whatever we got
        const partial = messages.find((m) => m.id === assistantId)?.content ?? "";
        if (partial) {
          await supabase.from("messages").insert({
            conversation_id: convId!,
            user_id: user.id,
            role: "assistant",
            content: partial,
          });
        }
      } else {
        console.error(err);
        toast.error("Something went wrong");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const regenerate = async () => {
    // find last user message
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser || !conversationId || !user) return;
    // remove last assistant from DB & state
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAssistant?.id && lastAssistant.created_at) {
      // only delete if persisted (has created_at)
      await supabase.from("messages").delete().eq("id", lastAssistant.id);
    }
    setMessages((prev) => prev.filter((m) => m.id !== lastAssistant?.id));
    await sendMessage(lastUser.content);
  };

  return (
    <div className="relative flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6">
        <div className="truncate text-sm font-medium text-muted-foreground">
          {conversationId ? "Chat" : "New chat"}
        </div>
        <div className="shrink-0 text-xs text-muted-foreground">Gemini 3 Flash</div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          {messages.length === 0 && (
            <div className="grid min-h-[60vh] place-items-center text-center">
              <div>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent">
                  <Sparkles className="h-7 w-7 text-primary-foreground" />
                </div>
                <h1 className="mt-5 text-2xl font-semibold tracking-tight">
                  How can I help today?
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ask anything. Attach documents to chat with them.
                </p>
                <div className="mx-auto mt-8 grid max-w-2xl gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="rounded-xl border border-border/60 bg-card/40 px-4 py-3 text-left text-sm transition-all hover:border-primary/50 hover:bg-card"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            return (
              <div key={m.id} className="mb-6">
                {m.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div className="group flex gap-3">
                    <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent">
                      <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {m.content ? (
                        <div className="prose-ai text-sm text-foreground">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                          Thinking…
                        </div>
                      )}
                      {!streaming && m.content && (
                        <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(m.content);
                              toast.success("Copied");
                            }}
                            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          {isLast && (
                            <button
                              onClick={regenerate}
                              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                            >
                              <RefreshCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 bg-background/80 px-3 py-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur sm:px-4 sm:py-4">
        <div className="mx-auto max-w-3xl">
          {attachedDocIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachedDocIds.map((id) => {
                const doc = documents.find((d) => d.id === id);
                if (!doc) return null;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-xs"
                  >
                    <FileIcon className="h-3 w-3 text-accent" />
                    {doc.filename}
                    <button
                      onClick={() => setAttachedDocIds((p) => p.filter((x) => x !== id))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <div className="relative rounded-2xl border border-border bg-card/80 focus-within:border-primary/60">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              rows={1}
              placeholder="Message IntelliVerse… (Shift+Enter for newline)"
              className="block w-full resize-none bg-transparent px-4 py-3.5 pr-24 text-sm outline-none placeholder:text-muted-foreground"
              style={{ minHeight: 52, maxHeight: 200 }}
            />
            <div className="absolute bottom-2 left-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDocPicker((s) => !s)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                  title="Attach document"
                >
                  <FileIcon className="h-4 w-4" />
                </button>
                {showDocPicker && (
                  <div className="absolute bottom-10 left-0 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
                    <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                      Attach context
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                      {documents.length === 0 && (
                        <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                          No documents yet.
                        </div>
                      )}
                      {documents.map((d) => {
                        const on = attachedDocIds.includes(d.id);
                        return (
                          <button
                            key={d.id}
                            onClick={() => {
                              setAttachedDocIds((p) =>
                                on ? p.filter((x) => x !== d.id) : [...p, d.id],
                              );
                            }}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent/10 ${
                              on ? "bg-accent/10" : ""
                            }`}
                          >
                            <FileIcon className="h-3.5 w-3.5 text-accent" />
                            <span className="truncate">{d.filename}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="absolute bottom-2 right-2">
              {streaming ? (
                <button
                  onClick={stop}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-destructive text-destructive-foreground"
                  title="Stop"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim()}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground disabled:opacity-40"
                  title="Send"
                >
                  {streaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            IntelliVerse can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
