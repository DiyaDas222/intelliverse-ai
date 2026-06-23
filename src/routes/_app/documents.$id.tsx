import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, ListChecks, Search, MessageSquare, Loader2, FileText, Clock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/documents/$id")({
  head: () => ({ meta: [{ title: "Document — IntelliVerse" }] }),
  component: DocumentDetail,
});

type Tab = "summary" | "keypoints" | "search" | "preview";

function DocumentDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("summary");
  const [running, setRunning] = useState<null | "summary" | "keypoints" | "search">(null);
  const [searchQ, setSearchQ] = useState("");

  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id,filename,mime_type,size_bytes,extracted_text,status,created_at")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: analyses = [] } = useQuery({
    queryKey: ["document-analyses", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_analyses")
        .select("id,kind,query,result,created_at")
        .eq("document_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const latestSummary = analyses.find((a) => a.kind === "summary");
  const latestKeypoints = analyses.find((a) => a.kind === "keypoints");
  const searchHistory = analyses.filter((a) => a.kind === "search");

  const run = async (kind: "summary" | "keypoints" | "search", query?: string) => {
    setRunning(kind);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/doc-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ documentId: id, kind, query }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        toast.error(t || "Failed");
        return;
      }
      qc.invalidateQueries({ queryKey: ["document-analyses", id] });
      toast.success(kind === "search" ? "Search complete" : kind === "summary" ? "Summary ready" : "Key points ready");
    } finally {
      setRunning(null);
    }
  };

  const chatWithDoc = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: u.user.id, title: `Chat: ${doc?.filename ?? "document"}` })
      .select("id")
      .single();
    if (error || !data) { toast.error("Couldn't start chat"); return; }
    // store attached doc hint in localStorage so chat-window picks it up
    sessionStorage.setItem(`iv:attach:${data.id}`, JSON.stringify([id]));
    navigate({ to: "/chat/$id", params: { id: data.id } });
  };

  if (isLoading) {
    return <div className="grid h-full place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!doc) {
    return <div className="grid h-full place-items-center text-sm text-muted-foreground">Not found.</div>;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Link to="/documents" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> All documents
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent"><FileText className="h-5 w-5" /></div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight">{doc.filename}</h1>
                <p className="text-xs text-muted-foreground">
                  {doc.mime_type} · {Math.round((doc.size_bytes ?? 0) / 1024)} KB · added {new Date(doc.created_at).toLocaleDateString()}
                  {doc.status === "ocr" && <span className="ml-2 text-accent">OCR running…</span>}
                </p>
              </div>
            </div>
          </div>
          <button onClick={chatWithDoc} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            <MessageSquare className="h-4 w-4" /> Chat with doc
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-1 border-b border-border/60">
          {([
            ["summary", "Summary", Sparkles],
            ["keypoints", "Key points", ListChecks],
            ["search", "Search", Search],
            ["preview", "Preview", FileText],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
                tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "summary" && (
            <Section
              title="AI summary"
              actionLabel={latestSummary ? "Regenerate" : "Generate summary"}
              loading={running === "summary"}
              onAction={() => run("summary")}
            >
              {latestSummary ? (
                <Markdown text={latestSummary.result} />
              ) : (
                <Empty hint="Generate a clean summary of this document." />
              )}
            </Section>
          )}

          {tab === "keypoints" && (
            <Section
              title="Key points"
              actionLabel={latestKeypoints ? "Regenerate" : "Extract key points"}
              loading={running === "keypoints"}
              onAction={() => run("keypoints")}
            >
              {latestKeypoints ? (
                <Markdown text={latestKeypoints.result} />
              ) : (
                <Empty hint="Pull out the most important takeaways as bullets." />
              )}
            </Section>
          )}

          {tab === "search" && (
            <div>
              <form
                onSubmit={(e) => { e.preventDefault(); if (searchQ.trim()) run("search", searchQ.trim()); }}
                className="flex gap-2"
              >
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Ask or search this document…"
                  className="flex-1 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
                <button
                  type="submit"
                  disabled={running === "search" || !searchQ.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  {running === "search" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
                </button>
              </form>
              {searchHistory.length === 0 ? (
                <Empty className="mt-6" hint="Search results appear here, with history of past queries." />
              ) : (
                <div className="mt-6 space-y-4">
                  {searchHistory.map((s) => (
                    <div key={s.id} className="rounded-xl border border-border/60 bg-card/40 p-4">
                      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 font-medium text-foreground">
                          <Search className="h-3 w-3 text-accent" /> {s.query}
                        </span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(s.created_at).toLocaleString()}</span>
                      </div>
                      <div className="mt-3"><Markdown text={s.result} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "preview" && (
            <div className="rounded-xl border border-border/60 bg-card/40 p-4">
              {doc.extracted_text ? (
                <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{doc.extracted_text}</pre>
              ) : (
                <Empty hint={doc.status === "ocr" ? "OCR is running — refresh in a moment." : "No extractable text."} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, actionLabel, onAction, loading, children }: {
  title: string; actionLabel: string; onAction: () => void; loading: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        <button
          onClick={onAction}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-xs hover:border-primary/50 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-accent" />} {actionLabel}
        </button>
      </div>
      <div className="rounded-xl border border-border/60 bg-card/40 p-5">{children}</div>
    </div>
  );
}

function Empty({ hint, className = "" }: { hint: string; className?: string }) {
  return <p className={`text-center text-sm text-muted-foreground ${className}`}>{hint}</p>;
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-ai text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
