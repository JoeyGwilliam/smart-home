import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutGrid } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PAGES } from '@/pages/pages'
import { cn } from 'cn'

/** A button that opens a list of every page, for moving between them. */
export function PageMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="glass rounded-full text-muted-foreground shadow-md shadow-primary/10 hover:bg-accent hover:text-foreground" aria-label="Pages">
          <motion.span animate={{ scale: isOpen ? 0.85 : 1 }} transition={{ type: 'spring', bounce: 0.5 }} className="grid place-items-center">
            <LayoutGrid className="size-5" />
          </motion.span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl border border-glass-edge p-1.5 shadow-xl shadow-primary/20">
        <DropdownMenuLabel className="font-heading text-base font-semibold">Pages</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PAGES.map((page) => {
          const isCurrent = page.path === pathname
          return (
            <DropdownMenuItem key={page.path} asChild className={cn('rounded-xl px-2.5 py-2 font-semibold', isCurrent && 'bg-accent text-primary-text')}>
              <Link to={page.path} aria-current={isCurrent ? 'page' : undefined}>
                <page.icon />
                {page.title}
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
