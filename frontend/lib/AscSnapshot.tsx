'use client';

import { useEffect, useRef, useState } from 'react';
import { parseAsc, renderToCanvas, generateMockGrid } from './AscViewer';

interface AscSnapshotProps {
  step: number;
  url?: string;
  label?: string;
}

export default function AscSnapshot({ step, url, label }: AscSnapshotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(!!url);

  useEffect(() => {
    if (!url) {
      if (canvasRef.current) renderToCanvas(canvasRef.current, generateMockGrid(step));
      return;
    }
    setLoading(true);
    fetch(url)
      .then(r => r.text())
      .then(text => {
        if (canvasRef.current) renderToCanvas(canvasRef.current, parseAsc(text));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [url, step]);

  return (
    <div className="relative bg-gray-950 rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        width={525}
        height={625}
        className="w-full"
        style={{ imageRendering: 'pixelated', display: 'block', height: 'auto' }}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80">
          <svg className="animate-spin w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      )}
      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold px-2 py-0.5 rounded">
        {label ?? `T+${step}분`}
      </div>
    </div>
  );
}
