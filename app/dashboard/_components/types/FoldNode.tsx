"use client";

import { useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';



export default function FoldNode(props: any) {
    const onChange = useCallback((evt: React.ChangeEvent<HTMLInputElement>) => {
      console.log(evt.target.value);
    }, []);
  
    return (
      <div className=" bg-green-400 rounded-lg p-4 w-48">
        <div>
          <label htmlFor="text">Text:</label>
          <input id="text" name="text" onChange={onChange} className="nodrag border w-full" />
        </div>
         <Handle type="source" position={Position.Bottom} />
         <Handle type="target" position={Position.Top} />
      </div>
    );
  }