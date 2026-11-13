# Home web

The pages for the home's screens, as one React + TypeScript app:

- `/`: the dashboard, with the time, the weather in Bristol, and the reminders due today.
- `/reminders`: the reminders viewer, for adding, editing, ticking off and deleting reminders.
- `/adhd-timer`: a timer for getting ready on time. Tasks are stacked back from the time to be ready by and drawn as a
  ring; once started, a hand follows the time around it and each task is read aloud as it begins. Every screen shows
  the same timer, so it can be started on a phone and followed on the kiosk.
- `/word-of-the-day`: an English idiom, a Spanish word and a Mandarin word, which change each day.
- `/site-editor`: changes this site by asking Claude for what you want. Claude edits the code on the home server, and
  the site is rebuilt to show the change without saving it. It can then be kept, which commits and pushes it,
  discarded, or refined by carrying on the conversation. The page also lists the site's commit history.

Moving between pages is animated with view transitions (see `src/index.css`).

## Adding a page

1. Create its component in `src/pages/<name>/`.
2. Add it to `PAGES` in `src/pages/pages.ts`. That routes to it and lists it in the pages menu.

## Where things live

- `src/homeApi/`: how every API client below sends its requests, and the two ways that all of the home's APIs fail.
- `src/reminders/`: the reminders API client, and the rules for ordering and describing reminders.
- `src/timers/`: the timers API client, the rules for scheduling a timer's tasks and following its progress, and the
  hooks that keep a screen in step with the presets and with the timer that every screen shares.
- `src/weather/`: the forecast, fetched by the browser straight from [Open-Meteo](https://open-meteo.com), which needs
  no key.
- `src/words/`: the idioms and words that take turns as the word of the day, and the rule for whose turn it is.
- `src/siteEditor/`: the site editor API client, and the hook that keeps a screen in step with the change being made.
- `src/scene/`: what the backdrop behind every page shows: the time of day and the weather, either live or as chosen in
  the settings.
- `src/settings/`: per-device settings, such as the backdrop's weather, remembered by the browser.
- `src/components/`: pieces that pages share, such as `ReminderList`. `src/components/ui/` holds components generated
  by shadcn/ui (`npx shadcn@latest add <name>`); they are ours to restyle.

The app calls the APIs under `/api` on its own origin: the timers API under `/api/timers`, the site editor API under
`/api/site-editor`, and the reminders API under everything else. In development Vite forwards those calls to
`localhost:8001`, `localhost:8002` and `localhost:8000` (see `vite.config.ts`); in Docker, nginx forwards them to the
`timers-api` and `reminders-api` services, and to the site editor API on the machine itself (see `nginx.conf`).

The site editor API is the only one that doesn't run in a container: it works on the server's checkout of this
repository, rebuilds the containers, and uses the server's Claude Code login. `start_site_editor.bat`, in the
repository's root, starts it. Every screen shares the one change being made, like the timer. While a change is being
previewed, the whole site shows it. If a change breaks the site so badly that the editor page can't be used, it can
still be discarded at `/api/site-editor/rescue`.

The ADHD timer reads tasks aloud with the browser's own speech, on every screen that has the page open. Most browsers
only allow speech once something on the page has been pressed, so a screen stays silent if nobody has touched it since
it loaded: one that only follows a timer started elsewhere, or one that has reloaded itself part of the way through.

Due times are shown in the time zone of the device displaying the page, so set the kiosk's clock and time zone
correctly.

## Development

From this directory, with the reminders API running on port 8000 and the timers API on port 8001:

    npm install
    npm run dev

## Checks

    npm test        # runs the tests in tests/, which mirrors src/
    npm run build   # type-checks, then builds into dist/
    npm run lint
