"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

// Map node colors to their glowing hex equivalents
const GLOW_COLORS: { [key: string]: string } = {
  "#ef4444": "#ff8888", // Red -> Pink-ish glow
  "#f97316": "#ffbb88", // Orange -> Amber glow
  "#4f46e5": "#88aaff", // Indigo -> Light blue glow
  "#10b981": "#88ffd0", // Emerald -> Aqua glow
};

export default function NetworkGraph({ graphData, onNodeClick }: { graphData: any, onNodeClick: (node: any) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // 1. Dynamic Resize Observer
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

  // 2. Optimized Physics Engine
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (fgRef.current && dimensions.width > 0) {
        // Increase repulsion, extend link distance, and decrease overall gravity
        fgRef.current.d3Force('charge').strength(-900); 
        fgRef.current.d3Force('link').distance(200); 
        fgRef.current.d3Force('center').strength(0.04);
        
        fgRef.current.d3ReheatSimulation();
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [dimensions]);

  const handleEngineStop = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(600, 75); // Slower, wider fit for better visual clarity
    }
  }, []);

  // 3. Custom Node Render with Dynamic Glow
  // 3. Custom Node Render with Dynamic Glow and Initials
  const renderGlowNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const baseColor = node.color || '#4f46e5'; 
    const glowColor = GLOW_COLORS[baseColor] || '#88aaff'; 

    // Scale node size based on threat score, with a minimum size
    const baseRadius = 10; // Slightly increased base radius to fit text better
    const threatFactor = node.threatScore ? Math.log2(node.threatScore + 1) * 1.5 : 0;
    const radius = Math.max(baseRadius + threatFactor, 6) / Math.sqrt(globalScale); 
    
    // Intensity scales with net shift
    const netShift = node.leverageDelta || 0;
    const pulseFactor = 1 + Math.max(Math.abs(netShift) / 10, 0) * (0.3 * Math.sin(Date.now() / 300));
    const glowRadius = Math.max(radius * 1.8, 10) * pulseFactor;

    ctx.save();
    
    // Draw the glow first (Shadow)
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = Math.max(glowRadius, 5); 
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius * 0.9, 0, 2 * Math.PI, false); 
    ctx.fillStyle = 'rgba(0, 0, 0, 0)'; 
    ctx.fill();

    // Reset shadow blur so the text and main circle don't look blurry
    ctx.shadowBlur = 0;

    // Draw the main node circle (Solid)
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = baseColor;
    ctx.fill();

    // --- NEW: EXTRACT AND DRAW INITIALS ---
    const name = node.name || "?";
    const words = name.trim().split(/\s+/);
    let initials = words[0].substring(0, 1).toUpperCase();
    
    // If they have two names (e.g., "John Doe"), grab "JD"
    if (words.length > 1) {
        initials += words[words.length - 1].substring(0, 1).toUpperCase();
    } 
    // If one name (e.g., "Alexander"), grab "AL"
    else if (name.length > 1) {
        initials = name.substring(0, 2).toUpperCase();
    }

    // Set font properties relative to the node radius
    const fontSize = radius * 0.85; 
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff'; // Crisp white text
    ctx.fillText(initials, node.x, node.y);
    // --------------------------------------
    
    // Highlight active nodes dynamically
    if(node.active) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
    }

    ctx.restore();
  }, []);

  // 4. Component Output
  return (
    <div ref={containerRef} className="w-full h-full relative">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeLabel="name"
          nodeColor="color"
          
          // Apply custom glow renderer
          nodeCanvasObject={renderGlowNode}
          nodePointerAreaPaint={(node, color, ctx) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI, false); ctx.fill(); }} // Fixed interaction area

          // Polish visual links with slowparticles
          linkColor={() => 'rgba(110, 110, 150, 0.25)'} // Subtle indigo link color
          linkWidth={1.25}
          linkDirectionalParticles={1.5}
          linkDirectionalParticleWidth={1.5}
          linkDirectionalParticleSpeed={0.004}

          // Optimized visualization settings
          backgroundColor="rgba(0,0,0,0)" // Fully transparent to let UI shine through
          onNodeClick={onNodeClick}
          onEngineStop={handleEngineStop}
          d3VelocityDecay={0.2} // Smoother, slightly more resistant simulation movement
        />
      )}
    </div>
  );
}