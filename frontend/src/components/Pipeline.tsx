import { motion } from 'motion/react';
import { Cpu } from '@phosphor-icons/react';
import type { Agent } from '../types';

interface Props {
  agents: Agent[];
  selected: string | null;
}

const NODE_R = 24;
const RING_R = 32;
const PADDING = 60;

const STATUS_COLORS = {
  idle: 'rgba(74, 222, 128, 0.12)',
  thinking: 'rgba(240, 192, 96, 0.12)',
  error: 'rgba(248, 113, 113, 0.12)',
} as const;

const STATUS_STROKE = {
  idle: '#4ade8040',
  thinking: '#f0c06040',
  error: '#f8717140',
} as const;

export function Pipeline({ agents, selected }: Props) {
  const w = 600;
  const h = 200;
  const n = agents.length;

  if (n === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-paper-dim/20 gap-3">
        <Cpu size={32} weight="duotone" />
        <p className="font-mono text-[11px] uppercase tracking-[0.15em]">No agents deployed</p>
        <p className="text-[10px] text-paper-dim/20 -mt-1">Create one to see the pipeline</p>
      </div>
    );
  }

  const positions = agents.map((_, i) => {
    const x = PADDING + (i * (w - PADDING * 2)) / Math.max(n - 1, 1);
    const y = h / 2;
    return { x, y };
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-2 border-b border-navy-700/40 flex items-center gap-2">
        <span className="label-xs text-paper-dim">PIPELINE</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center relative">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-2xl h-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {Array.from({ length: Math.ceil(w / 24) }, (_, i) => (
            <line
              key={`gv-${i}`}
              x1={i * 24}
              y1={0}
              x2={i * 24}
              y2={h}
              stroke="rgba(26, 48, 80, 0.3)"
              strokeWidth={0.5}
            />
          ))}
          {Array.from({ length: Math.ceil(h / 24) }, (_, i) => (
            <line
              key={`gh-${i}`}
              x1={0}
              y1={i * 24}
              x2={w}
              y2={i * 24}
              stroke="rgba(26, 48, 80, 0.3)"
              strokeWidth={0.5}
            />
          ))}

          {/* Edge traces between agents */}
          {agents.slice(0, -1).map((_, i) => {
            const from = positions[i];
            const to = positions[i + 1];
            return (
              <g key={`edge-${i}`}>
                <line
                  x1={from.x + RING_R}
                  y1={from.y}
                  x2={to.x - RING_R}
                  y2={to.y}
                  stroke="rgba(232, 168, 80, 0.15)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                {agents.length > 1 && (
                  <circle r={2} fill="rgba(232, 168, 80, 0.2)">
                    <animateMotion
                      dur="3s"
                      repeatCount="indefinite"
                      path={`M${from.x + RING_R},${from.y} L${to.x - RING_R},${to.y}`}
                    />
                  </circle>
                )}
              </g>
            );
          })}

          {/* Agent nodes */}
          {agents.map((a, i) => {
            const { x, y } = positions[i];
            const isSelected = a.name === selected;
            const color = STATUS_COLORS[a.status] || STATUS_COLORS.idle;
            const stroke = STATUS_STROKE[a.status] || STATUS_STROKE.idle;

            return (
              <g key={a.name}>
                {/* Outer ring */}
                <motion.circle
                  cx={x} cy={y} r={RING_R}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={isSelected ? 2 : 1}
                  initial={false}
                  animate={{ r: a.status === 'thinking' ? [RING_R, RING_R + 4, RING_R] : RING_R }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
                {/* Node */}
                <circle cx={x} cy={y} r={NODE_R} fill={color} stroke={isSelected ? '#e8a850' : 'transparent'} strokeWidth={1.5} />
                {/* Label */}
                <text
                  x={x}
                  y={y + NODE_R + 14}
                  textAnchor="middle"
                  className="font-mono text-[10px] fill-paper-dim"
                  fontFamily="'IBM Plex Mono', monospace"
                >
                  {a.name}
                </text>
                {/* Initial letter */}
                <text
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  className="font-mono text-[11px] font-semibold fill-paper/70"
                  fontFamily="'IBM Plex Mono', monospace"
                >
                  {a.name[0].toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
