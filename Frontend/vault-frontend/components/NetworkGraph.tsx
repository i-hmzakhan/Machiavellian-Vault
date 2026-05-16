"use client";

import { useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export default function NetworkGraph({ graphData, onNodeClick }: { graphData: any, onNodeClick: (node: any) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  
  // Start at 0 so it doesn't render until it knows the exact screen size
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Dynamically measure the parent container (which is now absolute inset-0)
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(entries => {
      if (entries.length > 0) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Optional Polish: When the graph loads, gently zoom to fit all nodes
  const handleEngineStop = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 50); // 400ms duration, 50px padding
    }
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeLabel="name"
          nodeColor="color"
          nodeRelSize={6}
          linkColor={() => 'rgba(71, 85, 105, 0.4)'} // A subtle slate-600 color for the connecting lines
          backgroundColor="rgba(0,0,0,0)" // CRITICAL: Transparent background to let the UI shine through
          onNodeClick={onNodeClick}
          onEngineStop={handleEngineStop}
          // Enable a little bit of link directional particles for the "live radar" feel
          linkDirectionalParticles={1}
          linkDirectionalParticleWidth={1.5}
          linkDirectionalParticleSpeed={0.005}
        />
      )}
    </div>
  );
}