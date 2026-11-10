import { useEffect } from 'react'

// A deploy should show up on the screen almost as soon as it finishes.
const CHECK_INTERVAL_MILLISECONDS = 1000

/**
 * Reloads the page once a newer build of the app has been deployed, so that a screen left open always shows the
 * latest version. Does nothing in development, where Vite already reloads changed code.
 */
export function useReloadOnNewBuild() {
  useEffect(() => {
    if (!import.meta.env.PROD) return

    const interval = setInterval(async () => {
      if (await isNewerBuildServed()) window.location.reload()
    }, CHECK_INTERVAL_MILLISECONDS)
    return () => clearInterval(interval)
  }, [])
}

/**
 * Checks whether the server is serving a different build from the one this page was loaded from.
 *
 * @returns True only when the server confirms a different build. False when it is serving this build, or can't be
 *   reached or understood, as happens while it restarts.
 */
export async function isNewerBuildServed(): Promise<boolean> {
  try {
    // The timeout stops checks piling up while the server is too slow to answer.
    const response = await fetch('/build-id.json', { cache: 'no-store', signal: AbortSignal.timeout(CHECK_INTERVAL_MILLISECONDS) })
    if (!response.ok) return false
    const { buildId } = await response.json()
    return typeof buildId === 'string' && buildId !== __BUILD_ID__
  } catch {
    // Failing to check only means trying again on the next check, so the failure has nothing to report.
    return false
  }
}
