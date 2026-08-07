import { motion } from 'motion/react';
import { Plus, CirclesThree } from '@phosphor-icons/react';

interface HeaderProps {
  connected: boolean;
  agentCount: number;
  onAdd: () => void;
}

export function Header({ connected, agentCount, onAdd }: HeaderProps) {
  return (
    <header className="h-12 flex items-center justify-between px-5 bg-navy-900/90 backdrop-blur-sm border-b border-navy-700/50 shrink-0">
      <div className="flex items-center gap-3">
        <CirclesThree size={20} weight="duotone" className="text-copper" />
        <h1 className="font-mono text-sm font-semibold tracking-tight text-paper">AGENT GATEWAY</h1>
        <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-copper-glow text-copper uppercase tracking-[0.12em] border border-copper/20">
          A2A v1.0
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onAdd}
          className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
        >
          <Plus size={14} weight="bold" />
          New Agent
        </button>

        <div className="flex items-center gap-2">
          <motion.span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: connected ? '#4ade80' : '#f87171' }}
            animate={{ opacity: connected ? [1, 0.4, 1] : 1 }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-[11px] text-paper-dim font-mono">{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>

        <span className="text-xs text-paper-dim/60">{agentCount} agent{agentCount !== 1 ? 's' : ''}</span>
      </div>
    </header>
  );
}
