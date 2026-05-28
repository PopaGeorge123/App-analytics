'use client';

import { useState } from 'react';
import ReportGenerator from './ReportGenerator';

type Tab = 'reports' | 'prospects' | 'analytics' | 'settings';

export default function AdminTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('reports');

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'reports', label: 'Report Generator', icon: '📊' },
    { id: 'prospects', label: 'Prospect Management', icon: '👥' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-[#ccccec] bg-white rounded-t-xl">
        <div className="flex gap-1 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono text-sm
                transition-all duration-200
                ${activeTab === tab.id
                  ? 'bg-[#635bff] text-white shadow-sm'
                  : 'text-[#6a6a90] hover:bg-[#f4f4fa] hover:text-[#1a1a2e]'
                }
              `}
            >
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-b-xl shadow-sm border border-[#ccccec] p-6">
        {activeTab === 'reports' && <ReportGenerator />}
        {activeTab === 'prospects' && <ProspectManagementTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

function ProspectManagementTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold font-mono text-[#1a1a2e]">Prospect Management</h2>
      <p className="text-sm text-[#6a6a90] font-mono">Manage your outbound prospects here.</p>
      <div className="text-center py-12 text-[#6a6a90] font-mono">
        Coming soon...
      </div>
    </div>
  );
}

function AnalyticsTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold font-mono text-[#1a1a2e]">Analytics</h2>
      <p className="text-sm text-[#6a6a90] font-mono">View detailed analytics and metrics.</p>
      <div className="text-center py-12 text-[#6a6a90] font-mono">
        Coming soon...
      </div>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold font-mono text-[#1a1a2e]">Settings</h2>
      <p className="text-sm text-[#6a6a90] font-mono">Configure your admin preferences.</p>
      <div className="text-center py-12 text-[#6a6a90] font-mono">
        Coming soon...
      </div>
    </div>
  );
}
