type Color = 'green' | 'red' | 'yellow' | 'gray' | 'orange'

const colors: Record<Color, string> = {
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  gray: 'bg-gray-100 text-gray-600',
  orange: 'bg-orange-100 text-orange-700',
}

export default function Badge({ label, color = 'gray' }: { label: string; color?: Color }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[color]}`}>
      {label}
    </span>
  )
}
