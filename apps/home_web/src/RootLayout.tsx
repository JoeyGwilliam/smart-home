import { Outlet, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'

import { PageMenu } from '@/components/PageMenu'
import { PastelBackdrop } from '@/components/PastelBackdrop'
import { SettingsMenu } from '@/components/SettingsMenu'
import { useReloadOnNewBuild } from '@/deploy/useReloadOnNewBuild'
import { PAGES } from '@/pages/pages'

/** What every page sits inside: the drifting background, and the pages and settings menus in the top right corner. */
export function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const title = PAGES.find((page) => page.path === pathname)?.title
  useReloadOnNewBuild()

  useEffect(() => {
    document.title = title ? `${title} · Home` : 'Home'
  }, [title])

  return (
    <>
      <PastelBackdrop />
      {/* Named so that page transitions leave the menus where they are (see index.css). */}
      <div className="fixed top-4 right-4 z-40 flex gap-2 [view-transition-name:page-controls]">
        <PageMenu />
        <SettingsMenu />
      </div>
      <div className="page-content">
        <Outlet />
      </div>
    </>
  )
}
