import { motion, AnimatePresence } from 'motion/react';
import { Trash, Globe, Cpu } from '@phosphor-icons/react';
import type { Agent } from '../types';

interface Props {
  agents: Agent[];
  selected: string | null;
  onSelect: (name: string | null) => void;
  onUpdate: () => void;
}

const API = '/api';

export function AgentList({ agents, selected, onSelect, onUpdate }: Props) {
  const del = async (name: string) => {
    await fetch(`${API}/agents/${name}`, { method: 'DELETE' });
    if (selected === name) onSelect(null);
    onUpdate();
  };

  return (
    <aside className="flex flex-col overflow-hidden border-r border-navy-700/40">
      <div className="px-4 py-3 border-b border-navy-700/40 flex items-center gap-2">
        <Cpu size={14} weight="duotone" className="text-copper" />
        <h2 className="label-xs text-paper-dim">AGENTS</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {agents.length === 0 && (
          <p className="text-[11px] text-paper-dim/50 text-center py-8 font-mono">
            No agents yet. Create one to begin.
          </p>
        )}
        <AnimatePresence mode="popLayout">
          {agents.map((a, i) => (
            <motion.button
              key={a.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
              transition={{ delay: i * 0.04, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => onSelect(a.name)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left group transition-colors duration-150 ${
                selected === a.name
                  ? 'bg-copper-glow border border-copper/20'
                  : 'hover:bg-navy-800/50 border border-transparent'
              }`}
            >
              <StatusDot status={a.status} />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs font-medium text-paper truncate">{a.name}</div>
                {a.card_url && (
                  <div className="text-[9px] text-copper-dim/60 font-mono truncate mt-0.5 flex items-center gap-1">
                    <Globe size={8} />
                    {a.card_url}
                  </div>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); del(a.name); }}
                className="opacity-0 group-hover:opacity-100 text-paper-dim/40 hover:text-red-400 transition-all"
              >
                <Trash size={14} />
              </button>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </aside>
  );
}

function StatusDot({ status }: { status: Agent['status'] }) {
  const colors = { idle: '#4ade80', thinking: '#f0c060', error: '#f87171' };
  return (
    <motion.div
      className="w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: colors[status] || colors.idle }}
      animate={status === 'thinking' ? { opacity: [1, 0.3, 1] } : {}}
      transition={{ duration: 1, repeat: Infinity }}
    />
  );
}
