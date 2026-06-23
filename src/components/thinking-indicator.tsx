import { useEffect, useState } from "react";
import { Loader2, Globe, Code2, FileText, Image as ImageIcon, Brain, Search } from "lucide-react";

export type ThinkIntent =
  | "website"
  | "app"
  | "code"
  | "document"
  | "presentation"
  | "research"
  | "general";

const ICONS: Record<ThinkIntent, React.ComponentType<{ className?: string }>> = {
  website: Globe,
  app: Code2,
  code: Code2,
  document: FileText,
  presentation: FileText,
  research: Search,
  general: Brain,
};

const STEPS: Record<ThinkIntent, string[]> = {
  website: [
    "Understanding your website request…",
    "Planning sections and structure…",
    "Choosing the right Studio tool…",
    "Preparing your build link…",
  ],
  app: [
    "Understanding your app idea…",
    "Sketching the architecture…",
    "Choosing the right Studio tool…",
    "Preparing your build link…",
  ],
  code: [
    "Reading your request…",
    "Thinking through the approach…",
    "Drafting the code…",
    "Finalizing the answer…",
  ],
  document: [
    "Understanding the topic…",
    "Outlining sections…",
    "Preparing the document link…",
  ],
  presentation: [
    "Understanding your topic…",
    "Outlining slides…",
    "Preparing the builder link…",
  ],
  research: [
    "Parsing your question…",
    "Gathering relevant context…",
    "Composing the answer…",
  ],
  general: [
    "Thinking…",
    "Composing a response…",
    "Almost there…",
  ],
};

export function detectIntent(text: string): ThinkIntent {
  const v = text.toLowerCase();
  if (/\b(website|landing page|web ?site|homepage|marketing site)\b/.test(v)) return "website";
  if (/\b(app|application|mobile app|web app|saas)\b/.test(v)) return "app";
  if (/\b(presentation|slides|pptx|pitch deck|powerpoint)\b/.test(v)) return "presentation";
  if (/\b(assignment|essay|report|document|docx|pdf|resume|cv)\b/.test(v)) return "document";
  if (/\b(code|function|component|script|debug|refactor|api|sql)\b/.test(v)) return "code";
  if (/\b(explain|what is|how (do|does|to)|why|compare|research|summary)\b/.test(v)) return "research";
  return "general";
}

export function ThinkingIndicator({ intent = "general" }: { intent?: ThinkIntent }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1200);
    return () => clearInterval(t);
  }, []);

  const steps = STEPS[intent];
  const idx = Math.min(steps.length - 1, Math.floor(elapsed / 2));
  const Icon = ICONS[intent];

  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card/60 to-card/30 p-3.5">
      <div className="flex items-center gap-2.5">
        <div className="relative grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <Loader2 className="absolute inset-0 m-auto h-7 w-7 animate-spin text-primary/40" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="shimmer-text text-sm font-medium">{steps[idx]}</div>
          <div className="mt-1 flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-0.5 flex-1 rounded-full transition-all duration-500 ${
                  i <= idx ? "bg-gradient-to-r from-primary to-accent" : "bg-muted/40"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
