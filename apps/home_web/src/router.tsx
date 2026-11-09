import { createRootRoute, createRoute, createRouter, Navigate } from '@tanstack/react-router'

import { RootLayout } from '@/RootLayout'
import { PAGES } from '@/pages/pages'

const rootRoute = createRootRoute({
  component: RootLayout,
  // An unknown address is most likely an old bookmark, so it leads to the first page rather than an error.
  notFoundComponent: () => <Navigate to={PAGES[0].path} replace />,
})

const pageRoutes = PAGES.map((page) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: page.path,
    component: page.component,
  }),
)

/**
 * Shows the page that matches the address. Moving between pages is animated with a view transition whose type is
 * "page", which index.css styles.
 */
export const router = createRouter({
  routeTree: rootRoute.addChildren(pageRoutes),
  defaultViewTransition: { types: ['page'] },
})
