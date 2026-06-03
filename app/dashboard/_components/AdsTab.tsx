"use client";

import { useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import type { Snapshot } from "./DashboardShell";
import { ADS_PROVIDERS, REVENUE_PROVIDERS } from "@/lib/integrations/catalog";

interface AdsTabProps {
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
  currencies: Record<string, string>;
}

function fmt(n: number, type: "currency" | "number" | "percent" | "x" = "number", currency = "USD"): string {
  if (type === "currency") {
    // Ad spend is stored in whole currency units (not cents)
    if (n >= 1_000) return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(n);
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }
  if (type === "percent") return `${n.toFixed(1)}%`;
  if (type === "x") return `${n.toFixed(2)}x`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

type Range = 7 | 30 | 90;
const PLATFORM_COLORS: Record<string, string> = {
  meta: "#1877f2",
  "google-ads": "#4285F4",
  "tiktok-ads": "#010101",
  "pinterest-ads": "#E60023",
  "snapchat-ads": "#FFFC00",
};

interface CampaignRow {
  id: string;
  name: string;
  platform: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  roas: number;
  cpc: number;
  ctr: number;
  cpa: number;
}

export default function AdsTab({ isPremium, connectedPlatforms, snapshots, currencies }: AdsTabProps) {
  const [range, setRange] = useState<Range>(30);

  const adsCurrency = useMemo(() => {
    const p = connectedPlatforms.find(p => ADS_PROVIDERS.includes(p));
    return p ? (currencies[p] ?? "USD") : "USD";
  }, [connectedPlatforms, currencies]);

  const connectedAds = connectedPlatforms.filter(p => ADS_PROVIDERS.includes(p));
  const connectedRevenue = connectedPlatforms.filter(p => REVENUE_PROVIDERS.includes(p));

  const { kpis, dailySpend, spendByPlatform, campaigns, hasData } = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const adSnaps = snapshots.filter(
      (s) => ADS_PROVIDERS.includes(s.provider) && s.date >= cutoffStr
    );
    const revSnaps = snapshots.filter(
      (s) => REVENUE_PROVIDERS.includes(s.provider) && s.date >= cutoffStr
    );

    let totalSpend = 0, totalImpressions = 0, totalClicks = 0;
    let totalConversions = 0, totalConversionValue = 0, totalPurchaseValue = 0;

    const spendByPlatformMap: Record<string, number> = {};
    const dailyMap: Record<string, number> = {};
    const campaignMap: Record<string, CampaignRow> = {};

    for (const snap of adSnaps) {
      const d = snap.data as Record<string, unknown>;
      const spend    = Number(d.spend ?? 0);
      const impr     = Number(d.impressions ?? 0);
      const clicks   = Number(d.clicks ?? 0);
      const conv     = Number(d.conversions ?? 0);
      const convVal  = Number(d.purchaseValue ?? d.conversionValue ?? 0);

      totalSpend           += spend;
      totalImpressions     += impr;
      totalClicks          += clicks;
      totalConversions     += conv;
      totalConversionValue += convVal;
      totalPurchaseValue   += convVal;

      spendByPlatformMap[snap.provider] = (spendByPlatformMap[snap.provider] ?? 0) + spend;
      dailyMap[snap.date] = (dailyMap[snap.date] ?? 0) + spend;

      // Campaign breakdown
      if (Array.isArray(d.campaignBreakdown)) {
        for (const c of d.campaignBreakdown as Array<Record<string, unknown>>) {
          const cid = `${snap.provider}:${String(c.campaign_id ?? c.id ?? c.name)}`;
          if (!campaignMap[cid]) {
            campaignMap[cid] = {
              id: cid, name: String(c.campaign_name ?? c.name ?? cid),
              platform: snap.provider, spend: 0, impressions: 0, clicks: 0,
              conversions: 0, conversionValue: 0, roas: 0, cpc: 0, ctr: 0, cpa: 0,
            };
          }
          campaignMap[cid].spend           += Number(c.spend ?? 0);
          campaignMap[cid].impressions     += Number(c.impressions ?? 0);
          campaignMap[cid].clicks          += Number(c.clicks ?? 0);
          campaignMap[cid].conversions     += Number(c.conversions ?? 0);
          campaignMap[cid].conversionValue += Number(c.conversion_value ?? c.purchaseValue ?? 0);
        }
      }
    }

    // Compute total store revenue in period for blended ROAS
    const totalRevenue = revSnaps.reduce((acc, s) => {
      const d = s.data as Record<string, number>;
      return acc + (d.grossRevenue ?? d.revenue ?? 0);
    }, 0);

    const blendedROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;

    // Fill daily data
    const dailySpend: { date: string; label: string; spend: number }[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(); d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailySpend.push({
        date: key,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
        spend: dailyMap[key] ?? 0,
      });
    }

    // Pie chart data
    const spendByPlatform = Object.entries(spendByPlatformMap).map(([platform, spend]) => ({
      platform,
      name: platform.replace(/-ads$/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      spend,
      color: PLATFORM_COLORS[platform] ?? "#635bff",
    }));

    // Campaigns
    const campaigns = Object.values(campaignMap).sort((a, b) => b.spend - a.spend).map(c => ({
      ...c,
      roas: c.spend > 0 ? c.conversionValue / c.spend : 0,
      cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
    }));

    return {
      kpis: {
        totalSpend, blendedROAS, avgCPC, avgCTR, avgCPA,
        totalImpressions, totalClicks, totalConversions, totalConversionValue,
      },
      dailySpend, spendByPlatform, campaigns,
      hasData: adSnaps.length > 0,
    };
  }, [snapshots, range, connectedRevenue]);

  const isConnected = connectedAds.length > 0;

  if (!isConnected) {
    return (
      <div className="w-full space-y-5">
        <h2 className="font-mono text-lg font-bold text-[#1a1a2e]">Ads</h2>
        <div className="rounded-2xl border border-dashed border-black/12 bg-[#ffffff] px-6 py-10 text-center">
          <p className="font-mono text-sm font-semibold text-[#3a3a5a] mb-2">No ad account connected</p>
          <p className="font-mono text-[11px] text-[#7070a0] mb-4">Connect Meta Ads, Google Ads, TikTok Ads or others to track blended ROAS and campaign performance.</p>
          <a href="/dashboard?tab=data-sources" className="inline-flex items-center gap-2 rounded-xl bg-[#1877f2] px-4 py-2 font-mono text-[11px] font-bold text-white hover:bg-[#0f6ed4] transition">
            Connect Ads →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-lg font-bold text-[#1a1a2e]">Ads</h2>
          <p className="font-mono text-[11px] text-[#5a5a7a] mt-0.5">Blended ROAS, spend & campaign performance across all channels</p>
        </div>
        <div className="flex rounded-lg border border-black/8 bg-black/4 p-0.5">
          {([7, 30, 90] as const).map((d) => (
            <button key={d} onClick={() => setRange(d)}
              className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold transition-all ${range === d ? "bg-black/15 text-[#1a1a2e]" : "text-[#4a4a6a] hover:text-[#5a5a7a]"}`}>
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Blended ROAS", value: kpis.blendedROAS > 0 ? fmt(kpis.blendedROAS, "x") : "—", color: kpis.blendedROAS >= 2 ? "#00d4aa" : kpis.blendedROAS > 0 ? "#f59e0b" : "#7070a0" },
          { label: "Total Spend", value: kpis.totalSpend > 0 ? fmt(kpis.totalSpend, "currency", adsCurrency) : "—", color: "#1877f2" },
          { label: "Avg CPC", value: kpis.avgCPC > 0 ? fmt(kpis.avgCPC, "currency", adsCurrency) : "—", color: "#635bff" },
          { label: "Avg CTR", value: kpis.avgCTR > 0 ? fmt(kpis.avgCTR, "percent") : "—", color: "#f59e0b" },
          { label: "Cost/Conv.", value: kpis.avgCPA > 0 ? fmt(kpis.avgCPA, "currency", adsCurrency) : "—", color: "#f87171" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-black/8 bg-[#ffffff] p-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#7070a0] mb-1">{kpi.label}</p>
            <p className="font-mono text-xl font-bold tabular-nums" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Spend trend */}
          <div className="lg:col-span-2 rounded-2xl border border-black/8 bg-[#ffffff] p-5">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[#5a5a7a] mb-4">Daily Ad Spend</p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={dailySpend} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1877f2" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#1877f2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#5a5a7a", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} interval={range === 7 ? 0 : range === 30 ? 4 : 13} tickMargin={8} />
                <YAxis tick={{ fill: "#5a5a7a", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={44}
                  tickFormatter={(v) => new Intl.NumberFormat("en-US", { style: "currency", currency: adsCurrency, notation: "compact", maximumFractionDigits: 0 }).format(v)} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const val = (payload[0].value as number).toLocaleString("en-US", { style: "currency", currency: adsCurrency, minimumFractionDigits: 2 });
                  return <div className="rounded-xl border border-black/12 bg-[#f4f4f8] px-3 py-2 shadow-xl"><p className="font-mono text-[9px] text-[#4a4a6a] mb-1">{label}</p><p className="font-mono text-sm font-bold text-[#1a1a2e]">{val}</p></div>;
                }} />
                <Area type="monotone" dataKey="spend" stroke="#1877f2" strokeWidth={2} fill="url(#spendGrad)" dot={false} activeDot={{ r: 3, fill: "#1877f2", strokeWidth: 0 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Spend by platform pie */}
          <div className="rounded-2xl border border-black/8 bg-[#ffffff] p-5">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[#5a5a7a] mb-4">Spend by Platform</p>
            {spendByPlatform.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={spendByPlatform} dataKey="spend" nameKey="name" cx="50%" cy="50%" outerRadius={64} innerRadius={32}>
                    {spendByPlatform.map((entry) => (
                      <Cell key={entry.platform} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend formatter={(v) => <span className="font-mono text-[10px] text-[#5a5a7a]">{v}</span>} />
                  <Tooltip formatter={(v) => fmt(Number(v ?? 0), "currency", adsCurrency)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-[#7070a0] font-mono text-[11px]">No data</div>
            )}
          </div>
        </div>
      )}

      {/* Campaign table */}
      {campaigns.length > 0 && (
        <div className="rounded-2xl border border-black/8 bg-[#ffffff] overflow-hidden">
          <div className="px-4 py-3 border-b border-black/6">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[#5a5a7a]">Campaigns · Top {Math.min(campaigns.length, 50)} by Spend</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/6">
                  {["Campaign", "Platform", "Spend", "ROAS", "CTR", "CPC", "Conversions"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-mono text-[9px] uppercase tracking-widest text-[#7070a0] first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.slice(0, 50).map((c, i) => (
                  <tr key={c.id} className={`border-b border-black/4 ${i % 2 ? "bg-black/1" : ""}`}>
                    <td className="px-4 py-3 max-w-52 truncate font-mono text-[11px] text-[#1a1a2e]">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ color: PLATFORM_COLORS[c.platform] ?? "#635bff", backgroundColor: (PLATFORM_COLORS[c.platform] ?? "#635bff") + "15" }}>
                        {c.platform.replace(/-ads$/, "").replace(/-/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] font-bold text-[#1a1a2e] tabular-nums">{fmt(c.spend, "currency", adsCurrency)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-[10px] font-semibold tabular-nums ${c.roas >= 2 ? "text-emerald-400" : c.roas > 1 ? "text-amber-400" : "text-red-400"}`}>
                        {c.roas > 0 ? fmt(c.roas, "x") : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-[#5a5a7a] tabular-nums">{c.ctr > 0 ? fmt(c.ctr, "percent") : "—"}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-[#5a5a7a] tabular-nums">{c.cpc > 0 ? fmt(c.cpc, "currency", adsCurrency) : "—"}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-[#5a5a7a] tabular-nums">{c.conversions > 0 ? fmt(c.conversions) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!hasData && (
        <div className="rounded-2xl border border-black/8 bg-[#ffffff] px-6 py-10 text-center">
          <p className="font-mono text-[11px] text-[#7070a0]">No ad data in the last {range} days. Data syncs daily.</p>
        </div>
      )}
    </div>
  );
}
