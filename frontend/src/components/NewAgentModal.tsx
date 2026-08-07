import { motion } from 'motion/react';
import { X, Globe, Wrench, Atom, ArrowRight } from '@phosphor-icons/react';
import { useState } from 'react';

const API = '/api';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const AVAILABLE_TOOLS = [
  { id: 'gmail_reader', label: 'Gmail Reader', icon: Globe },
  { id: 'sheets_writer', label: 'Sheets Writer', icon: Wrench },
  { id: 'sheets_reader', label: 'Sheets Reader', icon: Wrench },
  { id: 'ocr_reader', label: 'OCR Reader', icon: Atom },
  { id: 'telegram_sender', label: 'Telegram', icon: Globe },
] as const;

export function NewAgentModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [soul, setSoul] = useState('');
  const [tools, setTools] = useState<string[]>([]);
  const [handoff, setHandoff] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleTool = (id: string) => {
    setTools(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const save = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.toLowerCase().replace(/\s+/g, '-'),
          description: desc,
          soul_md: soul || `# ${name}\n\nYou are a helpful assistant.`,
          tools,
          handoff_enabled: !!handoff,
          handoff_targets: handoff ? handoff.split(',').map(s => s.trim()) : [],
          model: 'deepseek-chat',
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create');
    }
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        className="panel-glass w-full max-w-xl max-h-[90dvh] overflow-y-auto p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="label-xs text-copper-dim mb-1">New Agent</div>
            <h2 className="font-mono text-lg font-semibold text-paper">
              {name || 'untitled'}
            </h2>
          </div>
          <button onClick={onClose} className="text-paper-dim/40 hover:text-paper-dim transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Name + Description */}
        <div className="space-y-4">
          <div>
            <label className="label-xs block mb-1.5">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. lakshmi"
              className="w-full bg-navy-950 border border-navy-600/50 rounded-lg px-3 py-2 text-xs font-mono text-paper placeholder:text-paper-dim/20 focus:outline-none focus:border-copper/40"
            />
          </div>
          <div>
            <label className="label-xs block mb-1.5">Description</label>
            <input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="What does this agent do?"
              className="w-full bg-navy-950 border border-navy-600/50 rounded-lg px-3 py-2 text-xs text-paper placeholder:text-paper-dim/20 focus:outline-none focus:border-copper/40"
            />
          </div>

          {/* SOUL.md */}
          <div>
            <label className="label-xs block mb-1.5">SOUL.md (Persona)</label>
            <textarea
              value={soul}
              onChange={e => setSoul(e.target.value)}
              rows={6}
              placeholder={`# ${name || 'Agent'}\n\nYou are a helpful assistant...`}
              className="w-full bg-navy-950 border border-navy-600/50 rounded-lg px-3 py-2 text-xs font-mono text-paper placeholder:text-paper-dim/20 focus:outline-none focus:border-copper/40 resize-none"
            />
          </div>

          {/* Tools */}
          <div>
            <label className="label-xs block mb-2">Tools</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TOOLS.map(t => {
                const Icon = t.icon;
                const active = tools.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTool(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border transition-all active:scale-[0.96] ${
                      active
                        ? 'bg-copper-glow border-copper/30 text-copper'
                        : 'bg-navy-950 border-navy-600/30 text-paper-dim/50 hover:border-navy-600/60'
                    }`}
                  >
                    <Icon size={12} weight={active ? 'fill' : 'regular'} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Handoff */}
          <div>
            <label className="label-xs block mb-1.5">
              Handoff Targets
              <span className="font-normal normal-case tracking-normal text-paper-dim/40 ml-1">(comma-separated)</span>
            </label>
            <input
              value={handoff}
              onChange={e => setHandoff(e.target.value)}
              placeholder="e.g. qa-agent, dev-agent"
              className="w-full bg-navy-950 border border-navy-600/50 rounded-lg px-3 py-2 text-xs font-mono text-paper placeholder:text-paper-dim/20 focus:outline-none focus:border-copper/40"
            />
          </div>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[11px] text-red-400 font-mono mt-4"
          >
            {error}
          </motion.p>
        )}

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-navy-700/40">
          <button onClick={onClose} className="btn-ghost text-xs">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              'Creating...'
            ) : (
              <>
                <ArrowRight size={14} weight="bold" />
                Create Agent
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
