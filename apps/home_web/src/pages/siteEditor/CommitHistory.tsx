import { formatDistanceToNow } from 'date-fns'

import type { Commit } from '@/siteEditor/change'

/** The site's saved changes, newest first, so that what has changed, and when, can be traced. */
export function CommitHistory({ commits }: { commits: Commit[] }) {
  return (
    <ol className="grid gap-3">
      {commits.map((commit) => (
        <li key={commit.hash} className="grid gap-0.5">
          <p className="font-semibold break-words">{commit.subject}</p>
          <p className="text-sm text-muted-foreground">
            <code>{commit.hash.slice(0, 7)}</code> · {commit.author} ·{' '}
            <time dateTime={commit.committedAt.toISOString()}>{formatDistanceToNow(commit.committedAt, { addSuffix: true })}</time>
          </p>
        </li>
      ))}
    </ol>
  )
}
