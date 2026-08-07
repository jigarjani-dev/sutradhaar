import { useCallback, useSyncExternalStore } from 'react'
import Sample1Blueprint from './components/Sample1Blueprint'
import Sample2Editorial from './components/Sample2Editorial'
import Sample3Brutalist from './components/Sample3Brutalist'
import Sample4DarkLuxe from './components/Sample4DarkLuxe'
import Sample5SoftLab from './components/Sample5SoftLab'
import Sample5SoftLabV2 from './components/Sample5SoftLabV2'

const samples = [
  { name: 'Blueprint', hash: '#/sample-1', preview: 'Navy grid, copper accents, glass panels, IBM Plex Mono.' },
  { name: 'Editorial', hash: '#/sample-2', preview: 'Cream paper, serif type, ink annotations, index-card layout.' },
  { name: 'Brutalist', hash: '#/sample-3', preview: 'Pure black, green terminal, thick borders, raw monospace.' },
  { name: 'Dark Luxe', hash: '#/sample-4', preview: 'Deep charcoal, warm gold, thin lines, generous whitespace.' },
  { name: 'Soft Lab', hash: '#/sample-5', preview: 'Warm gray, pastel accents, large radius, iMessage bubbles.' },
  { name: 'Soft Lab v2', hash: '#/sample-6', preview: 'Polished Soft Lab with animations, depth, and micro-interactions.' },
]

const cardBgs = [
  'bg-[#0a1628] border-[#e8a850]/30',
  'bg-[#f8f5f0] border-[#cc3333]/20',
  'bg-[#000] border-[#00ff41]/30',
  'bg-[#0a0a0a] border-[#c9a84c]/20',
  'bg-[#fafaf8] border-[#a78bfa]/20',
  'bg-[#f8f9fa] border-[#6366f1]/30',
]

const cardAccents = [
  'bg-[#0a1628] text-[#e8a850]',
  'bg-[#f8f5f0] text-[#cc3333]',
  'bg-[#000] text-[#00ff41]',
  'bg-[#0a0a0a] text-[#c9a84c]',
  'bg-[#fafaf8] text-[#a78bfa]',
  'bg-[#f8f9fa] text-[#6366f1]',
]

function getHash() {
  return typeof window !== 'undefined' ? window.location.hash || '#/' : '#/'
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

function IndexPage() {
  const navigate = useCallback((hash: string) => {
    window.location.hash = hash
  }, [])

  return (
    <div className="min-h-screen bg-neutral-100 p-8 flex flex-col items-center">
      <h1 className="text-3xl font-bold text-neutral-800 mb-2">Agent Gateway UI Samples</h1>
      <p className="text-neutral-500 mb-10 text-sm">5 distinct visual directions for the agent orchestration dashboard.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl w-full">
        {samples.map((s, i) => (
          <button
            key={s.hash}
            onClick={() => navigate(s.hash)}
            className={`sample-link text-left p-6 rounded-xl border ${cardBgs[i]} group cursor-pointer`}
          >
            <div className={`inline-block text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded mb-3 ${cardAccents[i]}`}>
              Sample {i + 1}
            </div>
            <h2 className="text-lg font-semibold text-neutral-800 mb-1">{s.name}</h2>
            <p className="text-sm text-neutral-500 leading-relaxed">{s.preview}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const hash = useSyncExternalStore(subscribe, getHash, () => '#/')

  switch (hash) {
    case '#/sample-1': return <Sample1Blueprint />
    case '#/sample-2': return <Sample2Editorial />
    case '#/sample-3': return <Sample3Brutalist />
    case '#/sample-4': return <Sample4DarkLuxe />
    case '#/sample-5': return <Sample5SoftLab />
    case '#/sample-6': return <Sample5SoftLabV2 />
    default: return <IndexPage />
  }
}
