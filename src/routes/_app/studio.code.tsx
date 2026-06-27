import { createFileRoute } from "@tanstack/react-router";
import Editor from "@monaco-editor/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bug,
  Code2,
  Download,
  Eraser,
  FileCode2,
  Play,
  Send,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/studio/code")({
  component: StudioCode,
});

const LANGS = [
  "javascript", "typescript", "tsx", "jsx", "html", "css", "json",
  "python", "java", "csharp", "cpp", "c", "go", "rust", "php",
  "ruby", "swift", "kotlin", "dart", "scala", "sql", "shell",
  "yaml", "markdown", "xml", "lua", "r", "plaintext",
];

const EXT_TO_LANG: Record<string, string> = {
  js: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "tsx", jsx: "jsx",
  html: "html", htm: "html", css: "css", json: "json",
  py: "python", java: "java", cs: "csharp",
  cpp: "cpp", cc: "cpp", cxx: "cpp", h: "cpp", hpp: "cpp", c: "c",
  go: "go", rs: "rust", php: "php", rb: "ruby",
  swift: "swift", kt: "kotlin", dart: "dart", scala: "scala",
  sql: "sql", sh: "shell", bash: "shell", yml: "yaml", yaml: "yaml",
  md: "markdown", xml: "xml", lua: "lua", r: "r", txt: "plaintext",
};

const SAMPLE = `// Welcome to IntelliVerse Code Studio
// Paste any code, ask the AI to edit, debug, explain or complete.
// Replies appear in the side panel — in whatever language you ask in.

function fibonacci(n) {
  if (n < 2) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10));
`;

type ChatMsg = { role: "user" | "assistant"; content: string };

