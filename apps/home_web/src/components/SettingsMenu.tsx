import { Moon, Settings as SettingsIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { flushSync } from 'react-dom'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { useSettings } from '@/settings/useSettings'

/** A gear button that opens this device's settings. */
export function SettingsMenu() {
  const [settings, changeSettings] = useSettings()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className="panel rounded-full text-muted-foreground shadow-md shadow-shade hover:bg-accent hover:text-foreground"
          aria-label="Settings"
        >
          <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ type: 'spring', bounce: 0.3 }} className="grid place-items-center">
            <SettingsIcon className="size-5" />
          </motion.span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl border-4 border-panel-edge p-1.5 shadow-xl shadow-shade">
        <DropdownMenuLabel className="font-heading text-base font-semibold">Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          role="menuitemcheckbox"
          aria-checked={settings.isNightMode}
          // Selecting an item normally closes the menu. Keeping it open lets the person see the switch change.
          onSelect={(event) => {
            event.preventDefault()
            revealChange(() => changeSettings({ isNightMode: !settings.isNightMode }))
          }}
          className="justify-between rounded-xl px-2.5 py-2 font-semibold"
        >
          <span className="flex items-center gap-2">
            <Moon />
            Night mode
          </span>
          {/* The whole row toggles the setting, so the switch only shows its state. */}
          <Switch checked={settings.isNightMode} tabIndex={-1} aria-hidden className="pointer-events-none" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Makes a change that alters the whole page's look, revealing the result as a circle growing from this menu's button
 * (see index.css, which styles view transitions of type "theme"). Applies the change instantly where the browser can't animate it, or the person asked for less motion.
 */
function revealChange(change: () => void): void {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || prefersReducedMotion) {
    change()
    return
  }

  // The browser captures the page before and after the callback, so React has to finish rendering inside it.
  document.startViewTransition({ update: () => flushSync(change), types: ['theme'] })
}
