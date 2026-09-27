import { useId } from 'react'
import { cn } from '../../lib/cn'

/**
 * CONTEXT mark — two offset frames: scattered information (raw)
 * resolving into an aligned frame (structure). Their overlap is
 * the "context". Works as favicon, nav logo and app icon.
 */
export function LogoMark({ size = 20, className }: { size?: number; className?: string }) {
  const id = useId()
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--color-accent)" />
          <stop offset="1" stopColor="var(--color-blue)" />
        </linearGradient>
      </defs>
      {/* raw / loose frame */}
      <rect x="7" y="7" width="33" height="33" rx="8.5" stroke={`url(#g-${id})`} strokeWidth="5.5" opacity="0.55" />
      {/* structured frame, anchored bottom-right */}
      <rect x="24" y="24" width="33" height="33" rx="8.5" stroke={`url(#g-${id})`} strokeWidth="5.5" />
    </svg>
  )
}

export function Logo({
  size = 20,
  withWordmark = true,
  className,
}: {
  size?: number
  withWordmark?: boolean
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2 select-none', className)}>
      <LogoMark size={size} />
      {withWordmark && (
        <span className="font-semibold tracking-tight text-ink" style={{ fontSize: size * 0.82 }}>
          Context
        </span>
      )}
    </span>
  )
}
