import { Flask, CheckCircle } from '@phosphor-icons/react'
import { WORKSHOP_STAGES } from '../../workshop/stages'
import { workshopColors as c } from './workshopTheme'

type Props = {
  checks: boolean[]
  onToggleCheck: (index: number) => void
  onOpenPlayground: () => void
}

const stage = WORKSHOP_STAGES.find(s => s.id === 'baseline')!

export default function StageBaselinePage({ checks, onToggleCheck, onOpenPlayground }: Props) {
  const done = checks.filter(Boolean).length
  const total = stage.steps.length

  return (
    <article className="space-y-6">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: c.primary }}>
          Stage {stage.index}
        </p>
        <h1 className="text-xl font-bold" style={{ color: c.text }}>
          {stage.title}
        </h1>
        <p className="text-sm mt-1" style={{ color: c.textSecondary }}>
          Get the gateway online and send your first message to an agent.
        </p>
      </header>

      <section
        className="rounded-2xl border-2 p-4 sm:p-5"
        style={{ backgroundColor: c.surface, borderColor: c.border }}
      >
        <h2 className="text-sm font-semibold mb-2" style={{ color: c.text }}>
          Before you start
        </h2>
        <ul className="text-sm space-y-2 list-disc pl-5" style={{ color: c.textSecondary }}>
          <li>Docker running on your machine</li>
          <li>
            Repo cloned, <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: c.bg }}>.env</code> copied
            from template with your LLM API key
          </li>
          <li>
            Run{' '}
            <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: c.bg }}>
              docker compose up --build
            </code>{' '}
            and open{' '}
            <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: c.bg }}>
              http://localhost:8080
            </code>
          </li>
        </ul>
      </section>

      <section
        className="rounded-2xl border-2 p-4 sm:p-5"
        style={{ backgroundColor: c.surface, borderColor: c.border }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: c.text }}>
            Checklist
          </h2>
          <span className="text-[10px] font-mono" style={{ color: c.textMuted }}>
            {done}/{total} · +{stage.xp} XP when done
          </span>
        </div>
        <ul className="space-y-3">
          {stage.steps.map((step, i) => {
            const checked = !!checks[i]
            return (
              <li key={step}>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleCheck(i)}
                    className="mt-0.5 w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                  />
                  <span
                    className="text-sm leading-snug"
                    style={{
                      color: checked ? c.textMuted : c.text,
                      textDecoration: checked ? 'line-through' : 'none',
                    }}
                  >
                    {step}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </section>

      <section
        className="rounded-2xl border-2 p-4 sm:p-5"
        style={{ backgroundColor: c.primaryLight, borderColor: `${c.primary}33` }}
      >
        <h2 className="text-sm font-semibold mb-1" style={{ color: c.text }}>
          Try it in Playground
        </h2>
        <p className="text-sm mb-4" style={{ color: c.textSecondary }}>
          Switch to Playground, pick the <strong>demo</strong> agent, and send a short message. Then create a new agent
          from the sidebar.
        </p>
        <button
          type="button"
          onClick={onOpenPlayground}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: c.primary }}
        >
          <Flask size={16} weight="duotone" />
          Open Playground
        </button>
      </section>

      {done >= total && total > 0 && (
        <p className="text-sm flex items-center gap-2" style={{ color: c.emerald }}>
          <CheckCircle size={18} weight="fill" />
          Stage complete. Ask your facilitator for the next room code.
        </p>
      )}
    </article>
  )
}
