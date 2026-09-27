import type { CSSProperties } from 'react'
import { cn } from '../../lib/cn'

/** Shimmering placeholder block used while simulated AI works. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={cn('skeleton h-3 w-full', className)} style={style} />
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? 'w-2/3' : undefined} />
      ))}
    </div>
  )
}
