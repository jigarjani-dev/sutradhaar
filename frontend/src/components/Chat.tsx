import { useState } from 'react';
import { motion } from 'motion/react';
import { PaperPlaneTilt } from '@phosphor-icons/react';
import type { Agent } from '../types';

const API = '/api';

interface Props {
  agent: string | null;
  agents: Agent[];
  onUpdate: () => void;
}

export function ChatPanel({ agent, onUpdate: _onUpdate }: Props) {
  const [messages, setMessages] = useState<Array<{ sender: string; text: string; role: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || !agent) return;
    setInput('');
    setMessages(prev => [...prev, { sender: 'you', text, role: 'user' }]);
    setLoading(true);
    try {
      const res = await fetch(`${API}/agents/${agent}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { sender: agent, text: data.response, role: 'assistant' }]);
    } catch {
      setMessages(prev => [...prev, { sender: 'system', text: 'Error: request failed', role: 'system' }]);
    }
    setLoading(false);
  };

  const canSend = agent && input.trim() && !loading;

  return (
    <div className="flex-1 flex flex-col border-t border-navy-700/40 min-h-0">
      <div className="px-4 py-2 border-b border-navy-700/40 flex items-center gap-2">
        {agent && (
          <p className="text-[10px] font-mono text-copper-dim uppercase tracking-[0.1em]">
            CHAT -- {agent}
          </p>
        )}
        {!agent && (
          <p className="text-[10px] font-mono text-paper-dim/40 uppercase tracking-[0.1em]">
            Select an agent to begin
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={`max-w-[85%] px-3 py-2 rounded-lg text-[12px] leading-relaxed ${
              m.role === 'user'
                ? 'ml-auto bg-navy-700/50 border border-navy-600/30'
                : 'bg-copper-glow/50 border border-copper/10'
            } ${m.role === 'system' ? 'mx-auto text-paper-dim/50 text-[11px] italic' : ''}`}
          >
            {m.role !== 'user' && m.role !== 'system' && (
              <div className="text-[9px] font-mono text-copper-dim/60 uppercase mb-1">{m.sender}</div>
            )}
            <p className="text-paper/80 whitespace-pre-wrap">{m.text}</p>
          </motion.div>
        ))}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 px-3 py-2"
          >
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-copper"
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
            />
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-copper"
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
            />
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-copper"
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
            />
          </motion.div>
        )}
      </div>

      <div className="p-3 border-t border-navy-700/40">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder={agent ? `Message ${agent}...` : 'Select an agent'}
            disabled={!agent}
            className="flex-1 bg-navy-900 border border-navy-600/50 rounded-lg px-3 py-2 text-xs text-paper placeholder:text-paper-dim/30 focus:outline-none focus:border-copper/40 disabled:opacity-30 font-mono"
          />
          <button
            onClick={send}
            disabled={!canSend}
            className="btn-primary p-2 aspect-square flex items-center justify-center disabled:opacity-30 disabled:shadow-none"
          >
            <PaperPlaneTilt size={14} weight="fill" />
          </button>
        </div>
      </div>
    </div>
  );
}
