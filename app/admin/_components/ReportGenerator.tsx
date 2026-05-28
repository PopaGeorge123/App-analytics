'use client';

import { useState } from 'react';

const COLD_DM_TEMPLATES = [
  {
    id: 1,
    name: 'Direct Value',
    template: (url: string, domain: string) => 
      `Hey! \n\nI noticed ${domain} and thought you might find this interesting.\n\nI created a quick analytics preview showing what your business metrics could look like on Fold Analytics:\n${url}\n\nFold is built specifically for founders like you — simple, affordable ($19/mo), and gives you the insights that actually matter.\n\nWould love to hear your thoughts!`
  },
  {
    id: 2,
    name: 'Problem-Focused',
    template: (url: string, domain: string) =>
      `Hi! I came across ${domain} and wanted to share something with you.\n\nMost analytics tools are either too expensive or too complicated. I built Fold to fix that.\n\nHere's a demo of what your metrics could look like:\n${url}\n\n$19/mo. No complexity. Just the metrics you need.\n\nInterested in taking a closer look?`
  },
  {
    id: 3,
    name: 'Founder-to-Founder',
    template: (url: string, domain: string) =>
      `Hey there! \n\nFellow founder here. Saw ${domain} and thought I'd reach out.\n\nI built Fold Analytics because I was frustrated with expensive, bloated analytics tools. Here's what your business could look like on our platform:\n${url}\n\nIt's $19/mo and specifically designed for solo founders and small teams.\n\nWant to chat about it?`
  },
  {
    id: 4,
    name: 'Curiosity Hook',
    template: (url: string, domain: string) =>
      `Quick question — are you tracking your key metrics effectively at ${domain}?\n\nI put together a preview of what comprehensive analytics could look like for your business:\n${url}\n\nThis is Fold Analytics — designed for businesses like yours. Simple, powerful, $19/mo.\n\nThoughts?`
  },
  {
    id: 5,
    name: 'Social Proof',
    template: (url: string, domain: string) =>
      `Hi! \n\nI help founders like you get better insights without the enterprise price tag.\n\nCheck out what ${domain}'s metrics could look like on Fold:\n${url}\n\nWe're already helping 100+ small businesses track what matters. $19/mo, no BS.\n\nWant to give it a try?`
  },
  {
    id: 6,
    name: 'Time-Saver',
    template: (url: string, domain: string) =>
      `Hey! Noticed ${domain} and thought this might be useful.\n\nI know analytics dashboards can be a time sink. That's why I built Fold — one view, all your important metrics.\n\nHere's a preview:\n${url}\n\n$19/mo and saves you hours every week.\n\nSound interesting?`
  },
  {
    id: 7,
    name: 'Feature Highlight',
    template: (url: string, domain: string) =>
      `Hi there!\n\nSaw ${domain} and created this for you:\n${url}\n\nThis is Fold Analytics — it connects Stripe, GA4, and Meta Ads in one beautiful dashboard. No more switching between 5 different tools.\n\n$19/mo. Built for indie hackers and small teams.\n\nWhat do you think?`
  },
  {
    id: 8,
    name: 'ROI-Focused',
    template: (url: string, domain: string) =>
      `Quick intro — I help businesses like ${domain} understand their metrics without spending $500+/mo on analytics.\n\nHere's what your data could look like:\n${url}\n\nFold gives you ROI tracking, conversion analytics, and revenue insights for just $19/mo.\n\nWorth a conversation?`
  },
  {
    id: 9,
    name: 'Pain Point',
    template: (url: string, domain: string) =>
      `Hey! \n\nAre you still logging into 3+ different platforms to see your ${domain} metrics?\n\nI built Fold to solve exactly this problem. Here's what it looks like:\n${url}\n\nAll your Stripe, Google Analytics, and ad data in one place. $19/mo.\n\nInterested?`
  },
  {
    id: 10,
    name: 'No-Pressure Ask',
    template: (url: string, domain: string) =>
      `Hi! I built Fold Analytics and thought it might be a good fit for ${domain}.\n\nNo sales pitch — just wanted to share this preview:\n${url}\n\nIt shows what unified analytics could look like for your business. $19/mo if you're interested.\n\nHappy to answer any questions!`
  },
  {
    id: 11,
    name: 'Competitor Comparison',
    template: (url: string, domain: string) =>
      `Hey! Checked out ${domain} — looks great!\n\nIf you're using expensive analytics tools, you might like this alternative:\n${url}\n\nFold does what Mixpanel/Amplitude do, but for $19/mo instead of $200+. Built for small teams.\n\nWant to learn more?`
  },
  {
    id: 12,
    name: 'Success Story',
    template: (url: string, domain: string) =>
      `Hi there! \n\nI help SaaS founders track metrics without breaking the bank.\n\nCreated this demo for ${domain}:\n${url}\n\nOur users save 10+ hours/month by having everything in one dashboard. $19/mo.\n\nCurious to learn more?`
  }
];

