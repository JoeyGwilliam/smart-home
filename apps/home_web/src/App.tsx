import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'

import { router } from '@/router'

const queryClient = new QueryClient()

/** Every page, with everything they rely on. */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* People who ask their device for less motion get fades instead of movement. */}
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
      </MotionConfig>
    </QueryClientProvider>
  )
}
