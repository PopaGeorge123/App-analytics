'use client';

import { useEffect, useState } from 'react';
import { 
  EnvelopeIcon, 
  EnvelopeOpenIcon, 
  CursorArrowRaysIcon, 
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  SparklesIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

interface CampaignStats {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  openRate: number;
  clickRate: number;
  clickToOpenRate: number;
  replyRate: number;
}

interface TemplateStats {
  id: string;
  name: string;
  number: number;
  subject: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  conversionRate: number;
  performanceScore: number;
  isActive: boolean;
  lastUsed: string | null;
}

interface DailyTrend {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  openRate: string;
  clickRate: string;
}

interface Insights {
  bestTemplate: {
    name: string;
    score: number;
    openRate: number;
    clickRate: number;
  } | null;
  worstTemplate: {
    name: string;
    score: number;
    openRate: number;
    clickRate: number;
  } | null;
  recommendation: string;
}

interface CampaignData {
  campaign: CampaignStats;
  templates: TemplateStats[];
  trends: {
    daily: DailyTrend[];
    last30Days: {
      sent: number;
      opened: number;
      clicked: number;
    };
  };
  insights: Insights;
}

export default function EmailCampaignTab() {
  const [data, setData] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaignStats();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchCampaignStats, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchCampaignStats() {
    try {
      const response = await fetch('/api/admin/email-campaign-stats', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch campaign stats');
      }

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch campaign stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d4aa] mb-4"></div>
          <p className="text-sm text-[#6a6a90] font-mono">Loading campaign stats...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl">
        <p className="text-red-700 text-sm">❌ Error: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 bg-[#f8f8fc] border border-[#d4d4e8] rounded-2xl">
        <p className="text-[#6a6a90] text-sm">No campaign data available</p>
      </div>
    );
  }

  const { campaign, templates, insights } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold font-mono text-[#1a1a2e] mb-2">Email Campaign Analytics</h2>
        <p className="text-sm text-[#6a6a90]">Track performance and optimize your outbound email campaigns</p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<EnvelopeIcon className="w-6 h-6" />}
          label="Emails Sent"
          value={campaign.totalSent}
          color="blue"
        />
        <StatCard
          icon={<EnvelopeOpenIcon className="w-6 h-6" />}
          label="Opened"
          value={campaign.totalOpened}
          percentage={campaign.openRate}
          color="green"
        />
        <StatCard
          icon={<CursorArrowRaysIcon className="w-6 h-6" />}
          label="Clicked"
          value={campaign.totalClicked}
          percentage={campaign.clickRate}
          color="teal"
        />
        <StatCard
          icon={<ChatBubbleLeftRightIcon className="w-6 h-6" />}
          label="Replied"
          value={campaign.totalReplied}
          percentage={campaign.replyRate}
          color="cyan"
        />
      </div>

      {/* Advanced Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white ring-1 ring-black/[0.04] rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
          <h3 className="text-lg font-semibold font-mono text-[#1a1a2e] mb-4 flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-[#00d4aa]" />
            Conversion Funnel
          </h3>
          <div className="space-y-3">
            <FunnelStep label="Emails Sent" value={campaign.totalSent} percentage={100} />
            <FunnelStep 
              label="Opened" 
              value={campaign.totalOpened} 
              percentage={campaign.openRate} 
            />
            <FunnelStep 
              label="Clicked (from opens)" 
              value={campaign.totalClicked} 
              percentage={campaign.clickToOpenRate} 
            />
            <FunnelStep 
              label="Replied" 
              value={campaign.totalReplied} 
              percentage={campaign.replyRate} 
            />
          </div>
        </div>

        {/* AI Insights */}
        <div className="bg-linear-to-br from-[#00d4aa]/5 to-[#00d4aa]/10 ring-1 ring-[#00d4aa]/20 rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
          <h3 className="text-lg font-semibold font-mono text-[#1a1a2e] mb-4 flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-[#00d4aa]" />
            AI Insights & Recommendations
          </h3>
          <div className="space-y-4">
            {insights.bestTemplate && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircleIcon className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-700">Best Performer</p>
                    <p className="text-[#1a1a2e] font-semibold">{insights.bestTemplate.name}</p>
                    <p className="text-xs text-[#6a6a90] mt-1">
                      {insights.bestTemplate.openRate.toFixed(1)}% open · {insights.bestTemplate.clickRate.toFixed(1)}% click
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {insights.worstTemplate && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <XCircleIcon className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-700">Needs Improvement</p>
                    <p className="text-[#1a1a2e] font-semibold">{insights.worstTemplate.name}</p>
                    <p className="text-xs text-[#6a6a90] mt-1">
                      {insights.worstTemplate.openRate.toFixed(1)}% open · {insights.worstTemplate.clickRate.toFixed(1)}% click
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-[#00d4aa]/10 border border-[#00d4aa]/30 rounded-lg p-4">
              <p className="text-sm text-[#1a1a2e]">{insights.recommendation}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Template Performance Table */}
      <div className="bg-white ring-1 ring-black/[0.04] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
        <div className="p-6 border-b border-[#d4d4e8]">
          <h3 className="text-lg font-semibold font-mono text-[#1a1a2e]">Template Performance</h3>
          <p className="text-sm text-[#6a6a90] mt-1">
            Sorted by performance score (weighted: 30% open rate, 40% click rate, 30% reply rate)
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#f8f8fc]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium font-mono text-[#6a6a90] uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium font-mono text-[#6a6a90] uppercase tracking-wider">
                  Template
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium font-mono text-[#6a6a90] uppercase tracking-wider">
                  Subject Line
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium font-mono text-[#6a6a90] uppercase tracking-wider">
                  Sent
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium font-mono text-[#6a6a90] uppercase tracking-wider">
                  Open %
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium font-mono text-[#6a6a90] uppercase tracking-wider">
                  Click %
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium font-mono text-[#6a6a90] uppercase tracking-wider">
                  Reply %
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium font-mono text-[#6a6a90] uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium font-mono text-[#6a6a90] uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d4d4e8]">
              {templates.map((template, idx) => (
                <tr 
                  key={template.id}
                  className={idx < 3 ? 'bg-green-50/50' : idx >= templates.length - 2 ? 'bg-red-50/50' : 'bg-white'}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-[#6a6a90]">
                    {template.number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium font-mono text-[#1a1a2e]">{template.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-[#4a4a6a] max-w-xs truncate">
                      {template.subject}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-mono text-[#1a1a2e]">
                    {template.sent}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <PercentBadge value={template.openRate} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <PercentBadge value={template.clickRate} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <PercentBadge value={template.replyRate} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <ScoreBadge score={template.performanceScore} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <StatusBadge active={template.isActive} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Helper Components

function StatCard({ 
  icon, 
  label, 
  value, 
  percentage, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number; 
  percentage?: number;
  color: 'blue' | 'green' | 'teal' | 'cyan';
}) {
  const colors = {
    blue: 'from-blue-50 to-blue-100/50 ring-blue-200/50 text-blue-600',
    green: 'from-green-50 to-green-100/50 ring-green-200/50 text-green-600',
    teal: 'from-[#00d4aa]/5 to-[#00d4aa]/10 ring-[#00d4aa]/20 text-[#00d4aa]',
    cyan: 'from-cyan-50 to-cyan-100/50 ring-cyan-200/50 text-cyan-600',
  };

  return (
    <div className={`bg-linear-to-br ${colors[color]} ring-1 rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.05)]`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`${colors[color].split(' ')[2]}`}>{icon}</div>
        <p className="text-sm font-mono text-[#6a6a90]">{label}</p>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold font-mono text-[#1a1a2e]">{value.toLocaleString()}</p>
        {percentage !== undefined && (
          <p className="text-lg font-mono text-[#6a6a90]">({percentage.toFixed(1)}%)</p>
        )}
      </div>
    </div>
  );
}

function FunnelStep({ label, value, percentage }: { label: string; value: number; percentage: number }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-[#4a4a6a]">{label}</span>
        <span className="text-sm font-semibold font-mono text-[#1a1a2e]">{value} ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="w-full bg-[#f0f0f8] rounded-full h-2">
        <div 
          className="bg-linear-to-r from-[#00d4aa] to-[#00bfa0] h-2 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

function PercentBadge({ value }: { value: number }) {
  const color = value >= 30 ? 'text-green-600 font-semibold' : value >= 15 ? 'text-yellow-600 font-medium' : 'text-[#6a6a90]';
  return <span className={`text-sm font-mono ${color}`}>{value.toFixed(1)}%</span>;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 40 
    ? 'bg-green-100 text-green-700 ring-1 ring-green-200' 
    : score >= 20 
    ? 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200' 
    : 'bg-gray-100 text-[#6a6a90] ring-1 ring-gray-200';
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold font-mono ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold font-mono ${
      active 
        ? 'bg-green-100 text-green-700 ring-1 ring-green-200' 
        : 'bg-gray-100 text-[#6a6a90] ring-1 ring-gray-200'
    }`}>
      {active ? 'Active' : 'Paused'}
    </span>
  );
}
