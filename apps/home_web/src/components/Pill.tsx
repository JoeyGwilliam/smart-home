import type { ReactNode } from 'react'

import { cn } from 'cn'

/** A small rounded label, such as "3 to do". Its colours come from `className`. */
export function Pill({ className, children }: { className: string; children: ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold', className)}>{children}</span>
}
