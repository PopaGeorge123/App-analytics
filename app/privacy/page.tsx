import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Fold",
  description: "How Fold collects, uses, and protects your personal data.",
};

const LAST_UPDATED = "March 21, 2026";
const CONTACT_EMAIL = "privacy@usefold.io";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f0f0f5]">
      {/* Nav */}
      <header className="border-b border-[#1e1e2e] bg-[#0d0d16]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/">
            <span className="font-mono text-lg font-bold tracking-tight text-[#f0f0f5]">
              FOLD
            </span>
          </Link>
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-widest text-[#4a4a6a] hover:text-[#8888aa] transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-[#00d4aa]">
            Legal
          </p>
          <h1 className="mb-4 font-mono text-4xl font-bold text-[#f0f0f5]">
            Privacy Policy
          </h1>
          <p className="text-sm text-[#4a4a6a]">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        <div className="prose-fold space-y-10">

          <Section title="1. Introduction">
            <p>
              Welcome to Fold (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). We operate the website{" "}
              <a href="https://usefold.io" className="text-[#00d4aa] hover:underline">
                usefold.io
              </a>{" "}
              and the Fold platform (collectively, the &quot;Service&quot;).
            </p>
            <p>
              This Privacy Policy explains how we collect, use, disclose, and safeguard your
              information when you use our Service. Please read it carefully. By using Fold, you
              agree to the collection and use of information as described in this policy.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <Subheading>2.1 Information you provide directly</Subheading>
            <ul>
              <li>
                <strong>Email address</strong> — when you join the waitlist or create an account.
              </li>
              <li>
                <strong>Password</strong> — stored as a secure hash; we never store it in plain text.
              </li>
              <li>
                <strong>Profile data</strong> — full name, company name, and similar details you
                choose to provide.
              </li>
            </ul>

            <Subheading>2.2 Third-party integration data</Subheading>
            <p>
              When you connect third-party platforms (such as Stripe, Mailchimp, PostHog, Meta Ads,
              or Google Ads), we access data from those platforms on your behalf to power the Fold
              dashboard. We access only the data necessary to provide the Service and do not sell or
              share it with any other party.
            </p>

            <Subheading>2.3 Usage data collected automatically</Subheading>
            <ul>
              <li>IP address and approximate location</li>
              <li>Browser type and version</li>
              <li>Pages visited and features used within the Service</li>
              <li>Timestamps and session duration</li>
            </ul>
            <p>
              We use PostHog for product analytics. PostHog may collect anonymized event data to
              help us improve the Service.
            </p>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, operate, and maintain the Service</li>
              <li>Create and manage your account</li>
              <li>Send transactional emails (e.g., waitlist confirmation, account verification)</li>
              <li>Send product updates and announcements — you can unsubscribe at any time</li>
              <li>Detect and prevent fraud, abuse, or security incidents</li>
              <li>Comply with applicable laws and regulations</li>
              <li>Improve and develop new features based on aggregated usage data</li>
            </ul>
          </Section>

          <Section title="4. Legal Basis for Processing (GDPR)">
            <p>If you are located in the European Economic Area (EEA), we process your personal data under the following legal bases:</p>
            <ul>
              <li>
                <strong>Contract performance</strong> — to provide the Service you signed up for.
              </li>
              <li>
                <strong>Legitimate interests</strong> — to improve the Service, ensure security, and
                communicate relevant updates.
              </li>
              <li>
                <strong>Consent</strong> — for marketing communications, which you may withdraw at
                any time.
              </li>
              <li>
                <strong>Legal obligation</strong> — when required by applicable law.
              </li>
            </ul>
          </Section>

          <Section title="5. Data Sharing and Disclosure">
            <p>
              We do <strong>not</strong> sell your personal data. We may share your information
              only in the following limited circumstances:
            </p>
            <ul>
              <li>
                <strong>Service providers</strong> — trusted third parties that help us operate the
                Service (e.g., Supabase for database and authentication, email delivery providers).
                These parties are contractually bound to protect your data.
              </li>
              <li>
                <strong>Legal requirements</strong> — if required by law, court order, or
                governmental authority.
              </li>
              <li>
                <strong>Business transfers</strong> — in the event of a merger, acquisition, or sale
                of assets, your data may be transferred as part of the transaction. We will notify
                you before your data is subject to a different privacy policy.
              </li>
            </ul>
          </Section>

          <Section title="6. Data Retention">
            <p>
              We retain your personal data for as long as your account is active or as needed to
              provide the Service. If you delete your account, we will delete or anonymize your
              personal data within 30 days, except where we are required by law to retain it longer.
            </p>
            <p>
              Waitlist data is retained until you confirm your spot or request removal, whichever
              comes first.
            </p>
          </Section>

          <Section title="7. Your Rights">
            <p>
              Depending on your location, you may have the following rights regarding your personal
              data:
            </p>
            <ul>
              <li>
                <strong>Access</strong> — request a copy of the data we hold about you.
              </li>
              <li>
                <strong>Rectification</strong> — request correction of inaccurate data.
              </li>
              <li>
                <strong>Erasure</strong> — request deletion of your data (&quot;right to be
                forgotten&quot;).
              </li>
              <li>
                <strong>Portability</strong> — receive your data in a structured, machine-readable
                format.
              </li>
              <li>
                <strong>Objection</strong> — object to processing based on legitimate interests.
              </li>
              <li>
                <strong>Withdraw consent</strong> — where processing is based on consent.
              </li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#00d4aa] hover:underline">
                {CONTACT_EMAIL}
              </a>
              . We will respond within 30 days.
            </p>
          </Section>

          <Section title="8. Cookies and Tracking">
            <p>We use the following types of cookies and similar technologies:</p>
            <ul>
              <li>
                <strong>Strictly necessary cookies</strong> — required for authentication sessions
                and security. These cannot be disabled.
              </li>
              <li>
                <strong>Analytics cookies</strong> — PostHog collects anonymized usage data to help
                us understand how the Service is used. You may opt out via your browser settings or
                by contacting us.
              </li>
            </ul>
          </Section>

          <Section title="9. Security">
            <p>
              We implement industry-standard security measures including encryption in transit
              (TLS), encrypted passwords, and Row-Level Security (RLS) on our database. However, no
              method of transmission over the internet is 100% secure. We cannot guarantee absolute
              security and encourage you to use a strong, unique password.
            </p>
          </Section>

          <Section title="10. Children's Privacy">
            <p>
              The Service is not directed to individuals under the age of 16. We do not knowingly
              collect personal data from children. If you believe we have inadvertently collected
              such data, please contact us immediately.
            </p>
          </Section>

          <Section title="11. International Data Transfers">
            <p>
              Your data may be processed and stored in countries outside your own, including the
              United States and the European Union. Where required, we ensure appropriate safeguards
              are in place (such as Standard Contractual Clauses) to protect your data.
            </p>
          </Section>

          <Section title="12. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material
              changes by posting the updated policy on this page and updating the &quot;Last
              updated&quot; date. For significant changes, we will also notify you by email. Your
              continued use of the Service after changes take effect constitutes your acceptance of
              the revised policy.
            </p>
          </Section>

          <Section title="13. Contact Us">
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy,
              please contact us:
            </p>
            <div className="rounded-xl border border-[#1e1e2e] bg-[#0d0d16]/60 p-5 mt-4">
              <p className="font-mono text-sm text-[#f0f0f5]">Fold</p>
              <p className="text-sm text-[#8888aa] mt-1">
                Email:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#00d4aa] hover:underline">
                  {CONTACT_EMAIL}
                </a>
              </p>
              <p className="text-sm text-[#8888aa]">
                Website:{" "}
                <a href="https://usefold.io" className="text-[#00d4aa] hover:underline">
                  usefold.io
                </a>
              </p>
            </div>
          </Section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1e1e2e] px-6 py-8 mt-16">
        <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-mono text-[11px] text-[#2a2a4a]">
            © 2026 Fold. All rights reserved.
          </p>
          <nav className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs text-[#00d4aa]">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs text-[#4a4a6a] hover:text-[#8888aa] transition-colors">
              Terms of Service
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 font-mono text-xl font-bold text-[#f0f0f5] border-b border-[#1e1e2e] pb-3">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-[#8888aa] [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_strong]:text-[#c8c8e0] [&_a]:text-[#00d4aa] [&_a:hover]:underline">
        {children}
      </div>
    </section>
  );
}

function Subheading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-[#c8c8e0] mt-5 mb-2">
      {children}
    </h3>
  );
}
