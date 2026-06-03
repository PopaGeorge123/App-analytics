"use client";

import { useMemo, useState } from "react";
import type { Snapshot } from "./DashboardShell";
import { REVENUE_PROVIDERS } from "@/lib/integrations/catalog";

interface ProductsTabProps {
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

interface ProductRow {
  id: string;
  name: string;
  revenue: number;
  unitsSold: number;
  orderCount: number;
  returnRate: number;
  inStock: boolean;
  stockCount: number;
  daysOfStock: number;
}

interface InventoryAlert {
  sku: string;
  name: string;
  stockCount: number;
  daysOfStock: number;
  outOfStock: boolean;
}

type SortKey = "revenue" | "unitsSold" | "returnRate" | "stockCount";

export default function ProductsTab({ isPremium, connectedPlatforms, snapshots, currencies }: ProductsTabProps) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [range, setRange] = useState<30 | 7 | 90>(30);

  const currency = useMemo(() => {
    const storeProvider = connectedPlatforms.find(p => REVENUE_PROVIDERS.includes(p));
    return storeProvider ? (currencies[storeProvider] ?? "USD") : "USD";
  }, [connectedPlatforms, currencies]);

  const { products, inventoryAlerts, hasData } = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const storeSnaps = snapshots.filter(
      (s) => REVENUE_PROVIDERS.includes(s.provider) && s.date >= cutoffStr
    );

    // Aggregate top products across all store snapshots
    const productMap: Record<string, ProductRow> = {};
    const inventoryMap: Record<string, InventoryAlert> = {};

    for (const snap of storeSnaps) {
      const d = snap.data as Record<string, unknown>;

      // Top products array embedded in snapshot data
      if (Array.isArray(d.topProductsByRevenue)) {
        for (const p of d.topProductsByRevenue as Array<Record<string, unknown>>) {
          const id = String(p.id ?? p.product_id ?? p.name ?? "unknown");
          if (!productMap[id]) {
            productMap[id] = {
              id,
              name: String(p.name ?? id),
              revenue: 0,
              unitsSold: 0,
              orderCount: 0,
              returnRate: 0,
              inStock: Boolean(p.in_stock ?? true),
              stockCount: Number(p.stock_count ?? p.inventory_quantity ?? 0),
              daysOfStock: 0,
            };
          }
          productMap[id].revenue    += Number(p.revenue ?? p.totalPrice ?? 0);
          productMap[id].unitsSold  += Number(p.units_sold ?? p.quantity ?? 0);
          productMap[id].orderCount += Number(p.order_count ?? 0);
          productMap[id].returnRate  = Number(p.return_rate ?? 0);
          // Take the latest stock count
          productMap[id].stockCount  = Number(p.stock_count ?? p.inventory_quantity ?? productMap[id].stockCount);
          productMap[id].inStock     = Boolean(p.in_stock ?? productMap[id].inStock);
        }
      }

      // Inventory alerts
      if (Array.isArray(d.inventoryAlerts)) {
        for (const a of d.inventoryAlerts as Array<Record<string, unknown>>) {
          const sku = String(a.sku ?? a.variant_id ?? a.name ?? "unknown");
          inventoryMap[sku] = {
            sku,
            name: String(a.name ?? sku),
            stockCount: Number(a.stock_count ?? a.inventory_quantity ?? 0),
            daysOfStock: Number(a.days_of_stock_remaining ?? 0),
            outOfStock: Boolean(a.out_of_stock ?? false),
          };
        }
      }
    }

    const products = Object.values(productMap);
    const inventoryAlerts = Object.values(inventoryMap);