export default function ReportGenerator() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportUrl, setReportUrl] = useState('');
  const [domain, setDomain] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(COLD_DM_TEMPLATES[0]);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Update message whenever template or reportUrl changes
  const updateMessage = (template: typeof COLD_DM_TEMPLATES[0], url: string, domainName: string) => {
    if (url && domainName) {
      const message = template.template(url, domainName);
      setGeneratedMessage(message);
    }
  };

  const extractDomain = (inputUrl: string) => {
    try {
      const urlObj = new URL(inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return inputUrl;
    }
  };

  const generateReport = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setReportUrl('');
    setGeneratedMessage('');

    try {
      // Normalize URL - add https:// if missing
      const normalizedUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
      
      // Call the same API that /preview uses
      const response = await fetch('/api/preview/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({ url: normalizedUrl })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to analyze website');
      }

      const data = await response.json();
      const extractedDomain = data.domain || extractDomain(url);
      
      // Generate preview URL with domain parameter
      const baseUrl = "https://usefold.io";
      const previewUrl = `${baseUrl}/preview?d=${encodeURIComponent(extractedDomain)}`;
      
      setReportUrl(previewUrl);
      setDomain(extractedDomain);
      
      // Generate the cold DM with the preview link
      updateMessage(selectedTemplate, previewUrl, extractedDomain);
    } catch (error) {
      console.error('Error generating report:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold font-mono text-[#1a1a2e]">Report Generator & Cold DM</h2>
        <p className="text-sm text-[#6a6a90] font-mono mt-1">
          Generate a demo report and personalized outreach message
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side - Input & Report Link */}
        <div className="space-y-6">
          {/* URL Input */}
          <div className="space-y-3">
            <label className="block text-sm font-mono font-semibold text-[#1a1a2e]">
              Target Website URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="example.com or https://example.com"
                className="flex-1 px-4 py-2.5 border border-[#ccccec] rounded-lg font-mono text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#635bff] focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && generateReport()}
              />
              <button
                onClick={generateReport}
                disabled={loading || !url.trim()}
                className="px-6 py-2.5 bg-[#635bff] text-white font-mono text-sm rounded-lg
                         hover:bg-[#5147e5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Generating...
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Template Selector */}
          <div className="space-y-3">
            <label className="block text-sm font-mono font-semibold text-[#1a1a2e]">
              Message Template
            </label>
            <select
              value={selectedTemplate.id}
              onChange={(e) => {
                const template = COLD_DM_TEMPLATES.find(t => t.id === Number(e.target.value));
                if (template) {
                  setSelectedTemplate(template);
                  // Update message immediately if we already have a report URL
                  if (reportUrl && domain) {
                    updateMessage(template, reportUrl, domain);
                  }
                }
              }}
              className="w-full px-4 py-2.5 border border-[#ccccec] rounded-lg font-mono text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#635bff] focus:border-transparent"
            >
              {COLD_DM_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          {/* Generated Report Link */}
          {reportUrl && (
            <div className="space-y-3">
              <label className="block text-sm font-mono font-semibold text-[#1a1a2e]">
                Generated Report Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={reportUrl}
                  readOnly
                  className="flex-1 px-4 py-2.5 border border-[#ccccec] rounded-lg font-mono text-sm
                           bg-[#f4f4fa] text-[#6a6a90]"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(reportUrl);
                    alert('Link copied!');
                  }}
                  className="px-4 py-2.5 border border-[#ccccec] rounded-lg font-mono text-sm
                           hover:bg-[#f4f4fa] transition-colors"
                >
                  📋 Copy
                </button>
                <a
                  href={reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 border border-[#ccccec] rounded-lg font-mono text-sm
                           hover:bg-[#f4f4fa] transition-colors"
                >
                  👁️ Preview
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Right Side - Generated Cold DM */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-mono font-semibold text-[#1a1a2e]">
              Cold DM Message
            </label>
            {generatedMessage && (
              <button
                onClick={copyToClipboard}
                className={`px-4 py-1.5 rounded-lg font-mono text-sm transition-all
                          ${copied 
                            ? 'bg-green-500 text-white' 
                            : 'bg-[#635bff] text-white hover:bg-[#5147e5]'
                          }`}
              >
                {copied ? '✓ Copied!' : '📋 Copy Message'}
              </button>
            )}
          </div>
          
          <div className="relative">
            <textarea
              value={generatedMessage || 'Generate a report to see the message preview...'}
              readOnly
              rows={16}
              className="w-full px-4 py-3 border border-[#ccccec] rounded-lg font-mono text-sm
                       bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#635bff]"
            />
          </div>

          {generatedMessage && (
            <div className="bg-[#f4f4fa] border border-[#ccccec] rounded-lg p-4 space-y-2">
              <div className="text-xs font-mono font-semibold text-[#1a1a2e]">📊 Message Stats</div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[#6a6a90]">
                <div>Characters: {generatedMessage.length}</div>
                <div>Words: {generatedMessage.split(/\s+/).length}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template Preview */}
      <div className="border-t border-[#ccccec] pt-6 space-y-3">
        <h3 className="text-sm font-mono font-semibold text-[#1a1a2e]">
          Available Templates ({COLD_DM_TEMPLATES.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {COLD_DM_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => {
                setSelectedTemplate(template);
                // Update message immediately if we already have a report URL
                if (reportUrl && domain) {
                  updateMessage(template, reportUrl, domain);
                }
              }}
              className={`text-left p-3 rounded-lg border transition-all font-mono text-sm
                        ${selectedTemplate.id === template.id
                          ? 'border-[#635bff] bg-[#635bff]/5'
                          : 'border-[#ccccec] hover:border-[#635bff]/30 hover:bg-[#f4f4fa]'
                        }`}
            >
              <div className="font-semibold text-[#1a1a2e]">{template.name}</div>
              <div className="text-xs text-[#6a6a90] mt-1 line-clamp-2">
                {template.template('https://fold.app/report/demo', 'example.com').slice(0, 60)}...
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
