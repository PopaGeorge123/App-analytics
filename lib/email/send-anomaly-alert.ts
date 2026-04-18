import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface AnomalyAlert {
  metric: string;
  platform: string;
  current: number;
  average: number;
  changePct: number;
  direction: "up" | "down";
  severity: "critical" | "warning";
  unit?: string;
}

export async function sendAnomalyAlertEmail(
  email: string,
  alerts: AnomalyAlert[]
): Promise<void> {
  if (alerts.length === 0) return;

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const subject =
    criticalCount > 0
      ? `🚨 ${criticalCount} critical metric alert${criticalCount > 1 ? "s" : ""} — Fold`
      : `⚠️ ${alerts.length} metric warning${alerts.length > 1 ? "s" : ""} — Fold`;

  function fmtVal(val: number, unit?: string) {
    if (unit === "currency") return `$${(val / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    if (unit === "pct") return `${val.toFixed(1)}%`;
    return val.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  const alertRows = alerts
    .map((a) => {
      const arrow = a.direction === "down" ? "▼" : "▲";
      const arrowColor = a.direction === "down" ? "#f87171" : a.severity === "warning" ? "#f59e0b" : "#f87171";
      const badge =
        a.severity === "critical"
          ? `<span style="background:#f87171;color:#13131f;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;">CRITICAL</span>`
          : `<span style="background:#f59e0b;color:#13131f;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;">WARNING</span>`;
      return `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #2a2a3e;">
          <div style="font-family:monospace;font-size:12px;font-weight:700;color:#f8f8fc;">${a.metric}</div>
          <div style="font-family:monospace;font-size:10px;color:#8585aa;margin-top:2px;">${a.platform}</div>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #2a2a3e;font-family:monospace;font-size:13px;font-weight:700;" align="right">
          <span style="color:${arrowColor}">${arrow} ${Math.abs(a.changePct).toFixed(0)}%</span>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #2a2a3e;font-family:monospace;font-size:11px;color:#bcbcd8;" align="right">
          ${fmtVal(a.current, a.unit)} vs avg ${fmtVal(a.average, a.unit)}
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #2a2a3e;" align="right">${badge}</td>
      </tr>`;
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <span style="font-family:monospace;font-size:18px;font-weight:700;color:#00d4aa;">fold</span>
        <span style="font-family:monospace;font-size:10px;color:#8585aa;letter-spacing:0.15em;text-transform:uppercase;">anomaly alert</span>
      </div>
      <div style="height:2px;background:linear-gradient(90deg,#f87171 0%,#f59e0b 60%,transparent 100%);border-radius:1px;"></div>
    </div>

    <!-- Alert summary -->
    <div style="background:#1c1c2a;border:1px solid #363650;border-left:3px solid ${criticalCount > 0 ? "#f87171" : "#f59e0b"};border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <p style="font-family:monospace;font-size:22px;font-weight:700;color:#f8f8fc;margin:0 0 6px;">
        ${alerts.length} metric ${alerts.length === 1 ? "anomaly" : "anomalies"} detected
      </p>
      <p style="font-family:monospace;font-size:12px;color:#8585aa;margin:0;">
        Today's data deviates significantly from your 7-day average. Review below.
      </p>
    </div>

    <!-- Alert table -->
    <div style="background:#1c1c2a;border:1px solid #363650;border-radius:12px;overflow:hidden;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead>
          <tr style="background:#222235;">
            <th style="padding:10px 16px;font-family:monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#8585aa;text-align:left;">Metric</th>
            <th style="padding:10px 16px;font-family:monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#8585aa;text-align:right;">Change</th>
            <th style="padding:10px 16px;font-family:monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#8585aa;text-align:right;">Today vs Avg</th>
            <th style="padding:10px 16px;font-family:monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#8585aa;text-align:right;">Severity</th>
          </tr>
        </thead>
        <tbody>${alertRows}</tbody>
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:32px;">
      <a href="https://app.usefold.io/dashboard?tab=analytics" style="display:inline-block;background:#00d4aa;color:#13131f;font-family:monospace;font-size:13px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;">
        View Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #1c1c2a;padding-top:20px;text-align:center;">
      <p style="font-family:monospace;font-size:10px;color:#454560;margin:0 0 4px;">
        You're receiving anomaly alerts because you're subscribed to Fold Digest.
      </p>
      <p style="font-family:monospace;font-size:10px;color:#454560;margin:0;">
        <a href="https://app.usefold.io/dashboard?tab=settings" style="color:#454560;">Manage notification settings</a>
      </p>
    </div>

  </div>
</body>
</html>`;

  await resend.emails.send({
    from: "Fold Alerts <info@usefold.io>",
    to: email,
    subject,
    html,
  });
}
