import nodemailer from "nodemailer";

// Create a reusable transporter using SMTP credentials from env
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true", // true for port 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendConfirmationEmail(email: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const confirmUrl = `${baseUrl}/confirm?token=${token}`;
  const fromName = process.env.SMTP_FROM_NAME ?? "Fold Team";
  const fromEmail = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER ?? "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirm your Fold waitlist spot</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#12121a;border:1px solid #1e1e2e;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #1e1e2e;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family:'Courier New',monospace;font-size:20px;font-weight:700;color:#00d4aa;letter-spacing:-0.5px;">Fold</span>
                    <span style="display:block;font-size:11px;color:#4a4a6a;margin-top:2px;font-family:'Courier New',monospace;letter-spacing:1px;">AI BUSINESS INTELLIGENCE</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:13px;color:#00d4aa;font-family:'Courier New',monospace;letter-spacing:1px;">ACTION REQUIRED</p>
              <h1 style="margin:0 0 24px;font-size:26px;font-weight:700;color:#f0f0f5;line-height:1.3;">Confirm your waitlist spot</h1>
              <p style="margin:0 0 16px;font-size:16px;color:#8888aa;line-height:1.7;">Hi there,</p>
              <p style="margin:0 0 16px;font-size:16px;color:#8888aa;line-height:1.7;">
                Thanks for your interest in <strong style="color:#f0f0f5;">Fold</strong> — the AI-powered business dashboard built for founders like you.
              </p>
              <p style="margin:0 0 32px;font-size:16px;color:#8888aa;line-height:1.7;">
                Click the button below to confirm your spot on the waitlist. We'll reach out as soon as we're ready to onboard early users.
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td style="background-color:#00d4aa;border-radius:8px;">
                    <a href="${confirmUrl}" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#0a0a0f;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                      Confirm my spot &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Link fallback -->
              <p style="margin:0;font-size:13px;color:#4a4a6a;line-height:1.6;">
                Or copy this link into your browser:<br/>
                <a href="${confirmUrl}" style="color:#00d4aa;word-break:break-all;">${confirmUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1e1e2e;">
              <p style="margin:0;font-size:13px;color:#4a4a6a;line-height:1.6;">
                If you didn't sign up for this, just ignore this email. No action needed.
              </p>
            </td>
          </tr>
        </table>
        <!-- Outer footer -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin-top:24px;">
          <tr>
            <td style="padding:0 8px;">
              <p style="margin:0;font-size:12px;color:#2a2a3a;text-align:center;">
                &copy; 2026 Fold. Built for small business founders.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
  });

  return await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: email,
    subject: "Confirm your spot on the Fold waitlist",
    html,
  });
}

export async function sendWelcomeEmail(email: string): Promise<void> {
  if (!email) return;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const dashboardUrl = `${baseUrl}/dashboard`;
  const fromName = process.env.SMTP_FROM_NAME ?? "Fold Team";
  const fromEmail = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER ?? "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#12121a;border:1px solid #1e1e2e;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #1e1e2e;">
            <span style="font-family:'Courier New',monospace;font-size:20px;font-weight:700;color:#00d4aa;">Fold</span>
            <span style="display:block;font-size:11px;color:#4a4a6a;margin-top:2px;font-family:'Courier New',monospace;letter-spacing:1px;">AI BUSINESS INTELLIGENCE</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:13px;color:#00d4aa;font-family:'Courier New',monospace;letter-spacing:1px;">WELCOME ABOARD</p>
            <h1 style="margin:0 0 24px;font-size:26px;font-weight:700;color:#f0f0f5;line-height:1.3;">Your dashboard is ready.</h1>
            <p style="margin:0 0 16px;font-size:16px;color:#8888aa;line-height:1.7;">
              Thanks for joining <strong style="color:#f0f0f5;">Fold</strong> — you now have an AI-powered business dashboard that connects all your tools and explains what's actually happening.
            </p>
            <p style="margin:0 0 32px;font-size:16px;color:#8888aa;line-height:1.7;">
              Head to your dashboard to connect your first integration — it takes about 60 seconds.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
              <tr>
                <td style="background-color:#00d4aa;border-radius:8px;">
                  <a href="${dashboardUrl}" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#0a0a0f;text-decoration:none;">
                    Go to my dashboard &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:13px;color:#4a4a6a;line-height:1.6;">
              Any questions? Just reply to this email — we read every one.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #1e1e2e;">
            <p style="margin:0;font-size:13px;color:#4a4a6a;">&copy; 2026 Fold. Built for founders.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: email,
    subject: "Welcome to Fold — your dashboard is ready",
    html,
  });
}

