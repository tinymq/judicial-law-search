'use client';

import { useState, useRef } from 'react';
import type { MindmapData, MindNode, MindBranch } from './data';

type HoverState = { node: MindNode; branch: MindBranch; cx: number; cy: number } | null;
type DragState = { sx: number; sy: number; vx: number; vy: number } | null;

type Props = {
  data: MindmapData;
  onSelectNode?: (node: MindNode, branch: MindBranch) => void;
  selectedId?: string;
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default function Mindmap({ data, onSelectNode, selectedId }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [vb, setVb] = useState({ x: -500, y: -320, w: 1000, h: 640 });
  const [drag, setDrag] = useState<DragState>(null);
  const [hover, setHover] = useState<HoverState>(null);

  const cx = 0;
  const cy = 0;

  const resetView = () => setVb({ x: -500, y: -320, w: 1000, h: 640 });

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const factor = e.deltaY > 0 ? 1.08 : 0.92;
    const nw = Math.max(500, Math.min(1800, vb.w * factor));
    const nh = nw * (640 / 1000);
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const nx = vb.x + (vb.w - nw) * px;
    const ny = vb.y + (vb.h - nh) * py;
    setVb({ x: nx, y: ny, w: nw, h: nh });
  };

  const onDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setDrag({ sx: e.clientX, sy: e.clientY, vx: vb.x, vy: vb.y });
  };

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drag || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const scaleX = vb.w / rect.width;
    const scaleY = vb.h / rect.height;
    setVb({ ...vb, x: drag.vx - (e.clientX - drag.sx) * scaleX, y: drag.vy - (e.clientY - drag.sy) * scaleY });
  };

  const onUp = () => setDrag(null);

  // Build node geometry
  type HubNode = { type: 'hub'; branch: MindBranch; x: number; y: number; angle: number };
  type LeafNode = { type: 'leaf'; branch: MindBranch; node: MindNode; x: number; y: number; angle: number };
  const nodes: (HubNode | LeafNode)[] = [];

  data.branches.forEach((b) => {
    const count = b.nodes.length;
    const r1 = 210;
    const r2 = 380;
    const hubAngle = (b.angleStart + b.angleEnd) / 2;
    const hubPt = polar(cx, cy, r1, hubAngle);
    nodes.push({ type: 'hub', branch: b, x: hubPt.x, y: hubPt.y, angle: hubAngle });
    b.nodes.forEach((n, i) => {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const angle = b.angleStart + t * (b.angleEnd - b.angleStart);
      const leafR = r2 + (i % 2 === 0 ? 0 : 18);
      const pt = polar(cx, cy, leafR, angle);
      nodes.push({ type: 'leaf', branch: b, node: n, x: pt.x, y: pt.y, angle });
    });
  });

  const maxW = Math.max(...data.branches.flatMap((b) => b.nodes.map((n) => n.weight)));
  const radiusFor = (w: number) => 10 + (w / maxW) * 14;

  return (
    <div
      className="relative w-full h-full select-none node-glow"
      ref={wrapRef}
      onWheel={onWheel}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      style={{ cursor: drag ? 'grabbing' : 'grab' }}
    >
      <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="w-full h-full">
        <defs>
          <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c8302b" stopOpacity="1" />
            <stop offset="100%" stopColor="#862019" stopOpacity="1" />
          </radialGradient>
        </defs>

        {/* Background concentric rings */}
        {[140, 210, 300, 400].map((r, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#e8e6e3"
            strokeWidth="1"
            strokeDasharray={i % 2 ? '2 6' : 'none'}
            opacity="0.7"
          />
        ))}

        {/* Hub → center lines */}
        {nodes.filter((n): n is HubNode => n.type === 'hub').map((h, i) => (
          <line
            key={`hub-l-${i}`}
            x1={cx}
            y1={cy}
            x2={h.x}
            y2={h.y}
            stroke={h.branch.color}
            strokeWidth="1.4"
            opacity="0.35"
          />
        ))}

        {/* Leaf curves from hub */}
        {nodes.filter((n): n is LeafNode => n.type === 'leaf').map((n, i) => {
          const hub = nodes.find((h): h is HubNode => h.type === 'hub' && h.branch.id === n.branch.id);
          if (!hub) return null;
          const mx = (hub.x + n.x) / 2;
          const my = (hub.y + n.y) / 2;
          const dx = n.x - hub.x;
          const dy = n.y - hub.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const offset = 14;
          const ctrlX = mx - (dy / len) * offset;
          const ctrlY = my + (dx / len) * offset;
          const active = selectedId === n.node.id;
          return (
            <path
              key={`lp-${i}`}
              d={`M${hub.x},${hub.y} Q${ctrlX},${ctrlY} ${n.x},${n.y}`}
              stroke={n.branch.color}
              strokeWidth={active ? 1.8 : 1}
              fill="none"
              opacity={active ? 0.9 : 0.45}
            />
          );
        })}

        {/* Hub nodes */}
        {nodes.filter((n): n is HubNode => n.type === 'hub').map((h, i) => (
          <g key={`hub-${i}`}>
            <circle cx={h.x} cy={h.y} r="28" fill="#faf8f5" stroke={h.branch.color} strokeWidth="2" />
            <circle cx={h.x} cy={h.y} r="6" fill={h.branch.color} />
            <text
              x={h.x}
              y={h.y + 50}
              textAnchor="middle"
              fontFamily="'Noto Serif SC',serif"
              fontSize="14"
              fontWeight="700"
              fill={h.branch.color}
            >
              {h.branch.name}
            </text>
            <text
              x={h.x}
              y={h.y + 66}
              textAnchor="middle"
              fontFamily="'JetBrains Mono',monospace"
              fontSize="10"
              fill="#9b9b9b"
              letterSpacing="0.08em"
            >
              {String(h.branch.nodes.length).padStart(2, '0')} / {h.branch.nodes.reduce((a, b) => a + b.cases, 0)} 引用
            </text>
          </g>
        ))}

        {/* Leaves */}
        {nodes.filter((n): n is LeafNode => n.type === 'leaf').map((n, i) => {
          const r = radiusFor(n.node.weight);
          const active = selectedId === n.node.id;
          const a = ((n.angle % 360) + 360) % 360;
          const rightSide = a < 90 || a > 270;
          const labelX = n.x + (rightSide ? r + 10 : -(r + 10));
          const labelY = n.y + 4;
          const anchor = rightSide ? 'start' : 'end';

          return (
            <g
              key={`leaf-${i}`}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => {
                if (!wrapRef.current) return;
                const rect = wrapRef.current.getBoundingClientRect();
                setHover({
                  node: n.node,
                  branch: n.branch,
                  cx: e.clientX - rect.left,
                  cy: e.clientY - rect.top,
                });
              }}
              onMouseLeave={() => setHover(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNode?.(n.node, n.branch);
              }}
            >
              {active && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r + 2}
                  fill="none"
                  stroke={n.branch.color}
                  strokeWidth="2"
                  className="pulse-ring"
                  style={{ transformOrigin: `${n.x}px ${n.y}px` }}
                />
              )}
              <circle
                cx={n.x}
                cy={n.y}
                r={r}
                fill={active ? n.branch.color : '#fff'}
                stroke={n.branch.color}
                strokeWidth={active ? 2 : 1.5}
              />
              {n.node.hot && !active && (
                <circle cx={n.x + r - 2} cy={n.y - r + 2} r="3" fill="#c8302b" />
              )}
              <text
                x={n.x}
                y={n.y + 4}
                textAnchor="middle"
                fontFamily="'JetBrains Mono',monospace"
                fontSize="10"
                fontWeight="600"
                fill={active ? '#fff' : n.branch.color}
              >
                {n.node.cases}
              </text>
              <text
                x={labelX}
                y={labelY}
                textAnchor={anchor}
                fontFamily="'Noto Sans SC',sans-serif"
                fontSize="12"
                fontWeight={active ? 700 : 500}
                fill={active ? '#1a1a1a' : '#3d3d3d'}
              >
                {n.node.label}
              </text>
              <text
                x={labelX}
                y={labelY + 14}
                textAnchor={anchor}
                fontFamily="'JetBrains Mono',monospace"
                fontSize="9"
                fill="#9b9b9b"
              >
                引用 {n.node.cases}
              </text>
            </g>
          );
        })}

        {/* Center node on top */}
        <g>
          <circle cx={cx} cy={cy} r="66" fill="#faf8f5" stroke="#1a1a1a" strokeWidth="1.2" strokeDasharray="2 4" opacity="0.5" />
          <circle cx={cx} cy={cy} r="52" fill="url(#centerGrad)" />
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fontFamily="'Noto Serif SC',serif"
            fontSize="16"
            fontWeight="700"
            fill="#faf8f5"
          >
            {data.center.label.split(' · ')[0]}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            fontFamily="'Noto Sans SC',sans-serif"
            fontSize="10"
            fill="#faf8f5"
            opacity="0.85"
          >
            {data.center.label.split(' · ')[1] || ''}
          </text>
          <text
            x={cx}
            y={cy + 30}
            textAnchor="middle"
            fontFamily="'JetBrains Mono',monospace"
            fontSize="9"
            fill="#faf8f5"
            opacity="0.7"
            letterSpacing="0.1em"
          >
            {data.center.meta}
          </text>
        </g>
      </svg>

      {/* Hover tooltip */}
      {hover && (
        <div
          className="absolute pointer-events-none bg-white border border-paper-300 rounded-md shadow-lg p-3 text-xs"
          style={{ left: hover.cx + 14, top: hover.cy + 14, maxWidth: 260, zIndex: 10 }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: hover.branch.color }}></span>
            <span className="font-semibold" style={{ color: hover.branch.color }}>{hover.branch.name}</span>
          </div>
          <div className="font-serif font-bold text-ink-900 mb-2 text-[13px] leading-snug">{hover.node.label}</div>
          <div className="grid grid-cols-2 gap-2 mono text-[10px] text-ink-500 border-t border-paper-300 pt-2">
            <div>引用: <span className="text-ink-900 font-semibold">{hover.node.cases}</span></div>
            <div>权重: <span className="text-ink-900 font-semibold">{hover.node.weight}</span></div>
          </div>
          <div className="mt-2 text-[11px] text-ink-500">点击查看详情 →</div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur border border-paper-300 rounded-md px-1 py-1">
        <button
          type="button"
          className="w-7 h-7 text-ink-500 hover:text-ink-900 text-base mono"
          onClick={() => setVb({ ...vb, w: Math.max(500, vb.w * 0.9), h: Math.max(320, vb.h * 0.9) })}
        >
          +
        </button>
        <button
          type="button"
          className="w-7 h-7 text-ink-500 hover:text-ink-900 text-base mono"
          onClick={() => setVb({ ...vb, w: Math.min(1800, vb.w * 1.1), h: Math.min(1150, vb.h * 1.1) })}
        >
          −
        </button>
        <div className="w-px h-4 bg-paper-300"></div>
        <button type="button" className="px-2 h-7 text-[11px] text-ink-500 hover:text-ink-900" onClick={resetView}>
          复位
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-4 flex items-center gap-4 text-[11px] text-ink-500">
        {data.branches.map((b) => (
          <div key={b.id} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: b.color }}></span>
            <span>{b.name}</span>
            <span className="mono text-ink-400">·{b.nodes.length}</span>
          </div>
        ))}
        <div className="ml-4 flex items-center gap-1.5 text-ink-400">
          <span className="mono">⊕ 滚轮缩放</span>
          <span className="mono">⊕ 拖拽平移</span>
        </div>
      </div>
    </div>
  );
}
