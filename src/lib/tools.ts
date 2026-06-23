export type ToolField = {
  name: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
};

export type ToolDef = {
  slug: string;
  name: string;
  tagline: string;
  category: "Education" | "Career" | "Coding" | "Content" | "Business" | "Productivity";
  icon: string; // lucide-react icon name
  accent: string; // tailwind gradient classes
  fields: ToolField[];
  system: string;
  buildPrompt: (input: Record<string, string>) => string;
};

const f = (name: string, label: string, opts: Partial<ToolField> = {}): ToolField => ({
  name,
  label,
  multiline: true,
  required: true,
  ...opts,
});

export const TOOLS: ToolDef[] = [
  // Education
  {
    slug: "exam-planner",
    name: "AI Exam Planner",
    tagline: "Personalized study schedules from your syllabus and exam date.",
    category: "Education",
    icon: "CalendarClock",
    accent: "from-blue-500 to-cyan-500",
    fields: [
      f("syllabus", "Syllabus / topics", { placeholder: "Paste your syllabus, topic list, or chapters…" }),
      f("examDate", "Exam date", { multiline: false, placeholder: "e.g. 2026-08-15" }),
      f("hoursPerDay", "Hours available per day", { multiline: false, placeholder: "e.g. 3" }),
    ],
    system:
      "You are an expert exam coach. Produce a clean, realistic, week-by-week study plan in Markdown. Use tables and bullet lists. Include daily breakdowns, revision blocks, and 2 mock-test checkpoints.",
    buildPrompt: (i) =>
      `Exam date: ${i.examDate}\nHours per day: ${i.hoursPerDay}\n\nSyllabus:\n${i.syllabus}\n\nGenerate the full study plan.`,
  },
  {
    slug: "notes-generator",
    name: "AI Notes Generator",
    tagline: "Turn any text or topic into clean, concise study notes.",
    category: "Education",
    icon: "NotebookPen",
    accent: "from-emerald-500 to-teal-500",
    fields: [f("content", "Source text or topic", { placeholder: "Paste the chapter, article, or topic…" })],
    system:
      "You are a study-notes expert. Produce structured Markdown notes: headings, sub-headings, bullet points, definitions, formulas where relevant, and a 'Key Takeaways' section at the end.",
    buildPrompt: (i) => i.content,
  },
  {
    slug: "mcq-generator",
    name: "AI MCQ Generator",
    tagline: "Generate multiple-choice questions from a topic or text.",
    category: "Education",
    icon: "ListChecks",
    accent: "from-violet-500 to-purple-500",
    fields: [
      f("topic", "Topic or source text", { placeholder: "Paste content or write a topic…" }),
      f("count", "How many questions?", { multiline: false, placeholder: "e.g. 10" }),
    ],
    system:
      "You generate high-quality MCQs. For each question include 4 options labeled A–D, mark the correct answer, and give a one-line explanation. Use clean Markdown.",
    buildPrompt: (i) => `Generate ${i.count} MCQs.\n\nSource:\n${i.topic}`,
  },
  {
    slug: "flashcards",
    name: "AI Flashcard Generator",
    tagline: "Spaced-repetition style Q/A flashcards on any topic.",
    category: "Education",
    icon: "Layers",
    accent: "from-pink-500 to-rose-500",
    fields: [
      f("topic", "Topic or notes", { placeholder: "Paste your notes or write a topic…" }),
      f("count", "Number of cards", { multiline: false, placeholder: "e.g. 20" }),
    ],
    system:
      "Output flashcards in a Markdown table with two columns: Front (question/term) and Back (answer/definition). Keep each side under 200 chars.",
    buildPrompt: (i) => `Generate ${i.count} flashcards.\n\nSource:\n${i.topic}`,
  },
  {
    slug: "concept-explainer",
    name: "AI Concept Explainer",
    tagline: "Explain any concept clearly, with analogies and examples.",
    category: "Education",
    icon: "Lightbulb",
    accent: "from-amber-500 to-orange-500",
    fields: [
      f("concept", "Concept", { multiline: false, placeholder: "e.g. Backpropagation" }),
      f("level", "Audience level", { multiline: false, placeholder: "e.g. beginner / undergrad / expert" }),
    ],
    system:
      "Explain the concept clearly. Structure: 1) one-sentence definition, 2) intuitive analogy, 3) worked example, 4) common misconceptions, 5) further reading suggestions.",
    buildPrompt: (i) => `Concept: ${i.concept}\nAudience level: ${i.level}`,
  },

  // Career
  {
    slug: "resume-analyzer",
    name: "Resume Analyzer",
    tagline: "Score your resume, surface missing skills, and get fixes.",
    category: "Career",
    icon: "FileSearch",
    accent: "from-indigo-500 to-blue-500",
    fields: [
      f("resume", "Paste your resume"),
      f("jobDesc", "Target job description", { required: false, placeholder: "Optional — for better tailoring." }),
    ],
    system:
      "You are a top-tier recruiter & resume coach. Produce: 1) Overall Score (0-100), 2) ATS Score (0-100), 3) Strengths, 4) Critical Issues, 5) Missing Skills/Keywords, 6) Bullet-by-bullet rewrites for the weakest points, 7) Action checklist. Use clean Markdown with tables.",
    buildPrompt: (i) =>
      `Resume:\n${i.resume}\n\n${i.jobDesc ? `Target job:\n${i.jobDesc}` : "No target job provided."}`,
  },
  {
    slug: "ats-checker",
    name: "ATS Score Checker",
    tagline: "Detailed Applicant Tracking System evaluation.",
    category: "Career",
    icon: "ScanLine",
    accent: "from-sky-500 to-indigo-500",
    fields: [
      f("resume", "Resume"),
      f("jobDesc", "Job description"),
    ],
    system:
      "Run a strict ATS-style evaluation. Output: ATS Score /100, keyword match table (job keyword | present? | suggested placement), formatting issues, parsing risks, and a prioritized fix list.",
    buildPrompt: (i) => `Job description:\n${i.jobDesc}\n\nResume:\n${i.resume}`,
  },
  {
    slug: "career-roadmap",
    name: "Career Roadmap Generator",
    tagline: "Personalized roadmap from where you are to your goal.",
    category: "Career",
    icon: "Map",
    accent: "from-fuchsia-500 to-pink-500",
    fields: [
      f("current", "Current role / skills"),
      f("goal", "Target role", { multiline: false, placeholder: "e.g. Senior ML Engineer at FAANG" }),
      f("timeline", "Timeline", { multiline: false, placeholder: "e.g. 12 months" }),
    ],
    system:
      "Produce a stage-by-stage roadmap: skill gap analysis, recommended certifications, project ideas, monthly milestones, and a final readiness score rubric. Use Markdown tables.",
    buildPrompt: (i) => `Current:\n${i.current}\n\nGoal: ${i.goal}\nTimeline: ${i.timeline}`,
  },
  {
    slug: "linkedin-optimizer",
    name: "LinkedIn Optimizer",
    tagline: "Headline, About, and Experience rewrites that convert.",
    category: "Career",
    icon: "Linkedin",
    accent: "from-blue-600 to-sky-500",
    fields: [f("profile", "Paste your current LinkedIn (headline, about, experience)…")],
    system:
      "Rewrite to be sharp, keyword-rich, and recruiter-friendly. Output: 3 headline options, a rewritten About section, and rewritten experience bullets (impact-first, metric-driven).",
    buildPrompt: (i) => i.profile,
  },
  {
    slug: "cover-letter",
    name: "Cover Letter Generator",
    tagline: "Tailored, persuasive cover letters in seconds.",
    category: "Career",
    icon: "Mail",
    accent: "from-rose-500 to-red-500",
    fields: [
      f("resume", "Resume / background"),
      f("jobDesc", "Job description"),
      f("tone", "Tone", { multiline: false, placeholder: "e.g. confident, warm, formal" }),
    ],
    system:
      "Write a one-page cover letter, no clichés, opens with a hook, ties achievements to the role, and closes with a clear call to action.",
    buildPrompt: (i) => `Tone: ${i.tone}\n\nJob:\n${i.jobDesc}\n\nResume:\n${i.resume}`,
  },

  // Coding
  {
    slug: "code-generator",
    name: "Code Generator",
    tagline: "Production-ready code from a natural-language spec.",
    category: "Coding",
    icon: "Code2",
    accent: "from-emerald-500 to-green-500",
    fields: [
      f("spec", "What should it do?"),
      f("language", "Language / framework", { multiline: false, placeholder: "e.g. TypeScript + React" }),
    ],
    system:
      "Generate clean, idiomatic, production-ready code. Include brief comments, error handling, and a short usage example. Use fenced code blocks with language tags.",
    buildPrompt: (i) => `Language: ${i.language}\n\nSpec:\n${i.spec}`,
  },
  {
    slug: "bug-fixer",
    name: "Bug Fixer",
    tagline: "Paste failing code, get the fix and an explanation.",
    category: "Coding",
    icon: "Bug",
    accent: "from-red-500 to-orange-500",
    fields: [
      f("code", "Code"),
      f("error", "Error message / behavior", { required: false }),
    ],
    system:
      "Diagnose the issue, return the fixed code in a single code block, then explain what was wrong and why the fix works.",
    buildPrompt: (i) => `Code:\n${i.code}\n\nError/behavior:\n${i.error ?? "(none provided)"}`,
  },
  {
    slug: "code-explainer",
    name: "Code Explainer",
    tagline: "Plain-English walkthrough of any snippet.",
    category: "Coding",
    icon: "BookOpen",
    accent: "from-cyan-500 to-blue-500",
    fields: [f("code", "Paste code")],
    system:
      "Explain step-by-step in plain English. Use bullet points and inline code. End with potential improvements.",
    buildPrompt: (i) => i.code,
  },
  {
    slug: "api-generator",
    name: "API Generator",
    tagline: "Generate REST API structure, routes, and docs.",
    category: "Coding",
    icon: "Network",
    accent: "from-violet-500 to-indigo-500",
    fields: [
      f("idea", "Describe the API"),
      f("stack", "Stack", { multiline: false, placeholder: "e.g. Node + Express + Postgres" }),
    ],
    system:
      "Output: resource list, route table (method | path | description | auth), request/response JSON examples, and a starter folder structure. Markdown only.",
    buildPrompt: (i) => `Stack: ${i.stack}\n\nIdea:\n${i.idea}`,
  },
  {
    slug: "sql-generator",
    name: "SQL Query Generator",
    tagline: "Natural language → optimized SQL.",
    category: "Coding",
    icon: "Database",
    accent: "from-teal-500 to-emerald-500",
    fields: [
      f("schema", "Schema (DDL or description)"),
      f("question", "What do you want to query?"),
    ],
    system:
      "Return the SQL in a single fenced code block (```sql), then a short explanation of what it does and any indexing tips.",
    buildPrompt: (i) => `Schema:\n${i.schema}\n\nQuestion:\n${i.question}`,
  },

  // Content
  {
    slug: "blog-writer",
    name: "Blog Writer",
    tagline: "Long-form blog posts with structure and SEO.",
    category: "Content",
    icon: "PenLine",
    accent: "from-purple-500 to-fuchsia-500",
    fields: [
      f("topic", "Topic"),
      f("tone", "Tone & audience", { multiline: false, placeholder: "e.g. friendly, for developers" }),
    ],
    system:
      "Write a 1000–1400 word SEO-friendly blog post. Include H1, H2s, intro hook, examples, a callout, and a conclusion with CTA.",
    buildPrompt: (i) => `Topic: ${i.topic}\nTone/audience: ${i.tone}`,
  },
  {
    slug: "email-writer",
    name: "Email Writer",
    tagline: "Professional emails in any tone.",
    category: "Content",
    icon: "Send",
    accent: "from-blue-500 to-indigo-500",
    fields: [
      f("purpose", "What's the email about?"),
      f("tone", "Tone", { multiline: false, placeholder: "e.g. polite, assertive" }),
    ],
    system:
      "Write a clear, well-structured email: subject line + body. Be concise. End with a clear next step.",
    buildPrompt: (i) => `Tone: ${i.tone}\n\nPurpose:\n${i.purpose}`,
  },
  {
    slug: "social-generator",
    name: "Social Media Generator",
    tagline: "Posts tuned for X, LinkedIn, and Instagram.",
    category: "Content",
    icon: "Share2",
    accent: "from-pink-500 to-purple-500",
    fields: [
      f("topic", "Topic or message"),
      f("platforms", "Platforms", { multiline: false, placeholder: "e.g. X, LinkedIn, Instagram" }),
    ],
    system:
      "For each platform, produce: 3 caption variants, suggested hashtags, and a hook line. Markdown sections per platform.",
    buildPrompt: (i) => `Platforms: ${i.platforms}\n\nTopic:\n${i.topic}`,
  },
  {
    slug: "grammar-improver",
    name: "Grammar & Writing Improver",
    tagline: "Rewrites your text — clearer, tighter, sharper.",
    category: "Content",
    icon: "Wand2",
    accent: "from-amber-500 to-yellow-500",
    fields: [f("text", "Paste text")],
    system:
      "Return: 1) Cleaned version (Markdown), 2) a short bullet list of the most important changes you made and why.",
    buildPrompt: (i) => i.text,
  },
  {
    slug: "translator",
    name: "Translator",
    tagline: "Natural translations into any language.",
    category: "Content",
    icon: "Languages",
    accent: "from-green-500 to-emerald-500",
    fields: [
      f("text", "Text to translate"),
      f("target", "Target language", { multiline: false, placeholder: "e.g. Spanish (LatAm)" }),
    ],
    system: "Translate naturally, preserving meaning and tone. Output only the translation.",
    buildPrompt: (i) => `Target language: ${i.target}\n\nText:\n${i.text}`,
  },

  // Business
  {
    slug: "business-plan",
    name: "Business Plan Generator",
    tagline: "A complete startup business plan in minutes.",
    category: "Business",
    icon: "Briefcase",
    accent: "from-indigo-500 to-violet-500",
    fields: [f("idea", "Describe your startup idea")],
    system:
      "Produce a structured business plan: Executive Summary, Problem, Solution, Market, Competitors, Business Model, Go-to-Market, Roadmap (12 months), Team, Financial Snapshot. Use Markdown headings + tables.",
    buildPrompt: (i) => i.idea,
  },
  {
    slug: "idea-validator",
    name: "Startup Idea Validator",
    tagline: "Score your idea and stress-test the assumptions.",
    category: "Business",
    icon: "Gauge",
    accent: "from-rose-500 to-pink-500",
    fields: [f("idea", "Your startup idea")],
    system:
      "Rate the idea (0-100) across: Problem, Market Size, Differentiation, Monetization, Defensibility. For each, give 1-2 sentences + a risk and a mitigation. End with a Go/No-Go.",
    buildPrompt: (i) => i.idea,
  },
  {
    slug: "swot",
    name: "SWOT Analyzer",
    tagline: "Strengths, Weaknesses, Opportunities, Threats.",
    category: "Business",
    icon: "Grid3x3",
    accent: "from-teal-500 to-cyan-500",
    fields: [f("subject", "Company / product / idea")],
    system:
      "Produce a SWOT analysis as a 2x2 Markdown table, then a short narrative + 3 strategic recommendations.",
    buildPrompt: (i) => i.subject,
  },
  {
    slug: "marketing-strategy",
    name: "Marketing Strategy Generator",
    tagline: "Channels, messaging, and a 90-day plan.",
    category: "Business",
    icon: "Megaphone",
    accent: "from-orange-500 to-red-500",
    fields: [
      f("product", "Product / company"),
      f("audience", "Audience", { multiline: false, placeholder: "e.g. SMB SaaS founders" }),
    ],
    system:
      "Output: positioning, ICP, top 5 channels (with rationale & KPI), messaging pillars, content calendar (4 weeks), and a 90-day execution plan. Markdown.",
    buildPrompt: (i) => `Audience: ${i.audience}\n\nProduct:\n${i.product}`,
  },
  {
    slug: "product-description",
    name: "Product Description Generator",
    tagline: "High-converting product copy.",
    category: "Business",
    icon: "ShoppingBag",
    accent: "from-yellow-500 to-amber-500",
    fields: [
      f("product", "Product details / features"),
      f("audience", "Audience", { multiline: false, placeholder: "e.g. outdoor enthusiasts" }),
    ],
    system:
      "Write 3 variants: short (1-2 lines), medium (paragraph), and long (with bullet features + benefits). Persuasive but truthful.",
    buildPrompt: (i) => `Audience: ${i.audience}\n\nProduct:\n${i.product}`,
  },
];

export const TOOLS_BY_SLUG: Record<string, ToolDef> = Object.fromEntries(
  TOOLS.map((t) => [t.slug, t]),
);

export const TOOL_CATEGORIES = [
  "Education",
  "Career",
  "Coding",
  "Content",
  "Business",
] as const;