    return { products, inventoryAlerts, hasData: products.length > 0 };
  }, [snapshots, range]);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      if (sortKey === "revenue")    return b.revenue    - a.revenue;
      if (sortKey === "unitsSold")  return b.unitsSold  - a.unitsSold;
      if (sortKey === "returnRate") return b.returnRate - a.returnRate;
      if (sortKey === "stockCount") return a.stockCount - b.stockCount; // low stock first
      return 0;
    });
  }, [products, sortKey]);

  const isConnected = connectedPlatforms.some(p => REVENUE_PROVIDERS.includes(p));

  return (
    <div className="w-full space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-lg font-bold text-[#1a1a2e]">Products</h2>
          <p className="font-mono text-[11px] text-[#5a5a7a] mt-0.5">Revenue, units sold & inventory health</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-black/8 bg-black/4 p-0.5">
            {([7, 30, 90] as const).map((d) => (
              <button key={d} onClick={() => setRange(d)}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold transition-all ${range === d ? "bg-black/15 text-[#1a1a2e]" : "text-[#4a4a6a] hover:text-[#5a5a7a]"}`}>
                {d}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Not connected */}
      {!isConnected && (
        <div className="rounded-2xl border border-dashed border-black/12 bg-[#ffffff] px-6 py-10 text-center">
          <p className="font-mono text-sm font-semibold text-[#3a3a5a] mb-2">No store connected</p>
          <p className="font-mono text-[11px] text-[#7070a0] mb-4">Connect Shopify or WooCommerce to track product performance and inventory.</p>
          <a href="/dashboard?tab=data-sources" className="inline-flex items-center gap-2 rounded-xl bg-[#96bf48] px-4 py-2 font-mono text-[11px] font-bold text-white hover:bg-[#7aa33a] transition">
            Connect Store →
          </a>
        </div>
      )}

      {/* No data yet */}
      {isConnected && !hasData && (
        <div className="rounded-2xl border border-black/8 bg-[#ffffff] px-6 py-10 text-center">
          <p className="font-mono text-[11px] text-[#7070a0]">No product data in the last {range} days. Data syncs daily.</p>
        </div>
      )}

      {/* Inventory Alerts */}
      {inventoryAlerts.length > 0 && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/4 p-4">
          <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-amber-500 mb-3">⚠ Inventory Alerts</p>
          <div className="space-y-2">
            {inventoryAlerts.slice(0, 10).map((a) => (
              <div key={a.sku} className="flex items-center justify-between gap-4">
                <span className="font-mono text-[11px] text-[#3a3a5a] truncate flex-1">{a.name}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-mono text-[10px] font-semibold ${a.outOfStock ? "text-red-400" : "text-amber-500"}`}>
                    {a.outOfStock ? "Out of stock" : `${a.stockCount} left`}
                  </span>
                  {!a.outOfStock && a.daysOfStock > 0 && (
                    <span className="font-mono text-[9px] text-[#7070a0]">~{a.daysOfStock}d remaining</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products Table */}
      {hasData && (
        <div className="rounded-2xl border border-black/8 bg-[#ffffff] overflow-hidden">
          {/* Sort controls */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-black/6 flex-wrap">
            <span className="font-mono text-[9px] text-[#7070a0] uppercase tracking-widest mr-1">Sort by</span>
            {(["revenue", "unitsSold", "returnRate", "stockCount"] as SortKey[]).map((k) => (
              <button key={k} onClick={() => setSortKey(k)}
                className={`rounded-lg px-2.5 py-1 font-mono text-[9px] font-semibold transition-all border ${
                  sortKey === k ? "bg-[#635bff]/10 border-[#635bff]/20 text-[#635bff]" : "border-black/8 text-[#5a5a7a] hover:border-black/15"
                }`}>
                {k === "revenue" ? "Revenue" : k === "unitsSold" ? "Units sold" : k === "returnRate" ? "Return rate" : "Low stock"}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/6">
                  <th className="px-4 py-2.5 text-left font-mono text-[9px] uppercase tracking-widest text-[#7070a0]">Product</th>
                  <th className="px-4 py-2.5 text-right font-mono text-[9px] uppercase tracking-widest text-[#7070a0]">Revenue</th>
                  <th className="px-4 py-2.5 text-right font-mono text-[9px] uppercase tracking-widest text-[#7070a0]">Units</th>
                  <th className="px-4 py-2.5 text-right font-mono text-[9px] uppercase tracking-widest text-[#7070a0]">Return %</th>
                  <th className="px-4 py-2.5 text-right font-mono text-[9px] uppercase tracking-widest text-[#7070a0]">Stock</th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.slice(0, 50).map((p, i) => (
                  <tr key={p.id} className={`border-b border-black/4 ${i % 2 === 0 ? "bg-transparent" : "bg-black/1"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: p.inStock ? "#00d4aa" : "#f87171" }} />
                        <span className="font-mono text-[11px] text-[#1a1a2e] leading-tight max-w-60 truncate">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[11px] font-bold text-[#1a1a2e] tabular-nums">
                      {fmt(p.revenue, "currency", currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[11px] text-[#5a5a7a] tabular-nums">
                      {fmt(p.unitsSold)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono text-[10px] font-semibold tabular-nums ${p.returnRate > 10 ? "text-red-400" : p.returnRate > 5 ? "text-amber-400" : "text-emerald-400"}`}>
                        {p.returnRate > 0 ? fmt(p.returnRate, "percent") : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.inStock ? (
                        <span className="font-mono text-[10px] text-[#5a5a7a] tabular-nums">{p.stockCount > 0 ? p.stockCount : "✓"}</span>
                      ) : (
                        <span className="font-mono text-[10px] font-semibold text-red-400">Out</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
