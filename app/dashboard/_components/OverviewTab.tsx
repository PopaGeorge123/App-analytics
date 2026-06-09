"use client";

import { useState, useCallback , useMemo, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Snapshot } from "./DashboardShell";
import type { Tab } from "./DashboardShell";
import type { CustomerRow } from "../page";
import { DEMO_SNAPSHOTS, DEMO_CONNECTED_PLATFORMS } from "./demoData";
import { DEFAULT_ALERTS, type AlertRules } from "./DataSourcesTab";
import { LIVE_INTEGRATIONS, REVENUE_PROVIDERS, ANALYTICS_PROVIDERS, ADS_PROVIDERS } from "@/lib/integrations/catalog";
import { DateRangeButton, daysAgo } from "./DateRangePicker";
import type { DateRange } from "./DateRangePicker";

import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  BackgroundVariant,
  MiniMap,
  Handle,
  Position,
   Node, Edge,
   EdgeChange,
   NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ── Types ─────────────────────────────────────────────────────────────────

interface OverviewTabProps {
  email: string;
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
  currencies: Record<string, string>;
  onNavigate: (tab: Tab) => void;
  customers?: CustomerRow[];
}

// ── Main Component ────────────────────────────────────────────────────────

export default function OverviewTab({
  email, isPremium, connectedPlatforms, snapshots, currencies = {}, onNavigate, customers = [],
}: {
  email: string; isPremium: boolean; connectedPlatforms: string[];
  snapshots: Snapshot[]; currencies: Record<string, string>; onNavigate: (tab: Tab) => void;
  customers?: CustomerRow[];
}) {
  const router = useRouter();
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");
  const [alertRules, setAlertRules] = useState<AlertRules>(DEFAULT_ALERTS);

  // Refresh (sync now) state
  const [refreshState, setRefreshState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRouterRefreshing, startRouterRefresh] = useTransition();

  useEffect(() => {
    fetch("/api/user/settings").then((r) => r.json()).then((d) => { if (d.alertRules) setAlertRules(d.alertRules); }).catch(() => { });
  }, []);

  async function handleUpgrade() {
    setUpgradeLoading(true); setUpgradeError("");
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setUpgradeError(data.error ?? "Something went wrong."); setUpgradeLoading(false); return; }
      router.push(data.url);
    } catch { setUpgradeError("Network error. Please try again."); setUpgradeLoading(false); }
  }

  const hasAllIntegrations = LIVE_INTEGRATIONS.every((i) => connectedPlatforms.includes(i.id));
  const missingIntegrations = LIVE_INTEGRATIONS.filter((i) => !connectedPlatforms.includes(i.id));


  

  const initialNodes: Node[] = [
    {
      id: 'n1',
      data: { label: 'Node 1' },
      position: { x: 0, y: 0 },
      type: 'integrationNode',
    },
    {
      id: 'n2',
      data: { label: 'Node 2' },
      position: { x: 100, y: 100 },
    }
  ];

  const initialEdges: Edge[] = [
    { id: 'e1-2', source: 'n1', target: 'n2', animated: true },
  ];

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds: Node[]) => applyNodeChanges(changes, nds)),
    [],
  );
   //vreau ca edgeuri le sa fie animate  animated: true
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds: Edge[]) => applyEdgeChanges(changes, eds.map((e: Edge) => ({ ...e, animated: true })))),
    [],
  );
  const onConnect = useCallback(
    (params: any) => setEdges((eds: Edge[]) => addEdge(params, eds)),
    [],
  );

  const proOptions = { hideAttribution: true };

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-svh flex flex-col">

      {/* ═══════════════════════════════════════════════════════
          PULSE BAR — slim inline status line, no card
      ═══════════════════════════════════════════════════════ */}


      {upgradeError && <p className="font-mono text-xs text-red-400 pb-4">{upgradeError}</p>}

      <div className="flex-1 min-h-0 w-full  rounded-xl ">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          proOptions={proOptions}
          onConnect={onConnect}
          //nodeTypes={nodeTypes}
          fitView
        >
          
          <Controls />
        </ReactFlow>
      </div>

    </div>
  );
}
