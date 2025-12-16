
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { KGEntity, KGRelation } from '../types';

interface GraphViewProps {
  nodes: KGEntity[];
  links: KGRelation[];
  filterType?: 'CHARACTER' | 'LOCATION' | 'VISUAL' | 'ALL';
  highlightedNodeIds?: Set<string>; // New prop for RAG visualization
}

interface NodePosition {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const COLORS: Record<string, string> = {
  CHARACTER: '#818cf8', // Indigo 400
  LOCATION: '#34d399',  // Emerald 400
  THEME: '#fbbf24',     // Amber 400
  STYLE: '#f472b6',     // Pink 400
  OBJECT: '#9ca3af',    // Gray 400
  LIGHTING: '#facc15',  // Yellow 400 (Bright)
  CAMERA: '#f87171',    // Red 400
};

const GraphView: React.FC<GraphViewProps> = ({ nodes, links, filterType = 'ALL', highlightedNodeIds }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [filteredNodes, setFilteredNodes] = useState<KGEntity[]>([]);
  const [filteredLinks, setFilteredLinks] = useState<KGRelation[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // 1. Filter Data
  useEffect(() => {
    let fNodes = nodes;
    if (filterType !== 'ALL') {
      if (filterType === 'VISUAL') {
        fNodes = nodes.filter(n => n.type === 'LIGHTING' || n.type === 'CAMERA' || n.type === 'STYLE');
      } else {
        fNodes = nodes.filter(n => n.type === filterType);
      }
    }
    
    const nodeIds = new Set(fNodes.map(n => n.id));
    const fLinks = links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

    setFilteredNodes(fNodes);
    setFilteredLinks(fLinks);
  }, [nodes, links, filterType]);

  // 2. Initialize & Simulate Layout
  useEffect(() => {
    if (filteredNodes.length === 0 || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    let currentPositions: Record<string, NodePosition> = { ...positions };
    
    filteredNodes.forEach(n => {
      if (!currentPositions[n.id]) {
        currentPositions[n.id] = {
          id: n.id,
          x: Math.random() * (width - 100) + 50,
          y: Math.random() * (height - 100) + 50,
          vx: 0,
          vy: 0
        };
      }
    });

    const validIds = new Set(filteredNodes.map(n => n.id));
    Object.keys(currentPositions).forEach(key => {
        if (!validIds.has(key)) delete currentPositions[key];
    });

    const k = 120;
    const damping = 0.85;
    const centerPull = 0.04;
    const linkStrength = 0.08;
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const forces: Record<string, { fx: number; fy: number }> = {};
      Object.keys(currentPositions).forEach(id => (forces[id] = { fx: 0, fy: 0 }));

      // Repulsion
      const ids = Object.keys(currentPositions);
      for (let a = 0; a < ids.length; a++) {
        for (let b = a + 1; b < ids.length; b++) {
          const u = currentPositions[ids[a]];
          const v = currentPositions[ids[b]];
          const dx = v.x - u.x;
          const dy = v.y - u.y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);
          
          if (dist < 400) {
             const f = (k * k) / distSq;
             const fx = (dx / dist) * f;
             const fy = (dy / dist) * f;
             forces[u.id].fx -= fx;
             forces[u.id].fy -= fy;
             forces[v.id].fx += fx;
             forces[v.id].fy += fy;
          }
        }
      }

      // Attraction
      filteredLinks.forEach(link => {
        const u = currentPositions[link.source];
        const v = currentPositions[link.target];
        if (u && v) {
          const dx = v.x - u.x;
          const dy = v.y - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = (dist - 120) * linkStrength;
          const fx = (dx / dist) * f;
          const fy = (dy / dist) * f;

          forces[u.id].fx += fx;
          forces[u.id].fy += fy;
          forces[v.id].fx -= fx;
          forces[v.id].fy -= fy;
        }
      });

      // Update
      ids.forEach(id => {
        const p = currentPositions[id];
        const f = forces[id];
        f.fx += (width / 2 - p.x) * centerPull;
        f.fy += (height / 2 - p.y) * centerPull;
        p.vx = (p.vx + f.fx) * damping;
        p.vy = (p.vy + f.fy) * damping;
        p.x += p.vx;
        p.y += p.vy;
        p.x = Math.max(30, Math.min(width - 30, p.x));
        p.y = Math.max(30, Math.min(height - 30, p.y));
      });
    }

    setPositions(currentPositions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredNodes, filteredLinks]);

  // 3. Drag Handlers
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDraggingId(id);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingId && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      setPositions(prev => ({
        ...prev,
        [draggingId]: { 
            ...prev[draggingId], 
            x: Math.max(20, Math.min(rect.width - 20, x)), 
            y: Math.max(20, Math.min(rect.height - 20, y)), 
            vx: 0, 
            vy: 0 
        }
      }));
    }
  }, [draggingId]);

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  useEffect(() => {
    if (draggingId) {
        window.addEventListener('mouseup', handleMouseUp);
    } else {
        window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [draggingId]);

  // --- Helper: Check Opacity for RAG Visualization ---
  const getOpacity = (id: string, isNode: boolean = true) => {
    // If no retrieval active, everything is fully visible
    if (!highlightedNodeIds || highlightedNodeIds.size === 0) return 1;
    // If retrieval active, highlight match, dim others
    return highlightedNodeIds.has(id) ? 1 : 0.1;
  };

  const getLinkOpacity = (source: string, target: string) => {
    if (!highlightedNodeIds || highlightedNodeIds.size === 0) return 0.6;
    // Highlight links only if both ends are relevant
    return (highlightedNodeIds.has(source) && highlightedNodeIds.has(target)) ? 1 : 0.05;
  };

  const getLinkColor = (source: string, target: string) => {
     if (highlightedNodeIds && highlightedNodeIds.size > 0 && highlightedNodeIds.has(source) && highlightedNodeIds.has(target)) {
        return "#60a5fa"; // Bright blue for active retrieval path
     }
     return "#4b5563"; // Default gray
  };

  if (filteredNodes.length === 0) {
     return (
        <div className="flex items-center justify-center h-full text-gray-500">
           <p>暂无相关类型的知识数据</p>
        </div>
     );
  }

  return (
    <div 
        className="relative w-full h-full bg-gray-950/50 rounded-lg overflow-hidden border border-gray-800 select-none" 
        ref={containerRef}
        onMouseMove={handleMouseMove}
    >
       {/* Links Layer */}
       <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="22" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#4b5563" opacity="0.6"/>
            </marker>
             <marker id="arrowhead-active" markerWidth="10" markerHeight="7" refX="22" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#60a5fa" opacity="1"/>
            </marker>
          </defs>
          {filteredLinks.map((link, i) => {
             const u = positions[link.source];
             const v = positions[link.target];
             if (!u || !v) return null;
             
             const opacity = getLinkOpacity(link.source, link.target);
             const stroke = getLinkColor(link.source, link.target);
             const marker = opacity === 1 ? "url(#arrowhead-active)" : "url(#arrowhead)";

             return (
               <g key={`${link.source}-${link.target}-${i}`} style={{opacity, transition: 'opacity 0.3s'}}>
                 <line 
                   x1={u.x} y1={u.y} x2={v.x} y2={v.y} 
                   stroke={stroke} strokeWidth={opacity === 1 ? 2 : 1.5} 
                   markerEnd={marker}
                 />
                 <text 
                   x={(u.x + v.x) / 2} y={(u.y + v.y) / 2} 
                   fill={opacity === 1 ? "#fff" : "#9ca3af"} 
                   fontSize="10" textAnchor="middle" dy="-5"
                   className="bg-gray-900/80 px-1"
                 >
                   {link.label}
                 </text>
               </g>
             );
          })}
       </svg>

       {/* Nodes Layer */}
       {filteredNodes.map(node => {
          const pos = positions[node.id];
          if (!pos) return null;
          const opacity = getOpacity(node.id);
          const isHighlighted = opacity === 1 && highlightedNodeIds && highlightedNodeIds.size > 0;

          return (
             <div 
               key={node.id}
               className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-grab active:cursor-grabbing 
                          ${draggingId === node.id ? 'z-50 scale-110' : 'z-10'}
                          ${isHighlighted ? 'scale-110 z-40' : ''}`}
               style={{ left: pos.x, top: pos.y, opacity, transition: 'opacity 0.3s, transform 0.2s' }}
               onMouseDown={(e) => handleMouseDown(e, node.id)}
             >
                <div 
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-lg transition-all bg-gray-900 ${isHighlighted ? 'ring-2 ring-white shadow-blue-500/50' : ''}`}
                  style={{ borderColor: COLORS[node.type] || '#fff' }}
                >
                   <span className="text-[10px] font-bold" style={{color: COLORS[node.type]}}>
                     {node.label.slice(0, 2)}
                   </span>
                </div>
                <span className={`mt-1 text-xs px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm border border-gray-800 ${isHighlighted ? 'bg-indigo-600 text-white font-bold' : 'bg-gray-900/80 text-gray-300'}`}>
                  {node.label}
                </span>
             </div>
          );
       })}
    </div>
  );
};

export default GraphView;
