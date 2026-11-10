import { Outlet, useRouterState } from '@tanstack/react-router'
import { useEffect, useLayoutEffect } from 'react'

import { PageMenu } from '@/components/PageMenu'
import { PixelBackdrop } from '@/components/PixelBackdrop'
import { SettingsMenu } from '@/components/SettingsMenu'
import { useReloadOnNewBuild } from '@/deploy/useReloadOnNewBuild'
import { PAGES } from '@/pages/pages'
import { useScene } from '@/scene/useScene'

/**
 * What every page sits inside: the pixel-art backdrop, showing the current scene, and the pages and settings menus in
 * the top right corner.
 */
export function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const title = PAGES.find((page) => page.path === pathname)?.title
  const scene = useScene()
  const { timeOfDay, weather } = scene
  useReloadOnNewBuild()

  useEffect(() => {
    document.title = title ? `${title} · Home` : 'Home'
  }, [title])

  // index.css colours the whole site to suit the scene, which it reads from the root element: the dark palette at
  // night, and a sky for the time of day and the weather. A layout effect writes the scene there before the browser
  // paints, so the page never flashes in the wrong colours.
  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', timeOfDay === 'night')
    root.dataset.timeOfDay = timeOfDay
    root.dataset.weather = weather
  }, [timeOfDay, weather])

  return (
    <>
      <PixelBackdrop scene={scene} />
      {/* Named so that page transitions leave the menus where they are (see index.css). */}
      <div className="fixed top-4 right-4 z-40 flex gap-2 [view-transition-name:page-controls]">
        <PageMenu />
        <SettingsMenu />
      </div>
      {/* The top padding clears the menus, leaving the same 1rem gap beneath them as there is above: 1rem to the
          menus, 2.25rem for the menus themselves, then 1rem more. */}
      <div className="page-content pt-[4.25rem]">
        <Outlet />
      </div>
    </>
  )
}
