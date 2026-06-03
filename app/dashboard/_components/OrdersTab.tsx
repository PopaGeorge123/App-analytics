"use client";

import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Snapshot } from "./DashboardShell";
import { REVENUE_PROVIDERS } from "@/lib/integrations/catalog";

interface OrdersTabProps {
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
  currencies: Record<string, string>;
}

function fmt(n: number, type: "currency" | "number" | "percent" = "number", currency = "USD"): string {
  if (type === "currency") {
    const amount = n / 100;
    if (n >= 100_000) return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(amount);
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  }
  if (type === "percent") return `${n.toFixed(1)}%`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

type Range = 7 | 30 | 90;

const CHANNEL_COLORS: Record<string, string> = {
  online: "#635bff",
  organic: "#00d4aa",
  email: "#46B37D",
  social: "#1877f2",
  paid: "#f59e0b",
  draft: "#7070a0",
  other: "#a78bfa",
};

export default function OrdersTab({ isPremium, connectedPlatforms, snapshots, currencies }: OrdersTabProps) {
  const [range, setRange] = useState<Range>(30);

  const currency = useMemo(() => {
    const p = connectedPlatforms.find(p => REVENUE_PROVIDERS.includes(p));
    return p ? (currencies[p] ?? "USD") : "USD";
  }, [connectedPlatforms, currencies]);

  const { kpis, dailyOrders, channelBreakdown, topCountries, hasData } = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const storeSnaps = snapshots.filter(
      (s) => REVENUE_PROVIDERS.includes(s.provider) && s.date >= cutoffStr
    );

    let totalOrders = 0, totalRevenue = 0, totalRefunds = 0;
    let newCustomers = 0, returningCustomers = 0;
    let totalFulfillmentHours = 0, fulfillmentCount = 0;
    let totalAOV = 0, aovCount = 0;
    let totalRefundRate = 0, refundRateCount = 0;

    const dailyMap: Record<string, { orders: number; revenue: number }> = {};
    const channelMap: Record<string, { orders: number; revenue: number }> = {};
    const countryMap: Record<string, { orders: number; revenue: number }> = {};

    for (const snap of storeSnaps) {
      const d = snap.data as Record<string, unknown>;

      // Core metrics
      const orders = Number(d.orders ?? d.txCount ?? 0);
      const rev    = Number((d as Record<string,number>).grossRevenue ?? (d as Record<string,number>).revenue ?? 0);
      totalOrders  += orders;
      totalRevenue += rev;
      totalRefunds += Number(d.refunds ?? 0);

      if (d.newCustomers) newCustomers += Number(d.newCustomers);
      if (d.returningCustomers) returningCustomers += Number(d.returningCustomers);

      if (d.avgFulfillmentHours) { totalFulfillmentHours += Number(d.avgFulfillmentHours); fulfillmentCount++; }
      if (d.aov) { totalAOV += Number(d.aov); aovCount++; }
      if (d.refundRate) { totalRefundRate += Number(d.refundRate); refundRateCount++; }

      // Daily
      dailyMap[snap.date] = dailyMap[snap.date] ?? { orders: 0, revenue: 0 };
      dailyMap[snap.date].orders  += orders;
      dailyMap[snap.date].revenue += rev;

      // Channel breakdown
      if (typeof d.channelBreakdown === "object" && d.channelBreakdown !== null) {
        for (const [ch, count] of Object.entries(d.channelBreakdown as Record<string, number>)) {
          channelMap[ch] = channelMap[ch] ?? { orders: 0, revenue: 0 };
          channelMap[ch].orders += count;
        }
      }

      // Top countries
      if (Array.isArray(d.topCountries)) {
        for (const c of d.topCountries as Array<Record<string, unknown>>) {
          const code = String(c.country ?? c.code ?? "Other");
          countryMap[code] = countryMap[code] ?? { orders: 0, revenue: 0 };
          countryMap[code].orders  += Number(c.orders ?? c.order_count ?? 0);
          countryMap[code].revenue += Number(c.revenue ?? 0);
        }
      }
    }

    const avgAOV = aovCount > 0 ? totalAOV / aovCount : totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const avgFulfillment = fulfillmentCount > 0 ? totalFulfillmentHours / fulfillmentCount : 0;
    const avgRefundRate = refundRateCount > 0 ? totalRefundRate / refundRateCount : totalRevenue > 0 ? (totalRefunds / totalRevenue) * 100 : 0;
    const repeatRate = (newCustomers + returningCustomers) > 0 ? (returningCustomers / (newCustomers + returningCustomers)) * 100 : 0;

    // Build daily chart
    const dailyOrders: { label: string; orders: number; revenue: number }[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(); d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyOrders.push({
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
        orders: dailyMap[key]?.orders ?? 0,
        revenue: dailyMap[key]?.revenue ?? 0,
      });
    }

    const channelBreakdown = Object.entries(channelMap)
      .sort((a, b) => b[1].orders - a[1].orders)
      .map(([ch, val]) => ({ channel: ch, ...val, color: CHANNEL_COLORS[ch.toLowerCase()] ?? "#a78bfa" }));

    const topCountries = Object.entries(countryMap)
      .sort((a, b) => b[1].orders - a[1].orders)
      .slice(0, 10)
      .map(([country, val]) => ({ country, ...val }));

    return {
      kpis: { totalOrders, totalRevenue, avgAOV, avgFulfillment, avgRefundRate, repeatRate, newCustomers, returningCustomers },
      dailyOrders, channelBreakdown, topCountries,
      hasData: storeSnaps.length > 0,
    };
  }, [snapshots, range]);

  const isConnected = connectedPlatforms.some(p => REVENUE_PROVIDERS.includes(p));

  if (!isConnected) {
    return (
      <div className="w-full space-y-5">
        <h2 className="font-mono text-lg font-bold text-[#1a1a2e]">Orders</h2>
        <div className="rounded-2xl border border-dashed border-black/12 bg-[#ffffff] px-6 py-10 text-center">
          <p className="font-mono text-sm font-semibold text-[#3a3a5a] mb-2">No store connected</p>
          <p className="font-mono text-[11px] text-[#7070a0] mb-4">Connect Shopify or WooCommerce to track orders, fulfillment time and channel breakdown.</p>
          <a href="/dashboard?tab=data-sources" className="inline-flex items-center gap-2 rounded-xl bg-[#96bf48] px-4 py-2 font-mono text-[11px] font-bold text-white hover:bg-[#7aa33a] transition">
            Connect Store →
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
          <h2 className="font-mono text-lg font-bold text-[#1a1a2e]">Orders</h2>
          <p className="font-mono text-[11px] text-[#5a5a7a] mt-0.5">Order timeline, fulfilment speed & channel breakdown</p>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Orders",     value: fmt(kpis.totalOrders),                             color: "#635bff" },
          { label: "Total Revenue",    value: fmt(kpis.totalRevenue, "currency", currency),       color: "#00d4aa" },
          { label: "Avg AOV",          value: kpis.avgAOV > 0 ? fmt(kpis.avgAOV, "currency", currency) : "—", color: "#1877f2" },
          { label: "Refund Rate",      value: kpis.avgRefundRate > 0 ? fmt(kpis.avgRefundRate, "percent") : "—", color: kpis.avgRefundRate > 5 ? "#f87171" : "#00d4aa" },
          { label: "Repeat Buyers",    value: kpis.repeatRate > 0 ? fmt(kpis.repeatRate, "percent") : "—", color: "#f59e0b" },
          { label: "Avg Fulfilment",   value: kpis.avgFulfillment > 0 ? `${kpis.avgFulfillment.toFixed(1)}h` : "—", color: "#a78bfa" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-black/8 bg-[#ffffff] p-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#7070a0] mb-1">{kpi.label}</p>
            <p className="font-mono text-xl font-bold tabular-nums" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Daily orders chart + channel/country breakdown */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Daily orders bar chart */}
          <div className="lg:col-span-2 rounded-2xl border border-black/8 bg-[#ffffff] p-5">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[#5a5a7a] mb-4">Daily Orders</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyOrders} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barSize={range === 7 ? 16 : range === 30 ? 6 : 3}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#5a5a7a", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false}
                  interval={range === 7 ? 0 : range === 30 ? 4 : 13} tickMargin={8} />
                <YAxis tick={{ fill: "#5a5a7a", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return <div className="rounded-xl border border-black/12 bg-[#f4f4f8] px-3 py-2 shadow-xl">
                    <p className="font-mono text-[9px] text-[#4a4a6a] mb-1">{label}</p>
                    <p className="font-mono text-sm font-bold text-[#1a1a2e]">{payload[0].value as number} orders</p>
                  </div>;
                }} />
                <Bar dataKey="orders" fill="#635bff" fillOpacity={0.85} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Channel + countries */}
          <div className="rounded-2xl border border-black/8 bg-[#ffffff] p-5 space-y-4">
            {channelBreakdown.length > 0 && (
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[#5a5a7a] mb-3">Sales Channels</p>
                <div className="space-y-2">
                  {channelBreakdown.slice(0, 6).map((c) => {
                    const total = channelBreakdown.reduce((a, x) => a + x.orders, 0);
                    const pct = total > 0 ? (c.orders / total) * 100 : 0;
                    return (
                      <div key={c.channel} className="space-y-1">
                        <div className="flex justify-between">
                          <span className="font-mono text-[10px] text-[#5a5a7a] capitalize">{c.channel}</span>
                          <span className="font-mono text-[10px] font-semibold text-[#1a1a2e]">{c.orders}</span>
                        </div>
                        <div className="h-1 rounded-full bg-black/8 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {topCountries.length > 0 && (
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[#5a5a7a] mb-3">Top Countries</p>
                <div className="space-y-1.5">
                  {topCountries.map((c) => (
                    <div key={c.country} className="flex justify-between items-center">
                      <span className="font-mono text-[10px] text-[#5a5a7a]">{c.country}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-semibold text-[#1a1a2e] tabular-nums">{fmt(c.orders)}</span>
                        {c.revenue > 0 && (
                          <span className="font-mono text-[9px] text-[#7070a0] tabular-nums">{fmt(c.revenue, "currency", currency)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!hasData && (
        <div className="rounded-2xl border border-black/8 bg-[#ffffff] px-6 py-10 text-center">
          <p className="font-mono text-[11px] text-[#7070a0]">No order data in the last {range} days. Data syncs daily.</p>
        </div>
      )}
    </div>
  );
}
