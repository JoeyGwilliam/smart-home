# Morrisons MCP server

An [MCP](https://modelcontextprotocol.io) server that lets a Claude agent shop at
[groceries.morrisons.com](https://groceries.morrisons.com): search for products, see offers, and fill or empty a
trolley. **It cannot order anything.** A person reviews the trolley and checks out themselves.

See [PLAN.md](PLAN.md) for how it is meant to be used by the shopping list page.

## Tools

| Tool                     | What it does                                                                                   |
|--------------------------|------------------------------------------------------------------------------------------------|
| `search_products`        | Searches by plain words, optionally only products on offer. Gives price, size, price per unit, offer, rating. |
| `list_products_in_offer` | Lists every product in one offer, such as all the milks in "Buy 2 for £4".                     |
| `list_featured_offers`   | Lists what Morrisons is promoting on its offers page.                                          |
| `add_to_trolley`         | Adds a product, found by a recent search, and returns the trolley.                             |
| `remove_from_trolley`    | Takes some or all of a product out, and returns the trolley.                                   |
| `view_trolley`           | Lines with quantities, offers and multi-buy progress (`1/2`), savings, total and shortfall to the £25 minimum spend. |
| `empty_trolley`          | Starts afresh.                                                                                 |

## Why it can't order

Three independent layers, so that no single mistake could place an order:

1. **No tool exists** for checking out, booking a slot or paying.
2. **The browser itself is guarded.** `core/ordering_guard.py` decides on every request the browser makes. Anything
   with `checkout`, `orders`, `payment` or `slots` in its path is refused, and so is any request that changes something
   unless it is on a short allow-list (the trolley, the delivery location, the site's own analytics). GraphQL requests
   are only let through if they are queries, never mutations. A refused request is logged as a warning on stderr.
3. **A person orders.** The agent is told it can't, and nothing in the trolley is paid for until someone does it at
   Morrisons.

Logging in is a person's job, never the agent's: no tool logs in, and the agent never sees a password.
`MorrisonsBrowser.let_person_log_in` opens an ordinary browser window at the login page for a person at the machine,
and copies its Morrisons cookies every couple of seconds until they close it (see `core/login_window.py`). They are
copied while it is open because the shop keeps its login in a cookie that the browser deletes as it closes. Nothing automates that window, because Morrisons' login page has a
check for robots that refuses an automated browser, so it has none of the guards above: it is the person's to use, as
their own browser would be. It has a profile of its own, in the state folder, which shares nothing with the person's
everyday browser. The shopper API (`apps/api/shopper_api`) is what opens it, from the shopping list page's "Log in"
button.

If Morrisons changes its website so that something legitimate starts being refused, the symptom is a
`Blocked ... as it could place an order` warning. Fix it by adding that exact request to the allow-list on purpose.

## Setting up

```
cd apps/mcp/morrisons_mcp
cp .env.example .env        # then put your postcode and address line in it
uv sync
uv run playwright install chromium     # or set MORRISONS_BROWSER_CHANNEL=msedge (or chrome) to use an installed one
uv run pytest
```

Tell Claude Code about it (use absolute paths):

```
claude mcp add morrisons -- uv run --directory C:/path/to/apps/mcp/morrisons_mcp --env-file C:/path/to/apps/mcp/morrisons_mcp/.env morrisons-mcp
```

To run an agent with nothing but these tools, which is how the shopping feature should use it:

```
claude -p --strict-mcp-config --mcp-config morrisons.json --tools "" --allowedTools "mcp__morrisons" "Add milk and eggs..."
```

### What is kept between runs

The first use opens the shop in a headless browser, rejects optional cookies and sets the delivery location. The
browser's cookies, which include the trolley, the delivery location and any login, are saved to `~/.morrisons_mcp/`
(or `MORRISONS_STATE_DIRECTORY`), so a restart keeps the trolley. Whoever can read that folder can use any login kept
in it. `MorrisonsBrowser.log_out` forgets all of it.

## Checking it still works

Morrisons can change its website at any time. The tests that use the real website are skipped unless asked for:

```
MORRISONS_LIVE_TESTS=1 uv run --env-file .env pytest tests/core/test_morrisons_shop.py
```

Everything that knows what the website's markup looks like is in `core/product_card.py` (reading product cards) and
`core/morrisons_shop.py` / `core/morrisons_browser.py` (the buttons and pages). Cards are found by the site's own
`data-test` attributes, which are far more stable than its CSS class names.

## What it learned about the website

- It is Ocado's platform, served as a React app. Search is `/search?q=...` (`&boolean=onOffer` for offers only), the
  trolley is `/basket`, offers are `/offers/<name>/<id>`. Product cards look the same everywhere.
- Adding to the trolley is a `POST` to `/api/cart/v1/carts/active/apply-quantity` that carries a *change* in quantity.
  Typing a number in the quantity box sets an exact quantity, and 0 removes the product.
- Before choosing a delivery location the shop shows its own default address in Hertfordshire. Everything that depends
  on it, including prices and stock, is wrong until the real one is chosen, which is why that is done first.
- Guests can fill a trolley without logging in. The trolley is tied to the browser's cookies.
- `robots.txt` disallows `/api/` for crawlers, so this drives the site's pages the way a person would, rather than
  calling those endpoints directly.

## Known limits

- **Product detail pages (`/products/...`) can't be read.** Morrisons' CDN returns `403` to a headless browser for those
  pages (it works in a visible one, and in `curl`), while search, offers and the trolley are fine. Search results already
  give the price, size, unit price, offer and rating, but not ingredients, allergens or nutrition. This server does not
  try to get around the block. See the open questions in PLAN.md.
- One trolley, one browser: tool calls are taken in turn, and each takes a few seconds.
- A guest trolley only exists in this server's browser. Seeing it on a phone needs a logged-in account.
- Whether the browser is logged in is told from the header: a guest is offered a button that says just "Log in".
  That has been checked as a guest, but not yet with a real login, and nor has shopping while logged in. If the shop
  needs requests while logged in that the allow-list refuses, they show as `Blocked` warnings, as above.
