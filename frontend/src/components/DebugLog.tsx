import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash, TerminalWindow } from '@phosphor-icons/react';
import type { LogEntry } from '../types';

interface Props {
  entries: LogEntry[];
  onClear: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  message: 'text-copper-dim',
  tool_call: 'text-emerald-400/60',
  handoff: 'text-amber/60',
  error: 'text-red-400/60',
  a2a_task: 'text-violet-400/60',
};

export function DebugLog({ entries, onClear }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [entries]);

  return (
    <aside className="flex flex-col overflow-hidden border-l border-navy-700/40">
      <div className="px-4 py-3 border-b border-navy-700/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TerminalWindow size={14} weight="duotone" className="text-copper" />
          <h2 className="label-xs text-paper-dim">DEBUG LOG</h2>
        </div>
        <button onClick={onClear} className="text-paper-dim/30 hover:text-paper-dim/60 transition-colors">
          <Trash size={12} />
        </button>
      </div>

      <div ref={ref} className="flex-1 overflow-y-auto p-2 font-mono text-[10px] leading-relaxed space-y-px">
        {entries.length === 0 && (
          <p className="text-paper-dim/20 text-center py-8 text-[11px]">Events will appear here</p>
        )}
        <AnimatePresence initial={false}>
          {entries.map((e, i) => (
            <motion.div
              key={`${e.ts}-${i}`}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className={`px-2 py-0.5 rounded border-l-2 truncate ${
                TYPE_COLORS[e.type] || 'text-paper-dim/40'
              }`}
              style={{ borderLeftColor: 'currentColor', borderLeftWidth: 2 }}
            >
              <span className="text-paper-dim/20 mr-2">
                {new Date(e.ts).toLocaleTimeString('en-US', { hour12: false })}
              </span>
              <span className="text-copper-dim/50 mr-1.5">{e.agent}</span>
              <span>{e.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </aside>
  );
}
