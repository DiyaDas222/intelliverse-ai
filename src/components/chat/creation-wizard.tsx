import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";

export type WizardKind =
  | "website"
  | "app"
  | "presentation"
  | "assignment"
  | "project"
  | "image"
  | "video"
  | "audio"
  | "music";

type Field =
  | { id: string; question: string; help?: string; type: "cards"; multi?: boolean; options: { value: string; label: string; desc?: string }[]; required?: boolean }
  | { id: string; question: string; help?: string; type: "text"; placeholder?: string; required?: boolean }
  | { id: string; question: string; help?: string; type: "textarea"; placeholder?: string; required?: boolean };

type Schema = {
  kind: WizardKind;
  title: string;
  ctaLabel: string;
  studioPath: string; // route to navigate to after submit
  fields: Field[];
  buildBrief: (answers: Record<string, string | string[]>) => string;
};

const SCHEMAS: Record<WizardKind, Schema> = {
  website: {
    kind: "website",
    title: "Website Builder",
    ctaLabel: "Generate Website",
    studioPath: "/studio/docs?kind=website",
    fields: [
      {
        id: "type",
        question: "What type of website do you want?",
        type: "cards",
        required: true,
        options: [
          { value: "Portfolio", label: "Portfolio", desc: "Showcase your work" },
          { value: "Business", label: "Business", desc: "Company / agency site" },
          { value: "E-commerce", label: "E-commerce", desc: "Sell products online" },
          { value: "Blog", label: "Blog", desc: "Articles & stories" },
          { value: "Landing Page", label: "Landing Page", desc: "Single conversion page" },
          { value: "Educational", label: "Educational", desc: "Courses / school" },
          { value: "SaaS", label: "SaaS", desc: "Product marketing" },
          { value: "Other", label: "Other" },
        ],
      },
      { id: "name", question: "What's the website name?", type: "text", placeholder: "e.g. Aurora Studio", required: true },
      {
        id: "pages",
        question: "Which pages should be included?",
        type: "cards",
        multi: true,
        required: true,
        options: [
          { value: "Home", label: "Home" },
          { value: "About", label: "About" },
          { value: "Services", label: "Services" },
          { value: "Products", label: "Products" },
          { value: "Pricing", label: "Pricing" },
          { value: "Blog", label: "Blog" },
          { value: "Contact", label: "Contact" },
          { value: "Dashboard", label: "Dashboard" },
          { value: "Admin Panel", label: "Admin Panel" },
        ],
      },
      {
        id: "theme",
        question: "Pick a visual theme",
        type: "cards",
        required: true,
        options: [
          { value: "Light", label: "Light", desc: "Clean & airy" },
          { value: "Dark", label: "Dark", desc: "Sleek & modern" },
          { value: "Modern", label: "Modern", desc: "Bold typography" },
          { value: "Corporate", label: "Corporate", desc: "Trustworthy" },
          { value: "Glassmorphism", label: "Glassmorphism", desc: "Frosted layers" },
          { value: "Minimal", label: "Minimal", desc: "Less is more" },
        ],
      },
      {
        id: "features",
        question: "Which features do you need?",
        type: "cards",
        multi: true,
        options: [
          { value: "Authentication", label: "Authentication" },
          { value: "Database", label: "Database" },
          { value: "Payments", label: "Payments" },
          { value: "Chatbot", label: "Chatbot" },
          { value: "AI Features", label: "AI Features" },
          { value: "Admin Dashboard", label: "Admin Dashboard" },
          { value: "Analytics", label: "Analytics" },
        ],
      },
      { id: "extra", question: "Any additional requirements?", type: "textarea", placeholder: "Tone, color preferences, integrations, target audience…" },
    ],
    buildBrief: (a) =>
      `Generate a ${a.type} website named "${a.name}".
Pages: ${(a.pages as string[]).join(", ")}.
Theme: ${a.theme}.
Features: ${(a.features as string[] | undefined)?.join(", ") || "none specified"}.
Additional: ${a.extra || "n/a"}.`,
  },

  app: {
    kind: "app",
    title: "App Builder",
    ctaLabel: "Generate App",
    studioPath: "/studio/docs?kind=app",
    fields: [
      {
        id: "platform",
        question: "Which platform?",
        type: "cards",
        required: true,
        options: [
          { value: "Web App", label: "Web App" },
          { value: "iOS", label: "iOS" },
          { value: "Android", label: "Android" },
          { value: "Cross-platform", label: "Cross-platform" },
        ],
      },
      { id: "name", question: "App name?", type: "text", placeholder: "e.g. TaskFlow", required: true },
      { id: "features", question: "Core features (one per line)", type: "textarea", placeholder: "User accounts\nKanban board\nReal-time updates", required: true },
      {
        id: "needs",
        question: "What does it need?",
        type: "cards",
        multi: true,
        options: [
          { value: "Authentication", label: "Authentication" },
          { value: "Database", label: "Database" },
          { value: "Admin Panel", label: "Admin Panel" },
          { value: "Payments", label: "Payments" },
          { value: "Push Notifications", label: "Push Notifications" },
        ],
      },
      {
        id: "style",
        question: "Design style?",
        type: "cards",
        required: true,
        options: [
          { value: "Minimal", label: "Minimal" },
          { value: "Playful", label: "Playful" },
          { value: "Corporate", label: "Corporate" },
          { value: "Dark", label: "Dark" },
        ],
      },
    ],
    buildBrief: (a) =>
      `Generate a ${a.platform} app named "${a.name}".
Features:\n${a.features}
Needs: ${(a.needs as string[] | undefined)?.join(", ") || "none"}.
Style: ${a.style}.`,
  },

  presentation: {
    kind: "presentation",
    title: "Presentation Builder",
    ctaLabel: "Generate Presentation",
    studioPath: "/studio/docs?kind=presentation",
    fields: [
      { id: "topic", question: "What's the topic?", type: "text", placeholder: "e.g. Climate change in 2026", required: true },
      { id: "slides", question: "How many slides?", type: "cards", required: true, options: ["5", "8", "10", "12", "15", "20"].map((v) => ({ value: v, label: `${v} slides` })) },
      {
        id: "audience",
        question: "Who's the audience?",
        type: "cards",
        required: true,
        options: [
          { value: "Students", label: "Students" },
          { value: "Investors", label: "Investors" },
          { value: "Executives", label: "Executives" },
          { value: "General Public", label: "General Public" },
          { value: "Team", label: "Internal Team" },
        ],
      },
      {
        id: "style",
        question: "Tone & style?",
        type: "cards",
        required: true,
        options: [
          { value: "Academic", label: "Academic" },
          { value: "Business", label: "Business" },
          { value: "Pitch", label: "Pitch Deck" },
          { value: "Creative", label: "Creative" },
        ],
      },
      { id: "extra", question: "Anything to include?", type: "textarea", placeholder: "Specific points, data, sections…" },
    ],
    buildBrief: (a) =>
      `Generate a ${a.slides}-slide ${a.style} presentation on "${a.topic}" for ${a.audience}.
Extra: ${a.extra || "n/a"}.`,
  },

  assignment: {
    kind: "assignment",
    title: "Assignment Builder",
    ctaLabel: "Generate Assignment",
    studioPath: "/studio/docs?kind=assignment",
    fields: [
      { id: "subject", question: "Subject?", type: "text", placeholder: "e.g. Computer Science", required: true },
      { id: "topic", question: "Specific topic?", type: "text", placeholder: "e.g. Sorting algorithms", required: true },
      {
        id: "level",
        question: "Academic level?",
        type: "cards",
        required: true,
        options: [
          { value: "High School", label: "High School" },
          { value: "Undergraduate", label: "Undergraduate" },
          { value: "Graduate", label: "Graduate" },
          { value: "PhD", label: "PhD" },
        ],
      },
      {
        id: "words",
        question: "Approximate word count?",
        type: "cards",
        required: true,
        options: ["500", "1000", "2000", "3000", "5000"].map((v) => ({ value: v, label: `${v} words` })),
      },
      {
        id: "citation",
        question: "Citation style?",
        type: "cards",
        required: true,
        options: [
          { value: "APA", label: "APA" },
          { value: "MLA", label: "MLA" },
          { value: "Chicago", label: "Chicago" },
          { value: "None", label: "None" },
        ],
      },
    ],
    buildBrief: (a) =>
      `Write a ${a.words}-word ${a.level} assignment on "${a.topic}" for the ${a.subject} subject. Use ${a.citation} citation style.`,
  },

  project: {
    kind: "project",
    title: "Project Builder",
    ctaLabel: "Generate Project",
    studioPath: "/studio/docs?kind=project",
    fields: [
      { id: "name", question: "Project name?", type: "text", placeholder: "e.g. Expense Tracker", required: true },
      { id: "summary", question: "Describe it in one line", type: "text", placeholder: "e.g. A full-stack expense tracker with charts", required: true },
      {
        id: "stack",
        question: "Tech stack preference",
        type: "cards",
        required: true,
        options: [
          { value: "React + Supabase", label: "React + Supabase" },
          { value: "Next.js + Postgres", label: "Next.js + Postgres" },
          { value: "Vue + Firebase", label: "Vue + Firebase" },
          { value: "Node CLI", label: "Node CLI" },
          { value: "Python + FastAPI", label: "Python + FastAPI" },
        ],
      },
      { id: "features", question: "Core features (one per line)", type: "textarea", placeholder: "Authentication\nDashboard\nCRUD operations", required: true },
      {
        id: "extras",
        question: "Anything else?",
        type: "cards",
        multi: true,
        options: [
          { value: "Auth", label: "Auth" },
          { value: "Admin Panel", label: "Admin Panel" },
          { value: "Tests", label: "Tests" },
          { value: "CI/CD", label: "CI/CD" },
          { value: "Docker", label: "Docker" },
        ],
      },
    ],
    buildBrief: (a) =>
      `Build a project called "${a.name}" — ${a.summary}.
Stack: ${a.stack}.
Features:\n${a.features}
Extras: ${(a.extras as string[] | undefined)?.join(", ") || "none"}.`,
  },

  image: {
    kind: "image",
    title: "Image Generator",
    ctaLabel: "Generate Image",
    studioPath: "/studio/image",
    fields: [
      { id: "subject", question: "What should the image show?", type: "textarea", placeholder: "A neon-lit Tokyo alley at dusk, rain reflections…", required: true },
      {
        id: "style",
        question: "Visual style?",
        type: "cards",
        required: true,
        options: [
          { value: "Photorealistic", label: "Photorealistic" },
          { value: "Anime", label: "Anime" },
          { value: "3D Render", label: "3D Render" },
          { value: "Illustration", label: "Illustration" },
          { value: "Logo", label: "Logo" },
          { value: "Poster", label: "Poster" },
          { value: "Pixel Art", label: "Pixel Art" },
          { value: "Cinematic", label: "Cinematic" },
        ],
      },
      {
        id: "ratio",
        question: "Aspect ratio?",
        type: "cards",
        required: true,
        options: [
          { value: "1:1", label: "Square 1:1" },
          { value: "16:9", label: "Wide 16:9" },
          { value: "9:16", label: "Portrait 9:16" },
          { value: "4:5", label: "Social 4:5" },
        ],
      },
      { id: "mood", question: "Any mood or palette notes?", type: "text", placeholder: "warm, moody, pastel…" },
    ],
    buildBrief: (a) =>
      `${a.subject}. Style: ${a.style}. Aspect ratio: ${a.ratio}. Mood: ${a.mood || "default"}.`,
  },

  video: {
    kind: "video",
    title: "Video Generator",
    ctaLabel: "Generate Video",
    studioPath: "/studio/video",
    fields: [
      { id: "scene", question: "Describe the scene", type: "textarea", placeholder: "A drone flying over a misty mountain range at sunrise…", required: true },
      {
        id: "style",
        question: "Visual style?",
        type: "cards",
        required: true,
        options: [
          { value: "Cinematic", label: "Cinematic" },
          { value: "Animated", label: "Animated" },
          { value: "Explainer", label: "Explainer" },
          { value: "Stop motion", label: "Stop motion" },
        ],
      },
      {
        id: "duration",
        question: "Length?",
        type: "cards",
        required: true,
        options: ["5s", "10s", "15s", "30s"].map((v) => ({ value: v, label: v })),
      },
      {
        id: "ratio",
        question: "Aspect ratio?",
        type: "cards",
        required: true,
        options: [
          { value: "16:9", label: "Wide 16:9" },
          { value: "9:16", label: "Vertical 9:16" },
          { value: "1:1", label: "Square 1:1" },
        ],
      },
      {
        id: "voiceover",
        question: "Need a voiceover?",
        type: "cards",
        required: true,
        options: [
          { value: "Yes", label: "Yes" },
          { value: "No", label: "No" },
        ],
      },
    ],
    buildBrief: (a) =>
      `${a.scene}. Style: ${a.style}. Duration: ${a.duration}. Aspect: ${a.ratio}. Voiceover: ${a.voiceover}.`,
  },

  audio: {
    kind: "audio",
    title: "Voice / Audio Generator",
    ctaLabel: "Generate Audio",
    studioPath: "/studio/audio",
    fields: [
      {
        id: "kind",
        question: "What type of audio?",
        type: "cards",
        required: true,
        options: [
          { value: "Speech", label: "Speech" },
          { value: "Narration", label: "Narration" },
          { value: "Podcast intro", label: "Podcast intro" },
        ],
      },
      { id: "script", question: "Paste the script or describe the topic", type: "textarea", placeholder: "Welcome to today's episode…", required: true },
      {
        id: "voice",
        question: "Voice type?",
        type: "cards",
        required: true,
        options: [
          { value: "Male", label: "Male" },
          { value: "Female", label: "Female" },
          { value: "Neutral", label: "Neutral" },
        ],
      },
      { id: "language", question: "Language?", type: "text", placeholder: "e.g. English (US)" },
    ],
    buildBrief: (a) => `${a.kind}: ${a.script} (voice: ${a.voice}, language: ${a.language || "English"}).`,
  },

  music: {
    kind: "music",
    title: "Music Generator",
    ctaLabel: "Generate Music",
    studioPath: "/studio/music",
    fields: [
      {
        id: "genre",
        question: "Genre / mood?",
        type: "cards",
        required: true,
        options: [
          { value: "Lofi", label: "Lofi" },
          { value: "Cinematic", label: "Cinematic" },
          { value: "Pop", label: "Pop" },
          { value: "Hip-hop", label: "Hip-hop" },
          { value: "Electronic", label: "Electronic" },
          { value: "Acoustic", label: "Acoustic" },
          { value: "Ambient", label: "Ambient" },
          { value: "Rock", label: "Rock" },
        ],
      },
      { id: "description", question: "Describe the track", type: "textarea", placeholder: "Chill lofi beat with rain sounds and soft piano…", required: true },
      {
        id: "energy",
        question: "Energy?",
        type: "cards",
        required: true,
        options: [
          { value: "Calm", label: "Calm" },
          { value: "Mellow", label: "Mellow" },
          { value: "Upbeat", label: "Upbeat" },
          { value: "High-energy", label: "High-energy" },
        ],
      },
      {
        id: "vocals",
        question: "Vocals?",
        type: "cards",
        required: true,
        options: [
          { value: "Instrumental", label: "Instrumental" },
          { value: "With vocals", label: "With vocals" },
        ],
      },
    ],
    buildBrief: (a) => `${a.genre} track — ${a.description}. Energy: ${a.energy}. ${a.vocals}.`,
  },
};

