# Smart home

The home's own website and the services behind it. Everything runs on the home server, and most of it in Docker.

## The parts

- `apps/home_web`: every page for the home's screens, as one React app: the dashboard, clock, reminders, ADHD timer,
  recipes, word of the day, Alexa controls and site editor. See its README for the pages and where their code lives.
- `apps/api/reminders_api`: holds the reminders, and owns the rules for a valid reminder and for repeating ones.
- `apps/api/timers_api`: holds the ADHD timer's saved presets, and the one timer that every screen shows.
- `apps/api/recipes_api`: holds the recipes and their pictures, and owns the rules for a valid recipe, so that any page,
  such as a future shopping list, can use them.
- `apps/api/alexa_api`: the home's Alexa skill, which lets people work the reminders, the timer and the site editor by
  talking to an Echo. It is the only part that the internet can reach without a login. `skill/` holds what the skill
  understands, which `update_alexa_skill.bat` sends to Amazon.
- `apps/api/site_editor_api`: changes this site by asking Claude Code, for the site editor page. It is the only part
  that runs outside Docker, because it works on this checkout and rebuilds the containers.

Each API has the same layout: `src/<name>/core` holds what it knows and does, `src/<name>/api` exposes that over HTTP,
and `tests` mirrors `src`.

## How they fit together

The browser only ever talks to `home_web`, which forwards `/api/...` to the reminders, timers, recipes and site editor APIs
(see `apps/home_web/nginx.conf`). The Alexa skill uses those same three APIs rather than their data, so each API stays
the one owner of its rules. It asks them for what it wants done, such as ticking off a reminder or starting the timer,
and needs to know nothing else about what they hold.

One rule has to exist twice: the ADHD timer page and the Alexa skill each work out when a timer's tasks start, in
TypeScript and in Python. Both are tested against the same examples, in
`apps/api/timers_api/timer-schedule-examples.json`, so a change to the rule starts there.

## Running it

- On the home server: `docker compose up -d --build` (see `compose.yaml`), and `start_site_editor.bat` for the site
  editor. `update_server.bat` does the first of these from another machine.
- For development: see `compose.dev.yaml` for the APIs, and `apps/home_web/README.md` for the pages.
- Settings that belong to one machine, such as `HOME_WEB_BIND_ADDRESS` and the Cloudflare tunnel's token, go in a
  git-ignored `.env` file beside `compose.yaml`, which explains each of them.

## Checks

- Each API: `uv run pytest`, from its own directory.
- The pages: `npm test`, `npm run build` and `npm run lint`, from `apps/home_web`.
