import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'
import { useLayoutEffect } from 'react'

import { router } from '@/router'
import { useSettings } from '@/settings/useSettings'

const queryClient = new QueryClient()

/** Every page, with everything they rely on. */
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
        <RouterProvider router={router} />
      </MotionConfig>
    </QueryClientProvider>
  )
}
