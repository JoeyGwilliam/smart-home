# Home web

The pages for the home's screens, as one React + TypeScript app:

- `/`: the dashboard, with the time, the weather in Bristol, and the reminders due today.
- `/reminders`: the reminders viewer, for adding, editing, ticking off and deleting reminders.

Moving between pages is animated with view transitions (see `src/index.css`).

## Adding a page

1. Create its component in `src/pages/<name>/`.
2. Add it to `PAGES` in `src/pages/pages.ts`. That routes to it and lists it in the pages menu.

## Where things live

- `src/reminders/`: the reminders API client, and the rules for ordering and describing reminders.
- `src/weather/`: the forecast, fetched by the browser straight from [Open-Meteo](https://open-meteo.com), which needs
  no key.
- `src/scene/`: what the backdrop behind every page shows: the time of day and the weather, either live or as chosen in
  the settings.
- `src/settings/`: per-device settings, such as the backdrop's weather, remembered by the browser.
- `src/components/`: pieces that pages share, such as `ReminderList`. `src/components/ui/` holds components generated
  by shadcn/ui (`npx shadcn@latest add <name>`); they are ours to restyle.

The app calls the reminders API under `/api` on its own origin. In development Vite forwards those calls to
`localhost:8000` (see `vite.config.ts`); in Docker, nginx forwards them to the `reminders-api` service (see
`nginx.conf`).

Due times are shown in the time zone of the device displaying the page, so set the kiosk's clock and time zone
correctly.

## Development

From this directory, with the reminders API running on port 8000:

    npm install
    npm run dev

## Checks

    npm test        # runs the tests in tests/, which mirrors src/
    npm run build   # type-checks, then builds into dist/
    npm run lint
