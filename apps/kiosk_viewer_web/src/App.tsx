import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'

import { PastelBackdrop } from '@/components/PastelBackdrop'
import { ReminderBoard } from '@/components/ReminderBoard'

const queryClient = new QueryClient()

/** The kiosk viewer, with everything its screens rely on. */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* People who ask their device for less motion get fades instead of movement. */}
      <MotionConfig reducedMotion="user">
        <PastelBackdrop />
        <ReminderBoard />
      </MotionConfig>
    </QueryClientProvider>
  )
}
