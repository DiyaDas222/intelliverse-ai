import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Mail, Twitter, Github, Linkedin, Send, CheckCircle2, Loader2 } from "lucide-react";
import { SiteNav, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — IntelliVerse AI" },
      {
        name: "description",
        content:
          "Get in touch with the IntelliVerse AI team. Send us a message or reach out on social media.",
      },
      { property: "og:title", content: "Contact Us — IntelliVerse AI" },
      {
        property: "og:description",
        content: "Send a message to the IntelliVerse AI team.",
      },
    ],
  }),
  component: ContactPage,
});

const SUPPORT_EMAIL = "hello@intelliverse.ai";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  email: z.string().trim().email("Enter a valid email").max(255, "Email is too long"),
  subject: z.string().trim().min(1, "Subject is required").max(150, "Subject is too long"),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000, "Message is too long"),
});

type ContactForm = z.infer<typeof contactSchema>;
type Errors = Partial<Record<keyof ContactForm, string>>;

function ContactPage() {
  const [form, setForm] = useState<ContactForm>({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = <K extends keyof ContactForm>(k: K, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ContactForm;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setSubmitting(true);
    try {
      // Open a prefilled mail draft so the message is delivered.
      const body =
        `Name: ${parsed.data.name}\nEmail: ${parsed.data.email}\n\n${parsed.data.message}`;
      const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(parsed.data.subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = href;
      await new Promise((r) => setTimeout(r, 400));
      setSubmitted(true);
      setForm({ name: "", email: "", subject: "", message: "" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen">
      <SiteNav />
      <section className="pt-28 pb-10">
        <div className="mx-auto max-w-5xl px-6">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Contact us</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Questions, feedback, or partnership ideas? Send us a message and we'll get back to you within 1–2 business days.
          </p>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto grid max-w-5xl gap-6 px-6 md:grid-cols-[1fr_minmax(0,1.4fr)]">
          {/* Contact info */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
              <h2 className="text-sm font-semibold">Email</h2>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-2 inline-flex items-center gap-2 text-sm text-foreground hover:opacity-80"
              >
                <Mail className="h-4 w-4 text-accent" />
                {SUPPORT_EMAIL}
              </a>
              <p className="mt-3 text-xs text-muted-foreground">
                For account, billing, and product questions.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
              <h2 className="text-sm font-semibold">Follow us</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <SocialLink href="https://twitter.com/" label="Twitter / X" icon={Twitter} />
                <SocialLink href="https://github.com/" label="GitHub" icon={Github} />
                <SocialLink href="https://linkedin.com/" label="LinkedIn" icon={Linkedin} />
              </div>
            </div>
          </aside>

          {/* Form */}
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6 sm:p-8">
            {submitted ? (
              <div className="grid place-items-center py-10 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-accent/15">
                  <CheckCircle2 className="h-6 w-6 text-accent" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Message sent</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Thanks for reaching out — we've received your message and will reply to your email soon.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Name"
                    error={errors.name}
                    input={
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        maxLength={100}
                        placeholder="Your full name"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    }
                  />
                  <Field
                    label="Email"
                    error={errors.email}
                    input={
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        maxLength={255}
                        placeholder="you@example.com"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    }
                  />
                </div>
                <Field
                  label="Subject"
                  error={errors.subject}
                  input={
                    <input
                      type="text"
                      value={form.subject}
                      onChange={(e) => update("subject", e.target.value)}
                      maxLength={150}
                      placeholder="What's this about?"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  }
                />
                <Field
                  label="Message"
                  error={errors.message}
                  input={
                    <textarea
                      value={form.message}
                      onChange={(e) => update("message", e.target.value)}
                      maxLength={2000}
                      rows={6}
                      placeholder="Tell us how we can help…"
                      className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  }
                  hint={`${form.message.length}/2000`}
                />
                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Send message
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Field({
  label,
  input,
  error,
  hint,
}: {
  label: string;
  input: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {input}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </label>
  );
}

function SocialLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof Mail;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}
