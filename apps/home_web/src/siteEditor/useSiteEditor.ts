import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import type { Change, Commit } from '@/siteEditor/change'
import type { ClaudeSettings } from '@/siteEditor/claudeSettings'
import * as siteEditorApi from '@/siteEditor/siteEditorApi'

const CHANGE_QUERY_KEY = ['siteEditor', 'change']
const COMMITS_QUERY_KEY = ['siteEditor', 'commits']

// Claude's progress is shown by refreshing the change, so each step appears within a second of it happening. That is
// cheap: the API is on the same machine as the site, and answers from memory.
const CHANGE_REFRESH_INTERVAL_MILLISECONDS = 1000

// The history only grows when a change is saved, so it can lag a little further behind.
const COMMITS_REFRESH_INTERVAL_MILLISECONDS = 5000

/** The change being made to the site, the site's history, and the ways to move the change along. */
export interface SiteEditor {
  /** The change as it stands, or undefined until it has first been fetched. */
  change: Change | undefined
  /** The site's saved changes, newest first, or undefined until they have first been fetched. */
  commits: Commit[] | undefined
  /** Whether the site editor API can't be reached at the moment, so that what is shown may be out of date. */
  isUnavailable: boolean
  /** Why the last action didn't go ahead, in words for the person, or null if it did. */
  refusal: string | null
  /**
   * Passes a message to Claude: a request for a change, or the next part of the conversation about one.
   *
   * @param text What the person wants, in their own words.
   * @param claudeSettings How Claude should work on the message.
   * @returns Whether the message was accepted. When it wasn't, `refusal` says why.
   */
  sendMessage: (text: string, claudeSettings: ClaudeSettings) => Promise<boolean>
  /** Interrupts Claude's work on the last message. */
  stopClaude: () => void
  /** Keeps the change that is being previewed. */
  confirmChange: () => void
  /** Abandons the change, and ends the conversation about it. */
  discardChange: () => void
}

/**
 * Keeps this screen in step with the change that is being made to the site, which every screen shares. Claude's
 * progress, and anything done on another screen, appears here within a second or so.
 *
 * None of the actions throw. One that the API refuses, or that can't reach it, is explained by `refusal`.
 *
 * @returns The change, the history, and the actions.
 */
export function useSiteEditor(): SiteEditor {
  const queryClient = useQueryClient()
  const changeQuery = useQuery({
    queryKey: CHANGE_QUERY_KEY,
    queryFn: siteEditorApi.getChange,
    refetchInterval: CHANGE_REFRESH_INTERVAL_MILLISECONDS,
  })
  const commitsQuery = useQuery({
    queryKey: COMMITS_QUERY_KEY,
    queryFn: siteEditorApi.listCommits,
    refetchInterval: COMMITS_REFRESH_INTERVAL_MILLISECONDS,
  })
  const [refusal, setRefusal] = useState<string | null>(null)

  const act = async (action: () => Promise<void>): Promise<boolean> => {
    try {
      await action()
      setRefusal(null)
      return true
    } catch (error) {
      // Both documented errors leave the change as it was, so all there is to do is tell the person. Anything else is
      // a bug, which must not be hidden.
      if (error instanceof siteEditorApi.ActionRefusedError) setRefusal(error.message)
      else if (error instanceof siteEditorApi.SiteEditorUnavailableError) setRefusal("The site editor can't be reached. Try again in a moment.")
      else throw error
      return false
    } finally {
      // Shows the effect of the action straight away, rather than at the next refresh.
      void queryClient.invalidateQueries({ queryKey: CHANGE_QUERY_KEY })
    }
  }

  return {
    change: changeQuery.data,
    commits: commitsQuery.data,
    isUnavailable: changeQuery.isError,
    refusal,
    sendMessage: (text, claudeSettings) => act(() => siteEditorApi.sendMessage(text, claudeSettings)),
    stopClaude: () => void act(siteEditorApi.stopClaude),
    confirmChange: () => void act(siteEditorApi.confirmChange),
    discardChange: () => void act(siteEditorApi.discardChange),
  }
}
