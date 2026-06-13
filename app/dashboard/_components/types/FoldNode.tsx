"use client";

import { useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';





export default function FoldNode({ data }: { data?: { connectedCount?: number } }) {
  //const count = data?.connectedCount ?? 0;
  const count = 5;

  return (
    <div className="w-[270px] h-[270px] border border-[#7C5CE8]/30 rounded-2xl bg-white overflow-hidden">
      {/* accent bar */}
      <div className="h-[3px] bg-gradient-to-r from-[#00D4AA] to-[#00FFA3]" />

      {/* header */}
      <div className="px-3.5 border-b border-gray-100">
        <div className="flex items-center">
          <img src="/fold-mono-teal.svg" alt="Fold" className="w-20 h-20" />
        </div>
      </div>

      {/* body */}
      <div className="px-3.5 py-2.5">
        <p className="text-[11px] text-gray-400 leading-relaxed mb-2.5">
          Processes and unifies data from all connected integrations.
        </p>
        <div className="flex flex-col gap-1">
          {["Merge streams", "Normalize schema", "Power insights"].map((f) => (
            <div key={f} className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <div className="w-1.5 h-1.5 rounded-full bg-[#6C47FF]" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* status */}
      <div className="mx-3.5 mb-3 px-2.5 py-1.5 bg-[#F3F0FF] rounded-lg flex items-center justify-between">
        <span className="text-[11px] text-[#6C47FF] font-medium">{count} sources connected</span>
        <div className={`w-2 h-2 rounded-full ${count > 0 ? "bg-[#6C47FF]" : "bg-[#A78BFA]"}`} />
      </div>

      {/* handles — spaced evenly on left */}
      {[1,2,3,4,5,6,7].map((i) => (
        <Handle
          key={i}
          type="target"
          position={Position.Left}
          id={`input${i}`}
          style={{ top: `${(i / 8) * 100}%` }}
        />
      ))}
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  );
}