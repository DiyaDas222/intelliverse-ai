import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Trash2, Loader2, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ACCEPT_ATTR, extractText, isImage, SUPPORTED_EXTS } from "@/lib/doc-extract.client";

export const Route = createFileRoute("/_app/documents")({
  head: () => ({ meta: [{ title: "Documents — IntelliVerse" }] }),
  component: DocumentsPage,
});

const MAX_BYTES = 15 * 1024 * 1024; // 15MB

function DocumentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id,filename,mime_type,size_bytes,created_at,status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = search
    ? docs.filter((d) => d.filename.toLowerCase().includes(search.toLowerCase()))
    : docs;

  const delDoc = useMutation({
    mutationFn: async (id: string) => {
      const { data: row } = await supabase
        .from("documents")
        .select("storage_path")
        .eq("id", id)
        .single();
      if (row?.storage_path) await supabase.storage.from("documents").remove([row.storage_path]);
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  const onUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name} exceeds 15MB`);
          continue;
        }
        let extracted = "";
        let needsOcr = false;
        try {
          const r = await extractText(file);
          extracted = r.text;
          needsOcr = r.needsOcr;
        } catch (e) {
          console.error(e);
          toast.error(`Couldn't parse ${file.name}`);
          continue;
        }
        const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (upErr) {
          toast.error(`Upload failed: ${upErr.message}`);
          continue;
        }
        const { data: inserted, error: insErr } = await supabase
          .from("documents")
          .insert({
            user_id: user.id,
            filename: file.name,
            mime_type: file.type || "application/octet-stream",
            size_bytes: file.size,
            storage_path: path,
            extracted_text: extracted,
            status: needsOcr ? "ocr" : "ready",
          })
          .select("id")
          .single();
        if (insErr || !inserted) {
          toast.error(insErr?.message ?? "Insert failed");
          continue;
        }
        if (needsOcr) {
          // Kick off OCR in background
          toast.message(`OCR running on ${file.name}…`);
          (async () => {
            const { data: sess } = await supabase.auth.getSession();
            const token = sess.session?.access_token;
            const res = await fetch("/api/doc-action", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ documentId: inserted.id, kind: "ocr" }),
            });
            if (res.ok) {
              await supabase.from("documents").update({ status: "ready" }).eq("id", inserted.id);
              qc.invalidateQueries({ queryKey: ["documents"] });
              toast.success(`OCR complete: ${file.name}`);
            } else {
              toast.error(`OCR failed: ${file.name}`);
            }
          })();
        }
        toast.success(`${file.name} added`);
      }
      qc.invalidateQueries({ queryKey: ["documents"] });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/chat" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Back to chat
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload PDFs, Word docs, text files, or images. Open any document to summarize, extract key points, search, or chat.
            </p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload
          </button>
          <input ref={inputRef} type="file" multiple accept={ACCEPT_ATTR} className="hidden" onChange={(e) => onUpload(e.target.files)} />
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onUpload(e.dataTransfer.files); }}
          className="mt-6 rounded-xl border-2 border-dashed border-border/80 bg-card/30 p-10 text-center"
        >
          <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm">Drag & drop files here, or click Upload</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Supported: {SUPPORTED_EXTS.join(", ")} · Max 15MB each
          </p>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Your documents</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="w-56 rounded-md border border-border/60 bg-card/40 px-3 py-1.5 text-xs outline-none focus:border-primary/60"
          />
        </div>
        {isLoading ? (
          <div className="mt-4 grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border/60 bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">No documents.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60 rounded-xl border border-border/60 bg-card/40">
            {filtered.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent">
                  {isImage(d.filename) ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </div>
                <Link to="/documents/$id" params={{ id: d.id }} className="min-w-0 flex-1 group">
                  <div className="truncate text-sm font-medium group-hover:text-primary">{d.filename}</div>
                  <div className="text-xs text-muted-foreground">
                    {Math.round((d.size_bytes ?? 0) / 1024)} KB · {new Date(d.created_at).toLocaleDateString()}
                    {d.status === "ocr" && <span className="ml-2 text-accent">OCR running…</span>}
                  </div>
                </Link>
                <button onClick={() => delDoc.mutate(d.id)} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
