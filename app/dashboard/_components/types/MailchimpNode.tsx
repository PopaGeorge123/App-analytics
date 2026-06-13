"use client";

import { useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';



export default function MailchimpNode({ isConnected = false }: { isConnected?: boolean }) {
    const onChange = useCallback((evt: React.ChangeEvent<HTMLInputElement>) => {
      console.log(evt.target.value);
    }, []);
  
    return (
    <div style={{ width: 220, fontFamily: 'sans-serif' }}
      className="border border-[#ebd914] rounded-2xl bg-white overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-lg bg-[#F4F6F0] flex items-center justify-center">
            <img src="/integrations/mailchimp.svg" alt="Mailchimp" className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 m-0">Mailchimp</p>
            <span className="text-[11px] bg-green-50 text-green-700 px-2 py-0.5 rounded font-medium">
              Not connected
            </span>
          </div>
        </div>
        <p className="text-[12px] text-gray-500 leading-relaxed m-0">
          Sync your Mailchimp data to track email marketing performance, customer engagement, and conversion metrics in real time.
        </p>
      </div>

      {/* Features */}
      {/* <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">
          What you'll get
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { icon: "📈", label: "Real-time traffic data" },
            { icon: "👥", label: "User behavior insights" },
            { icon: "🎯", label: "Conversion tracking" },
            { icon: "🔄", label: "Automated data sync" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-[12px] text-gray-500">
              <span>{icon}</span> {label}
            </div>
          ))}
        </div>
      </div> */}

      {/* CTA */}
      <div className="p-3">
        <button className="w-full py-2 bg-[#ebd914] text-white text-[13px] font-medium rounded-lg">
          {isConnected ? "Disconnect Mailchimp" : "Connect Mailchimp"}
        </button>
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
  }