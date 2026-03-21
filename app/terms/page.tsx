import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Fold",
  description: "Terms and conditions for using the Fold platform.",
};

const LAST_UPDATED = "March 21, 2026";
const CONTACT_EMAIL = "legal@usefold.io";

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="text-sm text-[#4a4a6a]">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-10">

          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using the Fold platform at{" "}
              <a href="https://usefold.io">usefold.io</a> (the &quot;Service&quot;), you agree to
              be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these
              Terms, do not use the Service.
            </p>
            <p>
              These Terms apply to all visitors, waitlist members, registered users, and any other
              party that accesses or uses the Service. By using the Service, you represent that you
              are at least 16 years old and have the legal capacity to enter into this agreement.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              Fold is an AI-powered business intelligence platform that connects to third-party
              services (such as Stripe, Mailchimp, PostHog, Meta Ads, and Google Ads) to aggregate
              your business data, surface insights, detect anomalies, and provide AI-generated
              recommendations. The Service is intended for use by business founders and operators.
            </p>
            <p>
              We reserve the right to modify, suspend, or discontinue any aspect of the Service at
              any time, with or without notice. We will not be liable to you or any third party for
              any modification, suspension, or discontinuation.
            </p>
          </Section>

          <Section title="3. Account Registration">
            <p>
              To access certain features of the Service, you must create an account. You agree to:
            </p>
            <ul>
              <li>Provide accurate, complete, and current information during registration.</li>
              <li>Maintain the security of your password and account credentials.</li>
              <li>
                Notify us immediately at{" "}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> of any unauthorized access
                to your account.
              </li>
              <li>
                Accept responsibility for all activities that occur under your account.
              </li>
            </ul>
            <p>
              We reserve the right to terminate accounts that violate these Terms or that we
              reasonably believe are being used for fraudulent or abusive purposes.
            </p>
          </Section>

          <Section title="4. Waitlist">
            <p>
              Joining the Fold waitlist does not guarantee access to the Service. Waitlist spots are
              allocated at our sole discretion. By joining the waitlist, you agree to receive
              transactional emails related to your registration and, if you confirm your spot,
              product updates about the Fold launch. You may unsubscribe at any time.
            </p>
          </Section>

          <Section title="5. Third-Party Integrations">
            <p>
              The Service connects to third-party platforms on your behalf. By connecting a
              third-party platform, you authorize Fold to access and process data from that platform
              as necessary to provide the Service. You are responsible for ensuring you have the
              right to connect those platforms and that doing so complies with their respective
              terms of service.
            </p>
            <p>
              Fold is not affiliated with, endorsed by, or responsible for any third-party platforms.
              Any issues with those platforms should be directed to the respective providers.
            </p>
          </Section>

          <Section title="6. Acceptable Use">
            <p>You agree not to use the Service to:</p>
            <ul>
              <li>Violate any applicable local, national, or international law or regulation.</li>
              <li>
                Transmit any material that is unlawful, defamatory, offensive, or otherwise
                objectionable.
              </li>
              <li>
                Attempt to gain unauthorized access to any part of the Service or its related
                systems or networks.
              </li>
              <li>
                Interfere with or disrupt the integrity or performance of the Service or its data.
              </li>
              <li>
                Use automated means (bots, scrapers, etc.) to access the Service without our prior
                written consent.
              </li>
              <li>
                Resell, sublicense, or otherwise commercially exploit the Service without our
                express written permission.
              </li>
            </ul>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              The Service and all its original content, features, and functionality — including but
              not limited to the Fold name, logo, software, AI models, and visual design — are and
              remain the exclusive property of Fold and its licensors. These are protected by
              intellectual property laws.
            </p>
            <p>
              You retain ownership of your own data. By connecting your data sources to Fold, you
              grant us a limited, non-exclusive license to process your data solely for the purpose
              of providing the Service.
            </p>
          </Section>

          <Section title="8. Privacy">
            <p>
              Your use of the Service is subject to our{" "}
              <a href="/privacy">Privacy Policy</a>, which is incorporated into these Terms by
              reference. By using the Service, you consent to our data practices as described in
              the Privacy Policy.
            </p>
          </Section>

          <Section title="9. Disclaimers">
            <p>
              The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis
              without any warranties of any kind, either express or implied, including but not
              limited to implied warranties of merchantability, fitness for a particular purpose, or
              non-infringement.
            </p>
            <p>
              AI-generated insights and recommendations provided by Fold are for informational
              purposes only. They do not constitute financial, legal, or professional advice. You
              are solely responsible for any business decisions you make based on information
              provided by the Service.
            </p>
            <p>
              We do not guarantee that the Service will be uninterrupted, error-free, or secure, or
              that defects will be corrected.
            </p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>
              To the maximum extent permitted by applicable law, Fold and its directors, employees,
              partners, and agents shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages — including without limitation loss of profits, data,
              or goodwill — arising from your use of or inability to use the Service, even if we
              have been advised of the possibility of such damages.
            </p>
            <p>
              In no event shall our aggregate liability to you exceed the greater of (a) the amount
              you paid us in the twelve months preceding the claim, or (b) one hundred US dollars
              ($100).
            </p>
          </Section>

          <Section title="11. Indemnification">
            <p>
              You agree to indemnify and hold harmless Fold and its officers, directors, employees,
              and agents from and against any claims, liabilities, damages, losses, and expenses
              (including reasonable legal fees) arising out of or in any way connected with:
            </p>
            <ul>
              <li>Your access to or use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any third-party rights</li>
            </ul>
          </Section>

          <Section title="12. Termination">
            <p>
              You may stop using the Service at any time. You may delete your account by contacting
              us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
            <p>
              We may suspend or terminate your access to the Service immediately, without prior
              notice or liability, for any reason, including if you breach these Terms. Upon
              termination, your right to use the Service will immediately cease.
            </p>
          </Section>

          <Section title="13. Governing Law">
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the
              European Union and the applicable national laws, without regard to conflict of law
              principles. Any disputes arising from these Terms shall be subject to the exclusive
              jurisdiction of the competent courts.
            </p>
          </Section>

          <Section title="14. Changes to These Terms">
            <p>
              We reserve the right to update or modify these Terms at any time. We will notify you
              of material changes by posting the updated Terms on this page and updating the
              &quot;Last updated&quot; date. For significant changes, we will also notify you by
              email. Your continued use of the Service after the effective date of any changes
              constitutes your acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="15. Contact Us">
            <p>
              If you have any questions about these Terms, please contact us:
            </p>
            <div className="rounded-xl border border-[#1e1e2e] bg-[#0d0d16]/60 p-5 mt-4">
              <p className="font-mono text-sm text-[#f0f0f5]">Fold</p>
              <p className="text-sm text-[#8888aa] mt-1">
                Email:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              </p>
              <p className="text-sm text-[#8888aa]">
                Website:{" "}
                <a href="https://usefold.io">usefold.io</a>
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
            <Link href="/privacy" className="text-xs text-[#4a4a6a] hover:text-[#8888aa] transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs text-[#00d4aa]">
              Terms of Service
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// ─── Helper ────────────────────────────────────────────────────────────────

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
