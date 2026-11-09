import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { useLayoutEffect } from 'react'

import { PastelBackdrop } from '@/components/PastelBackdrop'
import { ReminderBoard } from '@/components/ReminderBoard'
import { SettingsMenu } from '@/components/SettingsMenu'
import { useSettings } from '@/settings/useSettings'

const queryClient = new QueryClient()

/** The kiosk viewer, with everything its screens rely on. */
export function App() {
  const [{ isNightMode }] = useSettings()

  // The colour scheme is chosen by a class on the root element, which index.css's dark variant looks for. A layout
  // effect applies it before the browser paints, so the page never flashes in the wrong scheme.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', isNightMode)
  }, [isNightMode])

  return (
    <QueryClientProvider client={queryClient}>
      {/* People who ask their device for less motion get fades instead of movement. */}
      <MotionConfig reducedMotion="user">
        <PastelBackdrop />
        <div className="fixed top-4 right-4 z-40">
          <SettingsMenu />
        </div>
        <ReminderBoard />
      </MotionConfig>
    </QueryClientProvider>
  )
}
