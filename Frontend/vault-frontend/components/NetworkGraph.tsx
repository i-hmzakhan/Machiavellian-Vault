"use client";

import { useEffect, useState, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

interface NetworkGraphProps {
  graphData: { nodes: any[]; links: any[] };
  onNodeClick: (node: any) => void;
}

export default function NetworkGraph({ graphData, onNodeClick }: NetworkGraphProps) {
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>();

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({ 
          width: containerRef.current.clientWidth, 
          height: containerRef.current.clientHeight 
        });
      }
    };
    
    window.addEventListener('resize', updateDimensions);
    setTimeout(updateDimensions, 50); 
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Physics Tweak: Pushes nodes apart so they don't cluster
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      fgRef.current.d3Force('charge').strength(-500);
      fgRef.current.d3Force('link').distance(150);
    }
  }, [graphData]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel="name"
        nodeColor={(node: any) => node.color || "#4f46e5"}
        linkColor={() => "#334155"} 
        backgroundColor="#020617"   
        onNodeClick={onNodeClick}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        nodeRelSize={6}
      />
    </div>
  );
}