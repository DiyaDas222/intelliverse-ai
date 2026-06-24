import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "@/components/site-chrome";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — IntelliVerse AI" },
      {
        name: "description",
        content:
          "How IntelliVerse AI collects, uses, and protects your personal information, login details, and uploaded files.",
      },
      { property: "og:title", content: "Privacy Policy — IntelliVerse AI" },
      {
        property: "og:description",
        content:
          "Learn how IntelliVerse AI handles your data, accounts, and uploads — and our commitment to never sharing without consent.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      subtitle={`Last updated ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`}
    >
      <p>
        IntelliVerse AI ("we", "us", "our") respects your privacy. This policy
        explains what we collect, why we collect it, and how we protect it when
        you use our website and AI workspace.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account information:</strong> name, email address, profile
          photo, and authentication identifiers you provide when signing up or
          signing in (including via Google).
        </li>
        <li>
          <strong>Login & session data:</strong> session tokens, sign-in
          timestamps, IP address, browser, and device metadata used to keep
          your account secure.
        </li>
        <li>
          <strong>Uploaded files & prompts:</strong> documents, images, audio,
          and text you upload or type into the assistant so we can generate
          responses for you.
        </li>
        <li>
          <strong>Generated content:</strong> conversations, documents, images,
          and media produced through the assistant on your behalf.
        </li>
        <li>
          <strong>Usage data:</strong> feature interactions, error reports, and
          anonymous analytics that help us improve the product.
        </li>
      </ul>

      <h2>2. How we use your information</h2>
      <ul>
        <li>Provide, operate, and improve the IntelliVerse AI services.</li>
        <li>Authenticate you and keep your account and data secure.</li>
        <li>Process your prompts and files to return AI-generated results.</li>
        <li>Communicate with you about updates, security, and support.</li>
        <li>Detect, prevent, and respond to fraud, abuse, or technical issues.</li>
      </ul>

      <h2>3. Your files and AI prompts</h2>
      <p>
        Files and prompts you submit are processed to deliver the requested
        output. They are stored in your private workspace and are accessible
        only to you and the personnel strictly required to operate the
        service. We do not use your private content to train public models
        without your explicit consent.
      </p>

      <h2>4. Sharing of information</h2>
      <p>
        We do <strong>not</strong> sell your personal information, and we do{" "}
        <strong>not</strong> share your account data, uploads, or generated
        content with third parties for their own purposes without your
        consent. We may share limited data only with trusted infrastructure
        providers (hosting, database, AI inference) that process it solely on
        our behalf under confidentiality obligations, or when required by law.
      </p>

      <h2>5. Data retention</h2>
      <p>
        We retain your account and content for as long as your account is
        active. You can delete conversations, files, and generated assets at
        any time, and you can request full account deletion by contacting us.
      </p>

      <h2>6. Security</h2>
      <p>
        We use industry-standard safeguards including encryption in transit,
        row-level access controls on user data, and least-privilege server
        operations. No method of transmission or storage is 100% secure, but
        we work continuously to protect your information.
      </p>

      <h2>7. Your rights</h2>
      <p>
        Depending on your location, you may have the right to access,
        correct, export, or delete your personal data, and to object to or
        restrict certain processing. Contact us to exercise these rights.
      </p>

      <h2>8. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes
        will be highlighted in-app or via email before they take effect.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about privacy? Reach us through our{" "}
        <a href="/contact" className="text-foreground underline">Contact page</a>.
      </p>
    </LegalShell>
  );
}
