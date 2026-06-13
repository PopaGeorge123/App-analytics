"use client";

import { useState, useCallback, useMemo, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Snapshot } from "./DashboardShell";
import type { Tab } from "./DashboardShell";
import type { CustomerRow } from "../page";
import { DEMO_SNAPSHOTS, DEMO_CONNECTED_PLATFORMS } from "./demoData";
import { DEFAULT_ALERTS, type AlertRules } from "./DataSourcesTab";
import { LIVE_INTEGRATIONS, REVENUE_PROVIDERS, ANALYTICS_PROVIDERS, ADS_PROVIDERS } from "@/lib/integrations/catalog";
import { DateRangeButton, daysAgo } from "./DateRangePicker";
import type { DateRange } from "./DateRangePicker";
import ShopifyNode from "./types/ShopifyNode";
import GoogleAnalyticsNode from "./types/GoogleAnalytics";
import KlaviyoNode from "./types/KlaviyoNode";
import MailchimpNode from "./types/MailchimpNode";
import StripeNode from "./types/StripeNode";
import PostHogNode from "./types/PostHogNode";
import MetaNode from "./types/MetaNode";
import FoldNode from "./types/FoldNode";

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
  email: string;
  isPremium: boolean;
  connectedPlatforms: string[];
  snapshots: Snapshot[];
  currencies: Record<string, string>;
  onNavigate: (tab: Tab) => void;
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

  //const hasAllIntegrations = LIVE_INTEGRATIONS.every((i) => connectedPlatforms.includes(i.id));
  //const missingIntegrations = LIVE_INTEGRATIONS.filter((i) => !connectedPlatforms.includes(i.id));

  const DEFAULT_NODE_POSITIONS = [
    { id: 'shopify', position: { x: 376.218168911252, y: -14.96440063050342 } },
    { id: 'ga4', position: { x: -121.95655656504769, y: -15.577218599665036 } },
    { id: 'klaviyo', position: { x: -127.25149804750473, y: 243.6626920035916 } },
    { id: 'mailchimp', position: { x: 127.57883201745136, y: -18.304484252033262 } },
    { id: 'stripe', position: { x: -131.96641401110992, y: 507.8627852261113 } },
    { id: 'posthog', position: { x: 207.33319414466763, y: 825.4861165538454 } },
    { id: 'meta', position: { x: -52.52062196894961, y: 760.6827730151331 } },
  ]

  
  useEffect(() => {
    const allPlatforms = LIVE_INTEGRATIONS.map((i) => i.id); // ← toate, nu doar connectedPlatforms

    const nodes: Node[] = allPlatforms.map((platform) => {
      const nodeDef = LIVE_INTEGRATIONS.find((i) => i.id === platform);
      let NodeComponent;
      switch (platform) {
        case "shopify": NodeComponent = ShopifyNode; break;
        case "ga4": NodeComponent = GoogleAnalyticsNode; break;
        case "klaviyo": NodeComponent = KlaviyoNode; break;
        case "mailchimp": NodeComponent = MailchimpNode; break;
        case "stripe": NodeComponent = StripeNode; break;
        case "posthog": NodeComponent = PostHogNode; break;
        case "meta": NodeComponent = MetaNode; break;
        default: NodeComponent = () => <div>{platform}</div>;
      }

      return {
        id: platform,
        type: 'integration',
        data: {
          label: nodeDef?.name ?? platform,
          component: NodeComponent,
          isConnected: connectedPlatforms.includes(platform), // ← trimite statusul
        },
        position: DEFAULT_NODE_POSITIONS.find((n) => n.id === platform)?.position || { x: 0, y: 0 },
      };
    });

    const foldNode: Node = {
      id: 'fold',
      type: 'fold',
      data: {
        component: FoldNode,
        connectedCount: connectedPlatforms.length,
      },
      position: { x: 200, y: 300 },
    };

    // edges DOAR pentru cele conectate
    const edges: Edge[] = connectedPlatforms.map((platform) => ({
      id: `edge-${platform}-fold`,
      source: platform,
      targetHandle: `input${connectedPlatforms.indexOf(platform) + 1}`, // asigură-te că handle-urile din FoldNode sunt input1, input2, etc.
      target: 'fold',
      animated: true,
    }));

    setEdges(edges);
    setNodes([...nodes, foldNode]);
  }, [connectedPlatforms]);

  const nodeTypes = useMemo(() => ({
    integration: ({ data }: { data: any }) => {
      const Component = data.component;
      return <Component isConnected={data.isConnected} />;  // ← pasează prop
    },
    fold: ({ data }: { data: any }) => {
      const Component = data.component;
      return <Component connectedCount={data.connectedCount} />;
    },
  }), []); // ← useMemo cu [] ca să fie stabilă

  const [nodes, setNodes] = useState<Node[]>();
  const [edges, setEdges] = useState<Edge[]>();

  const onNodesChange = useCallback(
    //can i console log nds here to see the current nodes with their positions after dragging? --- yes, but be careful as it can log a lot of times during dragging
    (changes: NodeChange[]) => setNodes((nds: Node[]) => {
      const updatedNodes = applyNodeChanges(changes, nds);
      console.log("Current nodes after change:", updatedNodes);

      //await updateNodePosition();

      return updatedNodes;
    }),
    [],
  );

  const proOptions = { hideAttribution: true };

  return (
    <div className="w-full h-svh flex flex-col">
      {upgradeError && <p className="font-mono text-xs text-red-400 pb-4">{upgradeError}</p>}

      <div className="flex-1 min-h-0 w-full  rounded-xl ">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          proOptions={proOptions}
          nodeTypes={nodeTypes}
          fitView
        >

          <Controls />
        </ReactFlow>
      </div>

    </div>
  );
}
