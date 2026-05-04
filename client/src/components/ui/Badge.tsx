type Color = 'green' | 'red' | 'yellow' | 'gray' | 'orange'

const colors: Record<Color, string> = {
  green:  'bg-green-900/40 text-green-400 border border-green-800/50',
  red:    'bg-red-900/40 text-red-400 border border-red-800/50',
  yellow: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/50',
  gray:   'bg-zinc-800 text-zinc-400 border border-zinc-700',
  orange: 'bg-orange-900/40 text-orange-400 border border-orange-800/50',
}

export default function Badge({ label, color = 'gray' }: { label: string; color?: Color }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[color]}`}>
      {label}
    </span>
  )
}
