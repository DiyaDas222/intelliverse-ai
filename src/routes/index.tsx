import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  MessageSquare,
  FileText,
  Code2,
  GraduationCap,
  Briefcase,
  Brain,
  ArrowRight,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IntelliVerse AI — One AI. Infinite Possibilities." },
      {
        name: "description",
        content:
          "Chat, analyze documents, write, code, study and plan your career — all from one premium AI workspace.",
      },
    ],
  }),
  component: Landing,
});

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-base tracking-tight">IntelliVerse</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#tools" className="hover:text-foreground">Tools</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24">
      <div className="absolute inset-0 bg-aurora opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,transparent_0%,var(--color-background)_70%)]" />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Now with document intelligence
        </div>
        <h1 className="mt-6 text-5xl font-semibold tracking-tight md:text-7xl">
          One <span className="text-gradient">AI</span>.
          <br />
          Infinite Possibilities.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          IntelliVerse AI combines a premium chat assistant, document intelligence, writing and
          coding tools into one elegant workspace. Built for thinkers, students, builders and
          professionals.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-5 py-3 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 glow-ring"
          >
            Start for free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#features"
            className="rounded-lg border border-border bg-card/40 px-5 py-3 text-sm font-medium backdrop-blur hover:bg-card"
          >
            See what's inside
          </a>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required · One platform, every modality
        </p>
      </div>

      {/* Mock product window */}
      <div className="relative mx-auto mt-16 max-w-5xl px-6">
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/60 shadow-2xl backdrop-blur glow-ring">
          <div className="flex items-center gap-2 border-b border-border/60 bg-background/40 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
            <span className="ml-3 text-xs text-muted-foreground">
              intelliverse.ai / chat / Marketing strategy
            </span>
          </div>
          <div className="grid grid-cols-12">
            <div className="col-span-3 hidden border-r border-border/60 p-4 text-sm md:block">
              <div className="rounded-md bg-primary/10 px-3 py-2 text-foreground">
                + New chat
              </div>
              <div className="mt-3 space-y-1 text-muted-foreground">
                <div className="rounded-md px-3 py-2 hover:bg-accent/10">Marketing strategy</div>
                <div className="rounded-md px-3 py-2 hover:bg-accent/10">SQL query review</div>
                <div className="rounded-md px-3 py-2 hover:bg-accent/10">React component help</div>
              </div>
            </div>
            <div className="col-span-12 space-y-5 p-6 md:col-span-9">
              <div className="rounded-xl bg-primary/15 px-4 py-3 text-sm">
                Summarize the attached Q3 report and propose 3 marketing experiments.
              </div>
              <div className="text-sm leading-relaxed">
                <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                  IntelliVerse
                </div>
                Based on your Q3 report, revenue grew 18% MoM driven by self-serve signups. Three
                experiments worth running this quarter:
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>Onboarding email sequence A/B test (subject line vs. CTA copy).</li>
                  <li>Pricing-page social proof carousel.</li>
                  <li>Feature-launch webinar with replay funnel.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: MessageSquare,
    title: "Premium AI Chat",
    desc: "Streaming responses, markdown, code blocks, conversation memory and a polished sidebar.",
  },
  {
    icon: FileText,
    title: "Document Intelligence",
    desc: "Upload PDFs, notes and CSVs. Ask questions, summarize and extract insights instantly.",
  },
  {
    icon: Code2,
    title: "Coding Assistant",
    desc: "Generate, debug, explain code and design architecture with one capable model.",
  },
  {
    icon: GraduationCap,
    title: "Study Assistant",
    desc: "Generate notes, flashcards and MCQs. Summarize chapters and revise smarter.",
  },
  {
    icon: Briefcase,
    title: "Career & Resume",
    desc: "ATS scoring, skill-gap detection and tailored career roadmaps for your dream role.",
  },
  {
    icon: Brain,
    title: "Project & Interview",
    desc: "Generate project blueprints and run realistic mock interviews with feedback.",
  },
];

