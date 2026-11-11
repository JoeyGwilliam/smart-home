import { Languages, LayoutDashboard, ListTodo, Timer, WandSparkles, type LucideIcon } from 'lucide-react'
import type { JSX } from 'react'

import { AdhdTimerPage } from '@/pages/adhdTimer/AdhdTimerPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { RemindersPage } from '@/pages/reminders/RemindersPage'
import { SiteEditorPage } from '@/pages/siteEditor/SiteEditorPage'
import { WordOfTheDayPage } from '@/pages/wordOfTheDay/WordOfTheDayPage'

/** A screen that can be shown, and how to find it. */
export interface Page {
  /** Where the page lives, such as "/reminders". */
  path: string
  /** The page's name, for the pages menu and the browser tab. */
  title: string
  /** Shown beside the title in the pages menu. */
  icon: LucideIcon
  component: () => JSX.Element
}

/**
 * Every page, in the order the pages menu lists them. Adding a page here is all it takes to route to it and offer it
 * in the menu. The first page is the one shown at the site's root.
 */
export const PAGES: Page[] = [
  { path: '/', title: 'Dashboard', icon: LayoutDashboard, component: DashboardPage },
  { path: '/reminders', title: 'Reminders', icon: ListTodo, component: RemindersPage },
  { path: '/adhd-timer', title: 'ADHD timer', icon: Timer, component: AdhdTimerPage },
  { path: '/word-of-the-day', title: 'Word of the day', icon: Languages, component: WordOfTheDayPage },
  { path: '/site-editor', title: 'Site editor', icon: WandSparkles, component: SiteEditorPage },
]
