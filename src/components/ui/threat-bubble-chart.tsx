import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  forceSimulation,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
} from "d3-force";
import { scaleSqrt, scaleOrdinal } from "d3-scale";
import type { AttackType, Exploit } from "../../data";

interface BubbleNode extends SimulationNodeDatum {
  id: string;
  name: string;
  category: string;
  count: number;
  loss: number; // in millions
  radius: number;
  color: string;
  spawnTick: number; // tick on which this bubble becomes physically active
}

interface ThreatBubbleChartProps {
  attackTypes: AttackType[];
  exploits: Exploit[];
}

function parseLossM(s: string | null): number {
  if (!s) return 0;
  const num = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return 0;
  if (s.includes("B")) return num * 1000;
  if (s.includes("K")) return num / 1000;
  return num;
}

const CATEGORY_PALETTE = [
  "#f87171", // red
  "#fb923c", // orange
  "#facc15", // yellow
  "#4ade80", // green
  "#22d3ee", // cyan
  "#60a5fa", // blue
  "#a78bfa", // violet
  "#f472b6", // pink
  "#34d399", // emerald
  "#fbbf24", // amber
];

export function ThreatBubbleChart({
  attackTypes,
  exploits,
}: ThreatBubbleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<Simulation<BubbleNode, undefined> | null>(null);
  const draggingRef = useRef<{
    id: string;
    pointerId: number;
    lastX: number;
    lastY: number;
    lastT: number;
    vx: number;
    vy: number;
  } | null>(null);
  const [size, setSize] = useState({ w: 800, h: 480 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const nodesRef = useRef<BubbleNode[]>([]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({ w: Math.max(320, rect.width), h: Math.max(360, Math.min(560, rect.width * 0.55)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build aggregated nodes
  const { nodes, categories, maxLoss } = useMemo(() => {
    const agg = new Map<string, { count: number; loss: number; type: AttackType }>();
    for (const t of attackTypes) {
      agg.set(t.id, { count: 0, loss: 0, type: t });
    }
    for (const e of exploits) {
      const a = agg.get(e.attack_type);
      if (!a) continue;
      a.count += 1;
      a.loss += parseLossM(e.loss_amount);
    }
    const cats = Array.from(new Set(attackTypes.map((t) => t.category))).sort();
    const colorScale = scaleOrdinal<string, string>().domain(cats).range(CATEGORY_PALETTE);

    const arr: { id: string; name: string; category: string; count: number; loss: number; color: string }[] = [];
    let max = 0;
    agg.forEach((v, id) => {
      if (v.count === 0 && v.loss === 0) return;
      max = Math.max(max, v.loss);
      arr.push({
        id,
        name: v.type.name,
        category: v.type.category,
        count: v.count,
        loss: v.loss,
        color: colorScale(v.type.category),
      });
    });
    return { nodes: arr, categories: cats.map((c) => ({ name: c, color: colorScale(c) })), maxLoss: max };
  }, [attackTypes, exploits]);

  // Run simulation when nodes/size change
  useEffect(() => {
    if (nodes.length === 0) return;
    const { w, h } = size;
    const minR = Math.min(w, h) * 0.035;
    const maxR = Math.min(w, h) * 0.14;
    const rScale = scaleSqrt().domain([0, Math.max(maxLoss, 1)]).range([minR, maxR]);

    // Bubble entrance: each bubble fades in from a single point near the top of the canvas,
    // staggered in time. Off-stage bubbles are parked far away until their spawnTick.
    const spawnX = w / 2;
    const spawnY = Math.min(w, h) * 0.15; // near the top, inside the canvas
    const STAGGER = 6; // ticks between spawns (~100ms at 60fps)
    // Shuffle spawn order so big and small bubbles arrive interleaved.
    const order = nodes.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const spawnByIndex = new Map<number, number>();
    order.forEach((idx, dropPos) => spawnByIndex.set(idx, dropPos * STAGGER));

    const OFFSCREEN_Y = Math.max(w, h) * 4;

    const simNodes: BubbleNode[] = nodes.map((n, i) => {
      const r = Math.max(minR, rScale(n.loss));
      const spawn = spawnByIndex.get(i) ?? 0;
      return {
        ...n,
        radius: r,
        spawnTick: spawn,
        // Park far below the canvas; stay frozen until spawnTick.
        x: spawnX,
        y: OFFSCREEN_Y + i,
        vx: 0,
        vy: 0,
      };
    });
    nodesRef.current = simNodes;

    let tickCount = 0;

    // Physics tuning — pure float feel:
    // no gravity, no buoyancy. Bubbles drift gently in place with light random nudges.
    // Larger bubbles drift more slowly than small ones.
    const DRIFT = 0.04;          // base random impulse per tick (px/frame^2)
    const BASE_DRAG = 0.94;      // drag pulls velocity back toward 0 each tick
    const RESTITUTION = 0.4;     // soft bounce off all edges

    // Per-bubble "mass" derived from radius. minR -> 1 (lightest), maxR -> ~3.5 (heaviest).
    const massOf = (r: number) => 1 + Math.pow((r - minR) / Math.max(1, maxR - minR), 1.4) * 2.5;

    const sim = forceSimulation<BubbleNode>(simNodes)
      .force("collide", forceCollide<BubbleNode>().radius((d) => d.radius + 1.5).strength(0.95).iterations(3))
      .alpha(1)
      .alphaDecay(0)
      .alphaMin(-1)
      .velocityDecay(0.05)
      .on("tick", () => {
        tickCount++;
        for (const n of simNodes) {
          // Activate this bubble at its spawn tick: place it at the spawn point with a
          // gentle random push so it disperses from the spawn point.
          if (n.spawnTick === tickCount) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 / massOf(n.radius);
            n.x = spawnX + (Math.random() - 0.5) * 8;
            n.y = spawnY + (Math.random() - 0.5) * 8;
            n.vx = Math.cos(angle) * speed;
            n.vy = Math.sin(angle) * speed;
          }
          if (tickCount < n.spawnTick) continue;
          if (n.fx != null || n.fy != null) continue;

          const r = n.radius;
          const mass = massOf(r);

          // Random Brownian-ish drift — heavier bubbles get smaller nudges.
          const drift = DRIFT / mass;
          n.vx = (n.vx ?? 0) + (Math.random() - 0.5) * drift;
          n.vy = (n.vy ?? 0) + (Math.random() - 0.5) * drift;

          // Drag — heavier bubbles drag a bit more.
          const drag = BASE_DRAG - (mass - 1) * 0.01;
          n.vx = n.vx * drag;
          n.vy = n.vy * drag;

          // Soft bounces on all edges
          if (n.y! - r < 0) {
            n.y = r;
            if (n.vy! < 0) n.vy = -n.vy! * RESTITUTION;
          }
          if (n.y! + r > h) {
            n.y = h - r;
            if (n.vy! > 0) n.vy = -n.vy! * RESTITUTION;
          }
          if (n.x! - r < 0) {
            n.x = r;
            if (n.vx! < 0) n.vx = -n.vx! * RESTITUTION;
          }
          if (n.x! + r > w) {
            n.x = w - r;
            if (n.vx! > 0) n.vx = -n.vx! * RESTITUTION;
          }
        }
        setTick((t) => t + 1);
      });

    simRef.current = sim;
    return () => {
      sim.stop();
      simRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, size.w, size.h, maxLoss]);

  // Tooltip helper
  const hovered = hoverId ? nodesRef.current.find((n) => n.id === hoverId) : null;

  // --- Drag interaction --------------------------------------------------
  const getSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onPointerDownNode = (e: React.PointerEvent<SVGGElement>, id: string) => {
    const node = nodesRef.current.find((n) => n.id === id);
    const sim = simRef.current;
    if (!node || !sim) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    draggingRef.current = { id, pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY, lastT: performance.now(), vx: 0, vy: 0 };
    setDraggingId(id);
    sim.alphaTarget(0.3).restart();
    const { x, y } = getSvgPoint(e.clientX, e.clientY);
    node.fx = x;
    node.fy = y;
  };

  const onPointerMoveNode = (e: React.PointerEvent<SVGGElement>) => {
    const drag = draggingRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const node = nodesRef.current.find((n) => n.id === drag.id);
    if (!node) return;
    const { x, y } = getSvgPoint(e.clientX, e.clientY);
    // Track instantaneous pointer velocity for throw-on-release.
    const now = performance.now();
    const dt = Math.max(1, now - drag.lastT);
    drag.vx = (e.clientX - drag.lastX) / dt * 16; // ~px/frame at 60fps
    drag.vy = (e.clientY - drag.lastY) / dt * 16;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.lastT = now;
    node.fx = x;
    node.fy = y;
  };

  const endDrag = (e: React.PointerEvent<SVGGElement>) => {
    const drag = draggingRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const node = nodesRef.current.find((n) => n.id === drag.id);
    const sim = simRef.current;
    if (node) {
      node.fx = null;
      node.fy = null;
      // Throw: transfer pointer momentum to the bubble.
      // Bigger bubbles are heavier — they accept less of the impulse.
      const inertia = 1 / (1 + node.radius / 30);
      const cap = 14 * inertia;
      node.vx = Math.max(-cap, Math.min(cap, drag.vx * inertia));
      node.vy = Math.max(-cap, Math.min(cap, drag.vy * inertia));
    }
    if (sim) sim.alphaTarget(0);
    draggingRef.current = null;
    setDraggingId(null);
  };
  // -----------------------------------------------------------------------

  const formatLoss = (m: number) => {
    if (m >= 1000) return `$${(m / 1000).toFixed(2)}B`;
    if (m >= 1) return `$${m.toFixed(0)}M`;
    if (m > 0) return `$${(m * 1000).toFixed(0)}K`;
    return "—";
  };

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl border border-neutral-800/60 bg-[radial-gradient(ellipse_at_top,_rgba(30,30,40,0.6),_rgba(0,0,0,1)_70%)] overflow-hidden shadow-[0_0_60px_-30px_rgba(120,120,255,0.25)_inset]"
        style={{ height: size.h }}
      >
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)",
          }}
        />

        <svg ref={svgRef} width={size.w} height={size.h} className="block touch-none select-none" data-tick={tick}>
          <defs>
            {/* Soft outer glow used on hover/drag */}
            <filter id="bubble-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Subtle drop shadow under every bubble */}
            <filter id="bubble-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <feOffset dx="0" dy="3" result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.45" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {nodesRef.current.map((n) => (
              <React.Fragment key={n.id}>
                {/* Main body: color sits at the bottom-right (light source = top-left) */}
                <radialGradient id={`grad-${n.id}`} cx="35%" cy="30%" r="80%">
                  <stop offset="0%" stopColor={n.color} stopOpacity="0.55" />
                  <stop offset="55%" stopColor={n.color} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={n.color} stopOpacity="0.08" />
                </radialGradient>
                {/* Inner glass shell — slightly darker base behind the color */}
                <radialGradient id={`base-${n.id}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#0a0a0a" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#000" stopOpacity="0.85" />
                </radialGradient>
                {/* Specular highlight (top-left bright spot) */}
                <radialGradient id={`spec-${n.id}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.7" />
                  <stop offset="60%" stopColor="white" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </radialGradient>
              </React.Fragment>
            ))}
          </defs>

          {nodesRef.current.map((n) => {
            const isHovered = hoverId === n.id;
            const isDragging = draggingId === n.id;
            const dimmed = hoverId && !isHovered;
            const showLabel = n.radius > 36 || isHovered || isDragging;
            const r = n.radius;
            // Specular highlight geometry — small soft ellipse near top-left
            const specR = r * 0.45;
            const specX = -r * 0.32;
            const specY = -r * 0.38;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x ?? 0}, ${n.y ?? 0})`}
                style={{
                  cursor: isDragging ? "grabbing" : "grab",
                  opacity: dimmed ? 0.4 : 1,
                  transition: "opacity 200ms ease",
                }}
                onMouseEnter={() => setHoverId(n.id)}
                onMouseLeave={() => setHoverId(null)}
                onPointerDown={(e) => onPointerDownNode(e, n.id)}
                onPointerMove={onPointerMoveNode}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                {/* Wrapping group gets the glow filter when hot */}
                <g filter={isHovered || isDragging ? "url(#bubble-glow)" : "url(#bubble-shadow)"}>
                  {/* Dark glass base */}
                  <circle r={r} fill={`url(#base-${n.id})`} />
                  {/* Colored body */}
                  <circle r={r} fill={`url(#grad-${n.id})`} />
                  {/* Outer rim — colored, soft */}
                  <circle
                    r={r}
                    fill="none"
                    stroke={n.color}
                    strokeOpacity={isHovered || isDragging ? 0.85 : 0.5}
                    strokeWidth={1.25}
                  />
                  {/* Inner glass shell highlight */}
                  <circle
                    r={r - 1.5}
                    fill="none"
                    stroke="white"
                    strokeOpacity={0.08}
                    strokeWidth={1}
                  />
                  {/* Specular highlight (clipped via opacity falloff of the gradient) */}
                  <ellipse
                    cx={specX}
                    cy={specY}
                    rx={specR}
                    ry={specR * 0.7}
                    fill={`url(#spec-${n.id})`}
                    pointerEvents="none"
                  />
                  {/* Tiny pinpoint highlight */}
                  <circle
                    cx={-r * 0.42}
                    cy={-r * 0.5}
                    r={Math.max(1.2, r * 0.05)}
                    fill="white"
                    fillOpacity={0.85}
                    pointerEvents="none"
                  />
                </g>

                {/* Selection / hover halo (outside the filter group so it doesn't get blurred away) */}
                {isHovered || isDragging ? (
                  <circle
                    r={r + 5}
                    fill="none"
                    stroke={n.color}
                    strokeOpacity={isDragging ? 0.6 : 0.35}
                    strokeWidth={1}
                  />
                ) : null}

                {showLabel ? (
                  <g pointerEvents="none">
                    <text
                      className="font-geom"
                      textAnchor="middle"
                      dy={r > 50 ? -3 : -1}
                      fill="white"
                      fontSize={Math.max(10, Math.min(13, r / 4.5))}
                      fontWeight={600}
                      letterSpacing="-0.01em"
                      style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.55)", strokeWidth: 3, strokeLinejoin: "round" }}
                    >
                      {n.name.length > 22 ? n.name.slice(0, 20) + "…" : n.name}
                    </text>
                    {r > 50 ? (
                      <text
                        className="font-geom"
                        textAnchor="middle"
                        dy={13}
                        fill={n.color}
                        fontSize={11}
                        fontWeight={700}
                        letterSpacing="0.02em"
                        style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.55)", strokeWidth: 3, strokeLinejoin: "round" }}
                      >
                        {formatLoss(n.loss)}
                      </text>
                    ) : null}
                  </g>
                ) : null}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hovered ? (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-neutral-700 bg-black/90 backdrop-blur px-3 py-2 shadow-xl"
            style={{
              left: Math.min(Math.max(8, (hovered.x ?? 0) + 14), size.w - 220),
              top: Math.min(Math.max(8, (hovered.y ?? 0) + 14), size.h - 90),
              minWidth: 180,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: hovered.color }} />
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">{hovered.category}</span>
            </div>
            <div className="text-sm font-semibold text-white leading-tight">{hovered.name}</div>
            <div className="mt-1.5 flex items-center gap-3 text-xs">
              <span className="text-neutral-400">
                Losses: <span className="font-semibold text-white">{formatLoss(hovered.loss)}</span>
              </span>
              <span className="text-neutral-400">
                Incidents: <span className="font-semibold text-white">{hovered.count}</span>
              </span>
            </div>
          </div>
        ) : null}

        <div className="absolute bottom-3 left-3 text-[10px] uppercase tracking-wider text-neutral-600">
          Bubble size = total losses
        </div>
      </div>

      {/* Category Legend */}
      <div className="mt-4 flex flex-wrap gap-2 px-1">
        {categories.map((c) => (
          <div
            key={c.name}
            className="group flex items-center gap-2 px-3 py-1.5 rounded-full border border-neutral-800/80 bg-neutral-950/40 backdrop-blur text-[11px] text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 transition-colors"
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }}
            />
            {c.name}
          </div>
        ))}
      </div>
    </div>
  );
}