function Features() {
  return (
    <section id="features" className="relative py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            An entire AI workspace, beautifully unified
          </h2>
          <p className="mt-3 text-muted-foreground">
            Stop juggling tabs. IntelliVerse brings the best of modern AI into one place that
            feels fast, focused and premium.
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-6 transition-all hover:border-primary/40 hover:bg-card"
            >
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl transition-opacity opacity-0 group-hover:opacity-100" />
              <f.icon className="h-6 w-6 text-accent" />
              <h3 className="mt-4 font-medium">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const tiers = [
  {
    name: "Free",
    price: "$0",
    desc: "Get started with the essentials.",
    features: ["100 messages / day", "Document chat (5 docs)", "Standard model"],
    cta: "Start free",
  },
  {
    name: "Pro",
    price: "$5",
    suffix: "/mo",
    desc: "For power users and professionals.",
    features: [
      "Unlimited messages",
      "Unlimited documents",
      "Advanced models",
      "Priority response speed",
      "All premium tools",
    ],
    cta: "Go Pro",
    featured: true,
  },
  {
    name: "Team",
    price: "$15",
    suffix: "/mo",
    desc: "For small teams collaborating with AI.",
    features: ["Everything in Pro", "Shared workspaces", "Admin dashboard", "Usage analytics"],
    cta: "Contact sales",
  },
];

function Pricing() {
  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Simple, scalable pricing
          </h2>
          <p className="mt-3 text-muted-foreground">Start free. Upgrade when you need more.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-2xl border p-6 ${
                t.featured
                  ? "border-primary/60 bg-gradient-to-b from-primary/10 to-card glow-ring"
                  : "border-border/60 bg-card/40"
              }`}
            >
              {t.featured && (
                <div className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                  Most popular
                </div>
              )}
              <div className="text-sm text-muted-foreground">{t.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-semibold">{t.price}</span>
                {t.suffix && <span className="text-sm text-muted-foreground">{t.suffix}</span>}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={t.name === "Free" ? "/auth" : t.name === "Team" ? "/contact" : "/upgrade"}
                {...(t.name === "Free" ? { search: { mode: "signup" } } : {})}
                className={`mt-6 inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-medium ${
                  t.featured
                    ? "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
                    : "border border-border bg-background hover:bg-accent/10"
                }`}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const faqs = [
  {
    q: "What models power IntelliVerse?",
    a: "We use a curated mix of frontier AI models (Gemini, GPT and more) through a single elegant interface — no API keys required.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Your chats and documents are scoped to your account with row-level security. We never train on your data.",
  },
  {
    q: "Can I use it on mobile?",
    a: "Absolutely. The entire workspace is responsive and feels native on phone, tablet and desktop.",
  },
  {
    q: "How do I cancel?",
    a: "Anytime, from your account settings. No questions asked.",
  },
];

function FAQ() {
  return (
    <section id="faq" className="py-24">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Frequently asked questions
        </h2>
        <div className="mt-8 divide-y divide-border/60 rounded-xl border border-border/60 bg-card/40">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-left font-medium">
                {f.q}
                <span className="ml-4 text-muted-foreground transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="absolute inset-0 bg-aurora opacity-50" />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
          Your second brain, <span className="text-gradient">supercharged</span>.
        </h2>
        <p className="mt-4 text-muted-foreground">
          Join thousands using IntelliVerse to think faster, build smarter and grow further.
        </p>
        <Link
          to="/auth"
          search={{ mode: "signup" }}
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 glow-ring"
        >
          Get started — it's free
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-primary to-accent">
            <Sparkles className="h-3 w-3 text-primary-foreground" />
          </span>
          <span>© {new Date().getFullYear()} IntelliVerse AI</span>
        </div>
        <div className="flex gap-5">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/contact" className="hover:text-foreground">Contact</Link>
        </div>
      </div>
    </footer>
  );
}

function Landing() {
  return (
    <main className="min-h-screen">
      <Nav />
      <Hero />
      <Features />
      <section id="tools" className="py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center">
            <p className="text-sm uppercase tracking-widest text-muted-foreground">
              Trusted by curious minds everywhere
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-8 opacity-70">
              {["Acme", "Nimbus", "Vertex", "Lumen", "Orbit", "Solace"].map((n) => (
                <span key={n} className="text-lg font-semibold tracking-tight">
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
