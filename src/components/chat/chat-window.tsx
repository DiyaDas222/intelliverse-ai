import { useEffect, useRef, useState, useCallback } from "react";
import { authedFetch } from "@/lib/authed-fetch";
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
  Mic,
  Plus,
  Image as ImageIcon,
  Pencil,
  Trash2,
  Check,
  AudioLines,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CHAT_MODELS, DEFAULT_MODEL, isValidModel } from "@/lib/models";
import { GenerationProgress } from "@/components/generation-progress";
import { ThinkingIndicator, detectIntent } from "@/components/thinking-indicator";
import { CreationWizard, detectWizardKind, type WizardKind, type WizardResult } from "@/components/chat/creation-wizard";
import { useServerFn } from "@tanstack/react-start";
import { createVibeProject } from "@/lib/vibe.functions";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  edited?: boolean;
  images?: string[];
  wizardKind?: WizardKind;
  wizardDone?: boolean;
};

type DocumentRow = { id: string; filename: string };

const SUGGESTIONS = [
  "Explain quantum entanglement like I'm 12",
  "Draft a polite email asking for a deadline extension",
  "Write a Python function to debounce calls",
  "Plan a 7-day Tokyo trip in October",
];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(file);
  });
}

export function ChatWindow({ conversationId }: { conversationId?: string }) {
  const navigate = useNavigate();
  const createVibe = useServerFn(createVibeProject);
  const qc = useQueryClient();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [attachedDocIds, setAttachedDocIds] = useState<string[]>([]);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recorder = useVoiceRecorder();

  // Persisted model preference
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

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [input]);

  // Load messages when conversationId changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setAttachedDocIds([]);
      return;
    }
    try {
      const key = `iv:attach:${conversationId}`;
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const ids = JSON.parse(raw) as string[];
        if (Array.isArray(ids)) setAttachedDocIds(ids);
        sessionStorage.removeItem(key);
      }
    } catch { /* ignore */ }
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,role,content,created_at,edited,images")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) {
        toast.error("Couldn't load this chat");
        return;
      }
      setMessages((data ?? []) as unknown as Msg[]);
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

  // Core send. `historyOverride` lets edit-and-regenerate replay from a truncated history.
  const runChat = useCallback(
    async (convId: string, history: Msg[]) => {
      const assistantId = crypto.randomUUID();
      setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        const res = await authedFetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
          body: JSON.stringify({
            messages: history.map((m) => ({
              role: m.role,
              content: m.content,
              images: m.images,
            })),
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
        if (user) {
          await supabase.from("messages").insert({
            conversation_id: convId,
            user_id: user.id,
            role: "assistant",
            content: acc,
          });
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error(err);
          toast.error("Something went wrong");
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [attachedDocIds, model, user],
  );

  const sendMessage = async (text: string, images: string[] = []) => {
    const body = text.trim();
    if ((!body && images.length === 0) || streaming || !user) return;
    setInput("");
    setPendingImages([]);

    let convId = conversationId;
    if (!convId) {
      const title = (body || "Image chat").slice(0, 60);
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
      navigate({ to: "/chat/$id", params: { id: convId } });
    }

    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: body,
      images: images.length ? images : undefined,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);

    // Fire-and-forget persistence so we don't block the AI request on DB round-trips.
    void supabase
      .from("messages")
      .insert({
        conversation_id: convId,
        user_id: user.id,
        role: "user",
        content: body,
        ...(images.length ? { images } : {}),
      } as never);
    void supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", convId);


    // Creation wizard intercept
    const wizardKind = detectWizardKind(body);
    if (wizardKind) {
      const assistantId = crypto.randomUUID();
      const intro = `Let's build your ${wizardKind} together. I've prepared a quick wizard — pick options below.`;
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: intro, wizardKind }]);
      await supabase.from("messages").insert({
        conversation_id: convId,
        user_id: user.id,
        role: "assistant",
        content: intro,
      });
      return;
    }

    if (messages.length === 0 && body) {
      const newTitle = body.slice(0, 60);
      void supabase.from("conversations").update({ title: newTitle }).eq("id", convId);
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }


    await runChat(convId, nextHistory);
  };

  const stop = () => abortRef.current?.abort();

  // Regenerate the last assistant message (no edit).
  const regenerateAssistant = async (assistantId: string) => {
    if (!conversationId || !user || streaming) return;
    const idx = messages.findIndex((m) => m.id === assistantId);
    if (idx === -1) return;
    const trimmed = messages.slice(0, idx);
    if (trimmed.length === 0 || trimmed[trimmed.length - 1].role !== "user") return;
    // delete persisted assistant + any later messages
    const toDelete = messages.slice(idx);
    await Promise.all(
      toDelete
        .filter((m) => m.created_at)
        .map((m) => supabase.from("messages").delete().eq("id", m.id)),
    );
    setMessages(trimmed);
    await runChat(conversationId, trimmed);
  };

  // Truncate all messages from `fromId` (inclusive) — used after editing a user prompt.
  const truncateFrom = async (fromId: string) => {
    const idx = messages.findIndex((m) => m.id === fromId);
    if (idx === -1) return [] as Msg[];
    const toDelete = messages.slice(idx);
    await Promise.all(
      toDelete
        .filter((m) => m.created_at)
        .map((m) => supabase.from("messages").delete().eq("id", m.id)),
    );
    const kept = messages.slice(0, idx);
    setMessages(kept);
    return kept;
  };

  const deleteMessage = async (id: string) => {
    const m = messages.find((x) => x.id === id);
    if (!m) return;
    if (m.created_at) await supabase.from("messages").delete().eq("id", id);
    setMessages((prev) => prev.filter((x) => x.id !== id));
  };

  const saveEditedPrompt = async (id: string) => {
    if (!conversationId || !user) return;
    const newText = editingDraft.trim();
    if (!newText) {
      toast.error("Prompt can't be empty");
      return;
    }
    const original = messages.find((m) => m.id === id);
    if (!original) return;
    setEditingId(null);
    setEditingDraft("");

    // Truncate everything AFTER this message, then update this one.
    const idx = messages.findIndex((m) => m.id === id);
    const after = messages.slice(idx + 1);
    await Promise.all(
      after.filter((m) => m.created_at).map((m) => supabase.from("messages").delete().eq("id", m.id)),
    );
    if (original.created_at) {
      await supabase
        .from("messages")
        .update({ content: newText, edited: true } as never)
        .eq("id", id);
    }
    const editedMsg: Msg = { ...original, content: newText, edited: true };
    const newHistory = [...messages.slice(0, idx), editedMsg];
    setMessages(newHistory);
    await runChat(conversationId, newHistory);
  };

  const handleWizardComplete = async (msgId: string, result: WizardResult) => {
    sessionStorage.setItem(`iv:wizard-brief:${result.kind}`, result.brief);
    const followup = `**${result.kind.charAt(0).toUpperCase() + result.kind.slice(1)} brief ready ✓**\n\n${result.summary}\n\n[Open the builder with your brief pre-filled →](${result.studioPath})`;
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, content: followup, wizardDone: true } : m)));
    if (conversationId && user) {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "assistant",
        content: followup,
      });
    }
    navigate({ to: result.studioPath as never });
  };

  // ----- File / image attachment handlers -----
  const handleImagePicked = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: string[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > MAX_IMAGE_BYTES) {
        toast.error(`${f.name} is over 5 MB`);
        continue;
      }
      try {
        added.push(await fileToDataUrl(f));
      } catch {
        toast.error(`Couldn't read ${f.name}`);
      }
    }
    if (added.length) setPendingImages((p) => [...p, ...added].slice(0, 4));
  };

  // PDF/DOCX/TXT/CSV files upload to the existing documents pipeline.
  const handleDocPicked = async (files: FileList | null) => {
    if (!files || !user) return;
    setShowPlusMenu(false);
    for (const f of Array.from(files)) {
      const toastId = toast.loading(`Uploading ${f.name}…`);
      try {
        // Upload to storage bucket "documents" mirroring documents page convention.
        const path = `${user.id}/${crypto.randomUUID()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, f, {
          contentType: f.type || undefined,
        });
        if (upErr) throw upErr;
        // Extract text client-side for plain types only; server can re-process via existing flow.
        let text = "";
        if (/^text\//.test(f.type) || /\.(txt|csv|md|json)$/i.test(f.name)) {
          text = await f.text();
        }
        const { data: doc, error: insErr } = await supabase
          .from("documents")
          .insert({
            user_id: user.id,
            filename: f.name,
            mime_type: f.type || "application/octet-stream",
            size_bytes: f.size,
            storage_path: path,
            extracted_text: text,
            status: text ? "ready" : "uploaded",
          })
          .select("id")
          .single();
        if (insErr || !doc) throw insErr ?? new Error("Insert failed");
        setAttachedDocIds((p) => [...p, doc.id]);
        qc.invalidateQueries({ queryKey: ["documents"] });
        toast.success(`Attached ${f.name}`, { id: toastId });
      } catch (err) {
        toast.error((err as Error).message || "Upload failed", { id: toastId });
      }
    }
  };

  // ----- Drag and drop -----
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const images: File[] = [];
    const docs: File[] = [];
    Array.from(files).forEach((f) => (f.type.startsWith("image/") ? images : docs).push(f));
    if (images.length) {
      const dt = new DataTransfer();
      images.forEach((f) => dt.items.add(f));
      handleImagePicked(dt.files);
    }
    if (docs.length) {
      const dt = new DataTransfer();
      docs.forEach((f) => dt.items.add(f));
      handleDocPicked(dt.files);
    }
  };

  // ----- Mic -----
  const onMicClick = async () => {
    if (recorder.state === "recording") {
      const blob = await recorder.stop();
      if (!blob) {
        toast.error("Recording was empty");
        return;
      }
      const form = new FormData();
      form.append("file", blob, "recording.webm");
      try {
        const res = await authedFetch("/api/transcribe", { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok) {
          toast.error(data.error || "Transcription failed");
          return;
        }
        if (data.text) {
          setInput((p) => (p ? p + " " : "") + data.text);
          textareaRef.current?.focus();
        }
      } catch {
        toast.error("Couldn't transcribe");
      }
    } else {
      await recorder.start();
    }
  };

  return (
    <div
      className="relative flex h-full flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={onDrop}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-primary/10 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-primary/60 bg-background/90 px-8 py-6 text-center">
            <p className="text-sm font-medium">Drop files to attach</p>
            <p className="text-xs text-muted-foreground">Images sent to AI · Documents added as context</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6">
        <div className="truncate text-sm font-medium text-muted-foreground">
          {conversationId ? "Chat" : "New chat"}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate({ to: "/chat/voice" as never })}
            className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card/40 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            title="Voice conversation"
          >
            <AudioLines className="h-3.5 w-3.5" />
            Voice mode
          </button>
          <div className="relative">
            <button
              onClick={() => setShowModelMenu((s) => !s)}
              className="flex items-center gap-1 rounded-md border border-border/60 bg-card/40 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {currentModel.label}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showModelMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowModelMenu(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
                  <div className="border-b border-border px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Choose model
                  </div>
                  <div className="max-h-72 overflow-y-auto py-1">
                    {CHAT_MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => updateModel(m.id)}
                        className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-xs hover:bg-accent/10 ${
                          m.id === model ? "bg-accent/10" : ""
                        }`}
                      >
                        <span className="font-medium text-foreground">{m.label}</span>
                        <span className="text-muted-foreground">{m.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
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
                <h1 className="mt-5 text-2xl font-semibold tracking-tight">How can I help today?</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ask anything. Drop files or images, dictate with the mic.
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
            const isEditing = editingId === m.id;
            const lastUserContent = [...messages].reverse().find((x) => x.role === "user")?.content ?? "";

            if (m.role === "user") {
              return (
                <div key={m.id} className="group mb-6 flex flex-col items-end">
                  {isEditing ? (
                    <div className="w-full max-w-[85%] rounded-2xl border border-primary/60 bg-card p-3">
                      <textarea
                        value={editingDraft}
                        onChange={(e) => setEditingDraft(e.target.value)}
                        className="block w-full resize-none bg-transparent text-sm outline-none"
                        rows={Math.min(8, Math.max(2, editingDraft.split("\n").length))}
                        autoFocus
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditingDraft("");
                          }}
                          className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:bg-accent/10"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEditedPrompt(m.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90"
                        >
                          <Check className="h-3 w-3" />
                          Save & regenerate
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {m.images && m.images.length > 0 && (
                        <div className="mb-1.5 flex flex-wrap justify-end gap-1.5">
                          {m.images.map((src, idx) => (
                            <img
                              key={idx}
                              src={src}
                              alt="attached"
                              className="max-h-40 max-w-[200px] rounded-xl border border-border object-cover"
                            />
                          ))}
                        </div>
                      )}
                      {m.content && (
                        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                          {m.content}
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {m.edited && (
                          <span className="mr-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            edited
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setEditingId(m.id);
                            setEditingDraft(m.content);
                          }}
                          className="rounded-md p-1 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(m.content);
                            toast.success("Copied");
                          }}
                          className="rounded-md p-1 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                          title="Copy"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteMessage(m.id)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            }

            // Assistant message
            return (
              <div key={m.id} className="group mb-6 flex gap-3">
                <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent">
                  <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  {m.content ? (
                    <div className="prose-ai text-sm text-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <ThinkingIndicator intent={detectIntent(lastUserContent)} />
                  )}
                  {m.wizardKind && !m.wizardDone && (
                    <div className="mt-3">
                      <CreationWizard
                        kind={m.wizardKind}
                        onComplete={(result) => handleWizardComplete(m.id, result)}
                      />
                    </div>
                  )}
                  {!streaming && m.content && (
                    <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(m.content);
                          toast.success("Copied");
                        }}
                        className="rounded-md p-1 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                        title="Copy"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {isLast && (
                        <button
                          onClick={() => regenerateAssistant(m.id)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                          title="Regenerate"
                        >
                          <RefreshCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteMessage(m.id)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 bg-background/80 px-3 py-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur sm:px-4 sm:py-4">
        <div className="mx-auto max-w-3xl">
          {/* Attached docs chips */}
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
          {/* Pending images preview */}
          {pendingImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingImages.map((src, i) => (
                <div key={i} className="relative">
                  <img
                    src={src}
                    alt=""
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                  />
                  <button
                    onClick={() => setPendingImages((p) => p.filter((_, j) => j !== i))}
                    className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-background ring-1 ring-border"
                    aria-label="Remove image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Recording UI */}
          {recorder.state === "recording" && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-destructive/80">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                </span>
                <span className="text-xs text-muted-foreground">Recording…</span>
              </div>
              <div className="flex flex-1 items-end justify-center gap-[2px]">
                {recorder.levels.map((v, i) => (
                  <span
                    key={i}
                    style={{ height: `${Math.max(4, v * 28)}px` }}
                    className="w-[3px] rounded-full bg-destructive/70 transition-all"
                  />
                ))}
              </div>
              <button
                onClick={recorder.cancel}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
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
                  sendMessage(input, pendingImages);
                }
              }}
              rows={1}
              placeholder="Message IntelliVerse… (Shift+Enter for newline)"
              className="block w-full resize-none bg-transparent px-4 py-3.5 pl-20 pr-24 text-sm outline-none placeholder:text-muted-foreground"
              style={{ minHeight: 56, maxHeight: 220 }}
            />

            {/* Left cluster: + menu & mic */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPlusMenu((s) => !s)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                  title="Add files"
                >
                  <Plus className="h-4 w-4" />
                </button>
                {showPlusMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowPlusMenu(false)} />
                    <div className="absolute bottom-10 left-0 z-20 w-56 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
                      <button
                        onClick={() => {
                          setShowPlusMenu(false);
                          imageInputRef.current?.click();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/10"
                      >
                        <ImageIcon className="h-4 w-4 text-accent" /> Upload image
                      </button>
                      <button
                        onClick={() => {
                          setShowPlusMenu(false);
                          fileInputRef.current?.click();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/10"
                      >
                        <FileIcon className="h-4 w-4 text-accent" /> Upload document
                      </button>
                      <button
                        onClick={() => {
                          setShowPlusMenu(false);
                          setShowDocPicker(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/10"
                      >
                        <FileIcon className="h-4 w-4 text-accent" /> Attach saved document
                      </button>
                    </div>
                  </>
                )}
                {showDocPicker && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowDocPicker(false)} />
                    <div className="absolute bottom-10 left-0 z-20 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
                      <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                        Attach saved document
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
                              onClick={() =>
                                setAttachedDocIds((p) =>
                                  on ? p.filter((x) => x !== d.id) : [...p, d.id],
                                )
                              }
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
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={onMicClick}
                disabled={recorder.state === "processing"}
                className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${
                  recorder.state === "recording"
                    ? "bg-destructive text-destructive-foreground"
                    : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                } disabled:opacity-50`}
                title={recorder.state === "recording" ? "Stop & transcribe" : "Dictate"}
              >
                {recorder.state === "processing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Right cluster: send / stop */}
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
                  onClick={() => sendMessage(input, pendingImages)}
                  disabled={!input.trim() && pendingImages.length === 0}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground disabled:opacity-40"
                  title="Send"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <p className="mt-2 flex items-center justify-center gap-3 text-center text-xs text-muted-foreground">
            <span>IntelliVerse can make mistakes. Verify important information.</span>
            {input.length > 0 && <span>· {input.length} chars</span>}
          </p>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleImagePicked(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.csv,.md,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv"
        multiple
        className="hidden"
        onChange={(e) => {
          handleDocPicked(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