export function detectWizardKind(text: string): WizardKind | null {
  const v = text.toLowerCase();
  const asks = /\b(generate|create|make|build|design|produce|compose)\b/.test(v);
  if (!asks) return null;
  if (/\b(website|landing page|web ?site)\b/.test(v)) return "website";
  if (/\b(mobile app|web app|application|\bapp\b)\b/.test(v)) return "app";
  if (/\b(presentation|slides|pptx|pitch deck|powerpoint)\b/.test(v)) return "presentation";
  if (/\b(assignment|essay|report|homework)\b/.test(v)) return "assignment";
  if (/\b(project|scaffold|codebase|starter)\b/.test(v)) return "project";
  if (/\b(image|photo|picture|poster|logo|illustration|artwork)\b/.test(v)) return "image";
  if (/\b(video|mp4|clip|reel|animation)\b/.test(v)) return "video";
  if (/\b(music|song|track|beat|instrumental|soundtrack)\b/.test(v)) return "music";
  if (/\b(voice|speech|narration|voiceover|tts|audio)\b/.test(v)) return "audio";
  return null;
}

export type WizardResult = {
  kind: WizardKind;
  studioPath: string;
  brief: string;
  answers: Record<string, string | string[]>;
  summary: string;
};

export function CreationWizard({
  kind,
  onComplete,
  onCancel,
}: {
  kind: WizardKind;
  onComplete: (result: WizardResult) => void;
  onCancel?: () => void;
}) {
  const schema = SCHEMAS[kind];
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [showSummary, setShowSummary] = useState(false);

  const total = schema.fields.length;
  const field = schema.fields[stepIdx];
  const progress = ((stepIdx + (showSummary ? 1 : 0)) / total) * 100;

  const value = answers[field?.id];
  const canProceed = useMemo(() => {
    if (!field?.required) return true;
    if (field.type === "cards" && field.multi) return Array.isArray(value) && value.length > 0;
    if (field.type === "cards") return typeof value === "string" && value.length > 0;
    return typeof value === "string" && value.trim().length > 0;
  }, [field, value]);

  const setVal = (v: string | string[]) => setAnswers((p) => ({ ...p, [field.id]: v }));

  const next = () => {
    if (!canProceed) return;
    if (stepIdx < total - 1) setStepIdx((i) => i + 1);
    else setShowSummary(true);
  };
  const prev = () => {
    if (showSummary) setShowSummary(false);
    else if (stepIdx > 0) setStepIdx((i) => i - 1);
  };

  const submit = () => {
    const brief = schema.buildBrief(answers);
    const summary = schema.fields
      .map((f) => {
        const a = answers[f.id];
        const text = Array.isArray(a) ? a.join(", ") : (a || "—");
        return `**${f.question}**\n${text}`;
      })
      .join("\n\n");
    onComplete({ kind, studioPath: schema.studioPath, brief, answers, summary });
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 to-card/40 p-4 shadow-lg backdrop-blur sm:p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent">
            <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold">{schema.title}</div>
            <div className="text-[10px] text-muted-foreground">
              {showSummary ? "Review & confirm" : `Step ${stepIdx + 1} of ${total}`}
            </div>
          </div>
        </div>
        {onCancel && !showSummary && (
          <button onClick={onCancel} className="text-[11px] text-muted-foreground hover:text-foreground">
            Skip wizard
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-muted/40">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Body */}
      {!showSummary ? (
        <div key={field.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h3 className="mb-1 text-base font-semibold sm:text-lg">{field.question}</h3>
          {field.help && <p className="mb-3 text-xs text-muted-foreground">{field.help}</p>}
          <div className="mt-3">
            {field.type === "cards" && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {field.options.map((opt) => {
                  const arr = (value as string[]) ?? [];
                  const selected = field.multi
                    ? arr.includes(opt.value)
                    : value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        if (field.multi) {
                          const set = new Set(arr);
                          set.has(opt.value) ? set.delete(opt.value) : set.add(opt.value);
                          setVal(Array.from(set));
                        } else {
                          setVal(opt.value);
                        }
                      }}
                      className={`group relative flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left text-sm transition-all ${
                        selected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                          : "border-border/60 bg-background/40 hover:border-primary/40 hover:bg-background/60"
                      }`}
                    >
                      {selected && (
                        <span className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                      <span className="font-medium">{opt.label}</span>
                      {opt.desc && <span className="text-[10px] text-muted-foreground">{opt.desc}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {field.type === "text" && (
              <input
                type="text"
                autoFocus
                value={(value as string) ?? ""}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canProceed && next()}
                placeholder={field.placeholder}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            )}
            {field.type === "textarea" && (
              <textarea
                autoFocus
                rows={4}
                value={(value as string) ?? ""}
                onChange={(e) => setVal(e.target.value)}
                placeholder={field.placeholder}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            )}
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h3 className="mb-3 text-base font-semibold sm:text-lg">Project Summary</h3>
          <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-4">
            {schema.fields.map((f) => {
              const a = answers[f.id];
              const text = Array.isArray(a) ? a.join(", ") : a;
              if (!text) return null;
              return (
                <div key={f.id}>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{f.question}</div>
                  <div className="mt-0.5 text-sm">{text}</div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            We'll open the {schema.title} with your brief pre-filled — you can refine it before generation.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={prev}
          disabled={stepIdx === 0 && !showSummary}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-30 hover:bg-accent/10"
        >
          <ArrowLeft className="h-3 w-3" /> Previous
        </button>
        {!showSummary ? (
          <button
            type="button"
            onClick={next}
            disabled={!canProceed}
            className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
          >
            {stepIdx === total - 1 ? "Review" : "Next"} <ArrowRight className="h-3 w-3" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            <Sparkles className="h-3 w-3" /> {schema.ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