function StudioCode() {
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(SAMPLE);
  const [filename, setFilename] = useState("snippet.js");
  const [instruction, setInstruction] = useState("");
  const [errorText, setErrorText] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const previewable = language === "html" || /<html|<!doctype/i.test(code);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const previewDoc = useMemo(() => {
    if (language === "html") return code;
    if (language === "css") return `<!doctype html><html><head><style>${code}</style></head><body><h1>CSS preview</h1><p>Edit the CSS to see results.</p><button>Button</button></body></html>`;
    if (language === "javascript" || language === "typescript") {
      return `<!doctype html><html><body><pre id="out" style="font:13px ui-monospace,Menlo,monospace;white-space:pre-wrap"></pre><script>
        const out=document.getElementById('out');
        const orig=console.log;
        console.log=(...a)=>{out.textContent+=a.map(x=>typeof x==='object'?JSON.stringify(x,null,2):String(x)).join(' ')+'\\n';orig(...a)};
        window.onerror=(m)=>{out.textContent+='Error: '+m+'\\n'};
        try{${code}}catch(e){out.textContent+='Error: '+e.message}
      </script></body></html>`;
    }
    return "<html><body style=\"font:14px system-ui;padding:24px;color:#666\">Live preview is available for HTML, CSS and JavaScript.</body></html>";
  }, [code, language]);

  function onUpload(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const lang = EXT_TO_LANG[ext];
    const reader = new FileReader();
    reader.onload = () => {
      setCode(String(reader.result || ""));
      setFilename(file.name);
      if (lang) setLanguage(lang);
    };
    reader.readAsText(file);
  }

  function download() {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename || "snippet.txt"; a.click();
    URL.revokeObjectURL(url);
  }

  async function runAction(action: "edit" | "debug" | "explain" | "complete" | "chat", text?: string) {
    const promptText = text ?? instruction;
    if (action === "chat" && !promptText.trim()) return;
    setStreaming(true);
    const userMsg: ChatMsg = {
      role: "user",
      content:
        action === "chat"
          ? promptText
          : `**${action.toUpperCase()}**${promptText ? ` — ${promptText}` : ""}`,
    };
    const nextHistory = [...messages, userMsg];
    setMessages([...nextHistory, { role: "assistant", content: "" }]);
    setInstruction("");

    try {
      const res = await fetch("/api/code-assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          language,
          code,
          instruction: promptText,
          error: errorText,
          history: messages.slice(-10),
        }),
      });
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "Request failed");
        throw new Error(t || "Request failed");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (e: any) {
      toast.error(e?.message || "AI request failed");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  }

  function applyLastCodeBlock() {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last) return toast.error("No AI response yet");
    const match = last.content.match(/```[\w-]*\n([\s\S]*?)```/);
    if (!match) return toast.error("No code block found in the last reply");
    setCode(match[1]);
    toast.success("Applied AI code to editor");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-card/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent">
            <Code2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">Code Studio</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">Any language in · any language out</p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {LANGS.map((l) => <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1 h-3.5 w-3.5" />Open
          </Button>
          <Button size="sm" variant="outline" onClick={download}>
            <Download className="mr-1 h-3.5 w-3.5" />Save
          </Button>
          <Button size="sm" variant={showPreview ? "default" : "outline"} onClick={() => setShowPreview((v) => !v)} disabled={!previewable && language !== "css" && language !== "javascript" && language !== "typescript"}>
            <Play className="mr-1 h-3.5 w-3.5" />Preview
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_420px]">
        <div className="flex min-h-0 flex-col border-r border-border/60">
          <div className="flex items-center gap-2 border-b border-border/60 bg-card/30 px-3 py-1.5 text-xs text-muted-foreground">
            <FileCode2 className="h-3.5 w-3.5" />
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="bg-transparent outline-none"
            />
          </div>
          <div className={`grid min-h-0 flex-1 ${showPreview ? "grid-rows-2" : "grid-rows-1"}`}>
            <div className="min-h-0">
              <Editor
                height="100%"
                language={language}
                value={code}
                onChange={(v) => setCode(v ?? "")}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  smoothScrolling: true,
                  automaticLayout: true,
                  padding: { top: 8 },
                }}
              />
            </div>
            {showPreview && (
              <div className="min-h-0 border-t border-border/60 bg-white">
                <iframe
                  title="preview"
                  className="h-full w-full"
                  sandbox="allow-scripts"
                  srcDoc={previewDoc}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col bg-card/20">
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">AI Assistant</span>
            <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={() => setMessages([])}>
              <Eraser className="mr-1 h-3 w-3" />Clear
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-border/60 px-3 py-2">
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => runAction("edit")} disabled={streaming}>
              <Wand2 className="mr-1 h-3 w-3" />Edit
            </Button>
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => runAction("debug")} disabled={streaming}>
              <Bug className="mr-1 h-3 w-3" />Debug
            </Button>
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => runAction("explain")} disabled={streaming}>
              Explain
            </Button>
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => runAction("complete")} disabled={streaming}>
              Complete
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={applyLastCodeBlock} disabled={streaming}>
              Apply to editor
            </Button>
          </div>

          {errorText !== undefined && (
            <div className="border-b border-border/60 px-3 py-2">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Error / stack (optional)</label>
              <Textarea
                value={errorText}
                onChange={(e) => setErrorText(e.target.value)}
                placeholder="Paste a runtime error here, then click Debug"
                className="mt-1 h-16 resize-none text-xs"
              />
            </div>
          )}

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm">
            {messages.length === 0 && (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-xs text-muted-foreground">
                Ask in <strong>any language</strong> — English, हिन्दी, Español, 中文, العربية, etc.
                The AI will reply in the same language. Try: <em>"मेरे कोड में bug ढूँढो"</em> or <em>"explica este código"</em>.
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-6 rounded-lg bg-primary/10 px-3 py-2 text-sm"
                    : "mr-6 whitespace-pre-wrap rounded-lg bg-muted/40 px-3 py-2 text-sm leading-relaxed"
                }
              >
                {m.content || (streaming ? "…" : "")}
              </div>
            ))}
          </div>

          <div className="border-t border-border/60 p-2">
            <div className="flex items-end gap-2">
              <Textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    runAction("chat");
                  }
                }}
                placeholder="Ask anything about your code (any language)…"
                className="min-h-[44px] resize-none text-sm"
              />
              <Button size="icon" onClick={() => runAction("chat")} disabled={streaming || !instruction.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
