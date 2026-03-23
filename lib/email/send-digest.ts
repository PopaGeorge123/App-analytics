import { Resend } from "resend";
import type { Digest } from "@/lib/supabase/database.types";

const resend = new Resend(process.env.RESEND_API_KEY);

interface DigestAction {
  title: string;
  description: string;
  priority: string;
  effort: string;
}

interface DigestHighlight {
  metric: string;
  value: string;
  trend: string;
  change: string;
  context: string;
}

interface DigestAnomaly {
  title: string;
  description: string;
  severity: string;
  dataSource: string;
}

function trendEmoji(trend: string): string {
  if (trend === "up") return "📈";
  if (trend === "down") return "📉";
  return "➡️";
}

function severityEmoji(severity: string): string {
  if (severity === "high") return "🔴";
  if (severity === "medium") return "🟡";
  return "🟢";
}

export async function sendDigestEmail(
  email: string,
  digest: Digest
): Promise<void> {
  const highlights = (digest.highlights as unknown as DigestHighlight[]) ?? [];
  const anomalies = (digest.anomalies as unknown as DigestAnomaly[]) ?? [];
  const action = digest.action as unknown as DigestAction | null;

  const highlightsHtml = highlights
    .map(
      (h) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #1e2030;">${trendEmoji(h.trend)} <strong>${h.metric}</strong></td>
          <td style="padding:8px 12px;border-bottom:1px solid #1e2030;color:#00d4aa;">${h.value}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #1e2030;color:#888;">${h.change}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #1e2030;color:#ccc;">${h.context}</td>
        </tr>`
    )
    .join("");

  const anomaliesHtml = anomalies
    .map(
      (a) =>
        `<div style="margin-bottom:16px;padding:12px 16px;background:#13141f;border-left:3px solid ${a.severity === "high" ? "#ef4444" : a.severity === "medium" ? "#f59e0b" : "#22c55e"};border-radius:4px;">
          <strong>${severityEmoji(a.severity)} ${a.title}</strong>
          <p style="margin:6px 0 0;color:#aaa;">${a.description}</p>
          <p style="margin:4px 0 0;color:#666;font-size:13px;">Source: ${a.dataSource}</p>
        </div>`
    )
    .join("");

  const actionHtml = action
    ? `<div style="background:#0d2e2a;border:1px solid #00d4aa33;border-radius:8px;padding:16px 20px;">
        <strong style="color:#00d4aa;">⚡ ${action.title}</strong>
        <p style="margin:8px 0 0;color:#ccc;">${action.description}</p>
        <p style="margin:6px 0 0;color:#666;font-size:13px;">Priority: ${action.priority} · Effort: ${action.effort}</p>
      </div>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e5e5;">
  <div style="max-width:680px;margin:0 auto;padding:40px 24px;">
    
    <!-- Header -->
    <div style="margin-bottom:32px;">
      <h1 style="margin:0;font-size:22px;color:#fff;">
        <span style="color:#00d4aa;">Fold</span> Daily Digest
      </h1>
      <p style="margin:6px 0 0;color:#666;font-size:14px;">${digest.date}</p>
    </div>

    <!-- Summary -->
    <div style="background:#13141f;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
      <h2 style="margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#666;">Summary</h2>
      <p style="margin:0;line-height:1.6;color:#ddd;">${digest.summary}</p>
    </div>

    <!-- Highlights -->
    ${highlights.length > 0 ? `
    <div style="margin-bottom:28px;">
      <h2 style="margin:0 0 14px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#666;">Highlights</h2>
      <table style="width:100%;border-collapse:collapse;background:#13141f;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#1a1b2e;">
            <th style="padding:8px 12px;text-align:left;color:#666;font-size:12px;">Metric</th>
            <th style="padding:8px 12px;text-align:left;color:#666;font-size:12px;">Value</th>
            <th style="padding:8px 12px;text-align:left;color:#666;font-size:12px;">vs last week</th>
            <th style="padding:8px 12px;text-align:left;color:#666;font-size:12px;">Context</th>
          </tr>
        </thead>
        <tbody>${highlightsHtml}</tbody>
      </table>
    </div>` : ""}

    <!-- Anomalies -->
    ${anomalies.length > 0 ? `
    <div style="margin-bottom:28px;">
      <h2 style="margin:0 0 14px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#666;">Anomalies</h2>
      ${anomaliesHtml}
    </div>` : ""}

    <!-- Cross-platform insight -->
    ${digest.cross_insight ? `
    <div style="background:#13141f;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
      <h2 style="margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#666;">Cross-Platform Insight</h2>
      <p style="margin:0;line-height:1.6;color:#ddd;">${digest.cross_insight}</p>
    </div>` : ""}

    <!-- Action -->
    ${actionHtml}

    <!-- Footer -->
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #1e2030;text-align:center;color:#444;font-size:12px;">
      <p style="margin:0;">You're receiving this because you're a Fold premium member.</p>
      <p style="margin:6px 0 0;"><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="color:#00d4aa;text-decoration:none;">Open Dashboard</a></p>
    </div>

  </div>
</body>
</html>`;

  await resend.emails.send({
    from: "Fold Digest <digest@tryfold.io>",
    to: email,
    subject: `Your Fold Daily Digest — ${digest.date}`,
    html,
  });
}
