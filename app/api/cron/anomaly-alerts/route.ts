import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendAnomalyAlertEmail, type AnomalyAlert } from "@/lib/email/send-anomaly-alert";

// Minimum number of historical days needed to compute a meaningful average
const MIN_HISTORY_DAYS = 3;

// Threshold for anomaly detection (% deviation from 7-day average)
const WARN_THRESHOLD = 0.25;  // 25% deviation → warning
const CRIT_THRESHOLD = 0.50;  // 50% deviation → critical

// Metrics to monitor per provider, with their display names and unit type
const MONITORED_METRICS: Record<string, { key: string; label: string; unit?: string; lowerIsBad?: boolean }[]> = {
  stripe: [
    { key: "revenue",      label: "Daily Revenue",       unit: "currency" },
    { key: "newCustomers", label: "New Customers" },
    { key: "churnedToday", label: "Churned Subscribers",  lowerIsBad: false },
  ],
  ga4: [
    { key: "sessions",    label: "Sessions" },
    { key: "conversions", label: "Conversions" },
    { key: "bounceRate",  label: "Bounce Rate", unit: "pct", lowerIsBad: false },
  ],
  meta: [
    { key: "spend",        label: "Ad Spend",   unit: "currency", lowerIsBad: false },
    { key: "clicks",       label: "Ad Clicks" },
    { key: "impressions",  label: "Impressions" },
  ],
  shopify: [
    { key: "revenue",      label: "Daily Revenue", unit: "currency" },
    { key: "orders",       label: "Orders" },
  ],
  mailchimp: [
    { key: "subscribers",  label: "Subscribers" },
    { key: "openRate",     label: "Open Rate",  unit: "pct" },
  ],
  klaviyo: [
    { key: "subscribers",  label: "Subscribers" },
  ],
  beehiiv: [
    { key: "subscribers",  label: "Subscribers" },
    { key: "openRate",     label: "Open Rate",  unit: "pct" },
  ],
};

interface SnapshotRow {
  provider: string;
  date: string;
  data: Record<string, number>;
}

function detectAnomalies(snapshots: SnapshotRow[], todayDate: string): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];

  // Group snapshots by provider
  const byProvider: Record<string, SnapshotRow[]> = {};
  for (const s of snapshots) {
    if (!byProvider[s.provider]) byProvider[s.provider] = [];
    byProvider[s.provider].push(s);
  }

  for (const [provider, metrics] of Object.entries(MONITORED_METRICS)) {
    const providerSnaps = byProvider[provider] ?? [];
    const historicalSnaps = providerSnaps.filter((s) => s.date < todayDate);
    const todaySnap = providerSnaps.find((s) => s.date === todayDate);

    if (!todaySnap || historicalSnaps.length < MIN_HISTORY_DAYS) continue;

    for (const { key, label, unit, lowerIsBad = true } of metrics) {
      const historicalVals = historicalSnaps
        .map((s) => s.data[key] ?? 0)
        .filter((v) => v > 0); // exclude zero days (no data days)

      if (historicalVals.length < MIN_HISTORY_DAYS) continue;

      const average = historicalVals.reduce((a, b) => a + b, 0) / historicalVals.length;
      if (average === 0) continue;

      const current = todaySnap.data[key] ?? 0;
      const changePct = ((current - average) / average) * 100;
      const absPct = Math.abs(changePct);

      // Only alert if the direction is "bad" (unless lowerIsBad = false, e.g. churn, bounce rate)
      const isBadDrop = lowerIsBad && changePct < 0 && absPct >= WARN_THRESHOLD * 100;
      const isBadSpike = !lowerIsBad && changePct > 0 && absPct >= WARN_THRESHOLD * 100;

      if (!isBadDrop && !isBadSpike) continue;

      const severity: "critical" | "warning" = absPct >= CRIT_THRESHOLD * 100 ? "critical" : "warning";
      alerts.push({
        metric: label,
        platform: provider.charAt(0).toUpperCase() + provider.slice(1),
        current,
        average,
        changePct,
        direction: current < average ? "down" : "up",
        severity,
        unit,
      });
    }
  }

  return alerts;
}

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();

  // Get today's date (UTC)
  const todayDate = new Date().toISOString().slice(0, 10);
  // Look back 14 days for historical average
  const lookbackDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Fetch all premium/trial users who have at least one integration
  const { data: users, error: usersError } = await db
    .from("users")
    .select("id, email, is_premium, trial_ends_at")
    .or("is_premium.eq.true,trial_ends_at.gte." + todayDate);

  if (usersError || !users?.length) {
    return NextResponse.json({ error: usersError?.message ?? "No users", processed: 0 });
  }

  // Filter to users who have at least one monitored integration
  const monitoredProviders = Object.keys(MONITORED_METRICS);
  const { data: integrations } = await db
    .from("integrations")
    .select("user_id, platform")
    .in("user_id", users.map((u) => u.id))
    .in("platform", monitoredProviders);

  const usersWithIntegrations = new Set((integrations ?? []).map((i) => i.user_id));

  const results = await Promise.allSettled(
    users
      .filter((u) => usersWithIntegrations.has(u.id))
      .map(async (user) => {
        // Fetch last 14 days of snapshots (all monitored providers)
        const { data: snapshots } = await db
          .from("daily_snapshots")
          .select("provider, date, data")
          .eq("user_id", user.id)
          .in("provider", monitoredProviders)
          .gte("date", lookbackDate)
          .lte("date", todayDate)
          .order("date", { ascending: true });

        if (!snapshots?.length) return { userId: user.id, skipped: true };

        const alerts = detectAnomalies(
          snapshots as SnapshotRow[],
          todayDate
        );

        if (alerts.length === 0) return { userId: user.id, alerts: 0 };

        // Write to notifications table
        const notificationRows = alerts.map((a) => ({
          user_id: user.id,
          message: `${a.severity === "critical" ? "🚨" : "⚠️"} ${a.metric} ${a.direction === "down" ? "dropped" : "spiked"} ${Math.abs(a.changePct).toFixed(0)}%`,
          detail: `${a.platform}: today ${a.current.toLocaleString()} vs 7d avg ${a.average.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
          color: a.severity === "critical" ? "#f87171" : "#f59e0b",
          icon: a.severity === "critical" ? "🚨" : "⚠️",
          read: false,
        }));

        await db.from("notifications").insert(notificationRows);

        // Send email alert for critical anomalies (or if ≥ 2 warnings)
        const hasCritical = alerts.some((a) => a.severity === "critical");
        const shouldEmail = hasCritical || alerts.length >= 2;

        if (shouldEmail && user.email) {
          await sendAnomalyAlertEmail(user.email, alerts);
        }

        return { userId: user.id, alerts: alerts.length, emailed: shouldEmail };
      })
  );

  const processed = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ processed, failed, date: todayDate });
}