export async function sendTrialEndingEmail(email: string, trialEndDate: string): Promise<void> {
  if (!email) return;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const upgradeUrl = `${baseUrl}/dashboard?upgrade=1`;
  const fromName = process.env.SMTP_FROM_NAME ?? "Fold Team";
  const fromEmail = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER ?? "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#12121a;border:1px solid #1e1e2e;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #1e1e2e;">
            <span style="font-family:'Courier New',monospace;font-size:20px;font-weight:700;color:#00d4aa;">Fold</span>
            <span style="display:block;font-size:11px;color:#4a4a6a;margin-top:2px;font-family:'Courier New',monospace;letter-spacing:1px;">AI BUSINESS INTELLIGENCE</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:13px;color:#f59e0b;font-family:'Courier New',monospace;letter-spacing:1px;">TRIAL ENDING SOON</p>
            <h1 style="margin:0 0 24px;font-size:26px;font-weight:700;color:#f0f0f5;line-height:1.3;">Your free trial ends on ${trialEndDate}.</h1>
            <p style="margin:0 0 16px;font-size:16px;color:#8888aa;line-height:1.7;">
              After your trial ends, you'll lose access to <strong style="color:#f0f0f5;">Analytics, Website Optimizer, and AI Advisor</strong>. The free Overview dashboard will stay available.
            </p>
            <p style="margin:0 0 32px;font-size:16px;color:#8888aa;line-height:1.7;">
              Upgrade to Premium ($29/month) to keep everything — cancel any time, no lock-in.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
              <tr>
                <td style="background-color:#00d4aa;border-radius:8px;">
                  <a href="${upgradeUrl}" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#0a0a0f;text-decoration:none;">
                    Upgrade to Premium &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:13px;color:#4a4a6a;line-height:1.6;">
              Questions? Just reply — we're happy to help.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #1e1e2e;">
            <p style="margin:0;font-size:13px;color:#4a4a6a;">&copy; 2026 Fold. Cancel any time from your account settings.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: email,
    subject: `Your Fold trial ends on ${trialEndDate} — don't lose access`,
    html,
  });
}

export async function sendPaymentFailedEmail(email: string): Promise<void> {
  if (!email) return;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const billingUrl = `${baseUrl}/dashboard?tab=settings`;
  const fromName = process.env.SMTP_FROM_NAME ?? "Fold Team";
  const fromEmail = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER ?? "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#12121a;border:1px solid #1e1e2e;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #1e1e2e;">
            <span style="font-family:'Courier New',monospace;font-size:20px;font-weight:700;color:#00d4aa;">Fold</span>
            <span style="display:block;font-size:11px;color:#4a4a6a;margin-top:2px;font-family:'Courier New',monospace;letter-spacing:1px;">AI BUSINESS INTELLIGENCE</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:13px;color:#f87171;font-family:'Courier New',monospace;letter-spacing:1px;">PAYMENT FAILED</p>
            <h1 style="margin:0 0 24px;font-size:26px;font-weight:700;color:#f0f0f5;line-height:1.3;">We couldn't process your payment.</h1>
            <p style="margin:0 0 16px;font-size:16px;color:#8888aa;line-height:1.7;">
              Your latest Fold Premium payment didn't go through — this is usually due to an expired card or insufficient funds.
            </p>
            <p style="margin:0 0 32px;font-size:16px;color:#8888aa;line-height:1.7;">
              <strong style="color:#f0f0f5;">Your access is still active.</strong> We'll retry automatically over the next few days. To avoid any interruption, please update your payment method now.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
              <tr>
                <td style="background-color:#00d4aa;border-radius:8px;">
                  <a href="${billingUrl}" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#0a0a0f;text-decoration:none;">
                    Update payment method &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:13px;color:#4a4a6a;line-height:1.6;">
              If your card was recently renewed or replaced, updating it takes less than a minute. Questions? Reply to this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #1e1e2e;">
            <p style="margin:0;font-size:13px;color:#4a4a6a;">&copy; 2026 Fold. You'll only lose access if all retries fail.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: email,
    subject: "Action needed — your Fold payment failed",
    html,
  });
}
