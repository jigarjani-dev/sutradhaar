import type { ReactNode } from 'react'
import {
  Flask,
  CheckCircle,
  Lightbulb,
  Flag,
  ListNumbers,
  Info,
} from '@phosphor-icons/react'
import type { LevelId } from '../../workshop/workshopUnlock'
import { STAGE_BY_ID, SECTION_TONES } from '../../workshop/stages'
import { workshopColors as c } from './workshopTheme'

type Props = {
  stageId: LevelId
  checks: boolean[]
  onToggleCheck: (index: number) => void
  onOpenPlayground: () => void
}

function Section({
  tone,
  icon,
  children,
}: {
  tone: keyof typeof SECTION_TONES
  icon: ReactNode
  children: ReactNode
}) {
  const t = SECTION_TONES[tone]
  return (
    <section
      className="rounded-2xl border p-4 sm:p-5"
      style={{ backgroundColor: t.bg, borderColor: t.border }}
    >
      <h2
        className="text-[11px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5"
        style={{ color: c.textSecondary }}
      >
        {icon}
        {t.label}
      </h2>
      {children}
    </section>
  )
}

const URL_RE = /(https?:\/\/[^\s]+)/g

/** Turn http(s) URLs into links; keep trailing punctuation outside the href. */
function linkifyText(text: string, linkColor: string): ReactNode[] {
  return text.split(URL_RE).map((part, i) => {
    if (!/^https?:\/\//.test(part)) return part
    const href = part.replace(/[.,);:!?]+$/u, '')
    const trailing = part.slice(href.length)
    return (
      <span key={i}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="underline break-all"
          style={{ color: linkColor }}
        >
          {href}
        </a>
        {trailing}
      </span>
    )
  })
}

export default function StagePage({
  stageId,
  checks,
  onToggleCheck,
  onOpenPlayground,
}: Props) {
  const stage = STAGE_BY_ID[stageId]
  const done = checks.filter(Boolean).length
  const total = stage.tasks.length
  const complete = total > 0 && done >= total

  return (
    <article className="space-y-4">
      <header className="pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: c.primary }}>
          Stage {stage.index}
        </p>
        <h1 className="text-xl font-bold" style={{ color: c.text }}>
          {stage.title}
        </h1>
        <p className="text-sm mt-1" style={{ color: c.textSecondary }}>
          {stage.blurb}
        </p>
      </header>

      <Section tone="theory" icon={<Lightbulb size={14} weight="duotone" />}>
        <ul className="space-y-2">
          {stage.theory.map(line => (
            <li
              key={line}
              className="text-sm leading-snug pl-3 border-l-2"
              style={{ borderColor: SECTION_TONES.theory.border, color: c.text }}
            >
              {line}
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="do" icon={<ListNumbers size={14} weight="duotone" />}>
        <ol className="space-y-2 list-decimal pl-5">
          {stage.do.map(line => (
            <li key={line} className="text-sm leading-snug" style={{ color: c.text }}>
              {line}
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="check" icon={<Flag size={14} weight="duotone" />}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono" style={{ color: c.textMuted }}>
            {done}/{total} captured · +{stage.xp} XP when done
          </span>
        </div>
        <ul className="space-y-3">
          {stage.tasks.map((task, i) => {
            const checked = !!checks[i]
            return (
              <li key={task.title}>
                <label
                  className="flex gap-3 cursor-pointer rounded-xl border p-3 transition-colors"
                  style={{
                    backgroundColor: checked ? 'rgba(16,185,129,0.08)' : c.surface,
                    borderColor: checked ? '#6ee7b7' : c.border,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleCheck(i)}
                    className="mt-1 w-4 h-4 rounded accent-emerald-600 cursor-pointer shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: checked ? c.emerald : c.primary }}
                      >
                        Task {task.label ?? i + 1}
                      </span>
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: checked ? '#d1fae5' : '#eef2ff',
                          color: checked ? '#047857' : c.primary,
                        }}
                      >
                        {checked ? 'Captured' : 'Flag'}
                      </span>
                      {task.xp != null && (
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
                        >
                          +{task.xp} XP
                        </span>
                      )}
                    </span>
                    <span
                      className="block text-sm font-bold mt-1 leading-snug"
                      style={{
                        color: checked ? c.textMuted : c.text,
                        textDecoration: checked ? 'line-through' : 'none',
                      }}
                    >
                      {task.title}
                    </span>
                    <span
                      className="block text-sm mt-1 leading-snug"
                      style={{ color: checked ? c.textMuted : c.textSecondary }}
                    >
                      {linkifyText(task.detail, checked ? c.textMuted : c.primary)}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </Section>

      {stage.tip && (
        <Section tone="tip" icon={<Info size={14} weight="duotone" />}>
          <p className="text-sm leading-snug" style={{ color: c.text }}>
            {stage.tip}
          </p>
        </Section>
      )}

      {stage.showPlaygroundCta && (
        <Section tone="play" icon={<Flask size={14} weight="duotone" />}>
          <p className="text-sm mb-3" style={{ color: c.textSecondary }}>
            Run the tasks in Playground, then come back and mark each flag when you’ve verified it.
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
        </Section>
      )}

      {complete && (
        <p className="text-sm flex items-center gap-2 pt-1" style={{ color: c.emerald }}>
          <CheckCircle size={18} weight="fill" />
          All flags captured. Ask your facilitator for the next room code.
        </p>
      )}
    </article>
  )
}
