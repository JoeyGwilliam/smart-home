# Plan: "Generate Morrisons basket"

From pressing the button on the Shopping list page to a trolley that is ready for a person to check out.

## Where things stand

The hard, uncertain part is done: `morrisons_mcp` (this folder) lets an agent search, read offers, and fill and empty a
trolley at groceries.morrisons.com, and cannot order. A real Claude agent has used it to do a small shop and then say
that it couldn't order. What is left is everything around it: a service that runs the agent, a page to start and review
it, and getting the trolley in front of a person.

## The flow, end to end

```
Shopping list page                    shopper_api (new, outside Docker)            Claude agent + Morrisons MCP
------------------                    ----------------------------------            ----------------------------
[Generate Morrisons basket] ───────▶  1. fetch the basket's list_shopping()
                                         from shopping_api, and freeze it
                                      2. create a run, status "shopping"
                                      3. start `claude -p` with ONLY the     ───▶  4. empty_trolley
                                         Morrisons tools, a prompt with           5. per item: search_products (and
                                         the frozen list + preferences               only_on_offer), compare, add_to_trolley
◀── progress events (SSE) ──────────     stream-json events → run events          6. check offer_progress; top up multi-buys
                                                                                  7. view_trolley, then a final JSON report
                                      8. check the report against the real   ◀──
                                         trolley (read it again, don't trust)
                                      9. save the result, status "ready"
Review panel: for each list item,
the chosen product, price, offer,
and why; unmatched items; total,
savings, shortfall to £25
[Open Morrisons to check out] ─────▶  A person picks a delivery slot and pays on Morrisons' own site/app.
```

Nothing after step 9 involves the agent. The person reviews, swaps anything they dislike, picks a slot and pays.

## Design decisions (each considered against an alternative)

**1. Who chooses the products?**

| | What it is | For | Against |
|---|---|---|---|
| **A. Agent in the loop** (recommended) | Claude is given the list and the tools, and shops | Handles "500g lamb mince" vs 2×250g packs, brand/offer trade-offs, no result for a word, substitutes; adapts when the site shifts a little | Slower (about a minute or two for ten items) and costs tokens; varies run to run |
| B. Code searches, Claude only picks | Code runs `search_products` for each line; one cheap model call per line picks from the candidates | Cheaper, quicker (can search in parallel), more predictable, easy to test | Pack-size arithmetic and multi-buy top-ups still need judgement, so most of A gets rebuilt in code; two kinds of failure to handle |

Start with A because the MCP server already exists and the uncertainty is in what the agent *chooses*, which is quickest
to learn by watching it. The tools are the same under B, so moving to it later is a change to the runner only.

**2. Where does it run?** A new `shopper_api`, outside Docker, like `site_editor_api`, because it needs this machine's
Claude login and a browser. Not inside `shopping_api`, which stays a small store of the basket with no knowledge of
Morrisons. `shopper_api` reads the list from `shopping_api` itself, so the web page only says "go".

**3. How does the page follow the run?** The same way the site editor does: server-sent events of progress, plus a
`GET` for the stored result, so a reload or a second screen can pick the run up again.

**4. Where is the human?** After the run. The page never offers a way to check out; the link goes to Morrisons.

## What the agent is asked to do

A system prompt owned by `shopper_api` (the MCP server's own instructions already teach it the tools):

- Shop for exactly the frozen list and nothing else. Start with `empty_trolley`.
- For each item: search, look at several results, choose by price per unit unless the item says otherwise, prefer a
  product with an offer if it is a fair match, and say when an offer decided it.
- Quantities: buy enough to cover the amount written ("500g" → one 500g pack, or two 250g if that's cheaper), and the
  quantity in the basket line for how many dishes.
- If nothing fits, don't guess: report the item as not found.
- Finish with a JSON report that matches a schema `shopper_api` supplies (`--json-schema`): per list item, the product
  ids bought and quantities, the reason, the offer if any, the alternatives considered; plus anything it wants a person
  to look at.
- Hard rules: only the Morrisons tools exist; do not try anything that looks like checking out.

The runner is `claude -p --strict-mcp-config --mcp-config <morrisons only> --tools "" --allowedTools mcp__morrisons
--max-budget-usd N`. With no built-in tools the agent can't touch files or the shell, only shop.

## Safety, in layers

1. No checkout tool exists.
2. The browser is guarded by `ordering_guard.py`: anything about checkout or payment, and any change not on a short
   list, is refused (see the README). This holds even if the agent were somehow made to try.
3. The agent has no other tools (`--tools ""`).
4. `shopper_api` caps the run: a model-cost limit (`--max-budget-usd`), a time limit, and a ceiling on the trolley
   total, so a run that comes to far more than expected is flagged instead of shown as fine.
5. The final report is checked against `view_trolley` read by code, not taken on trust.
6. A person pays.

## Milestones

| | Deliverable | Notes |
|---|---|---|
| **M0 (done)** | `morrisons_mcp`: tools, guard, tests, live tests | Guest trolley, address BS6 5SJ / 62 Sydenham Road chosen automatically |
| **M1** | `shopper_api`: run lifecycle (start, progress, result, stop), the Claude runner, the prompt, result schema | Reuse the pattern of `site_editor_api`'s `ClaudeSession`; test with a fake `claude`, as it does |
| **M2** | Page: the button, live progress, a review panel | Review shows each list item with its product, price, offer and reason, plus "not found" items and the totals |
| **M3** | **Login**, then preferences from past orders | See below. Without login, the trolley can't leave the server's browser |
| **M4** | Hand-off: a reminder through the reminders API ("Your Morrisons trolley is ready") and a link | Optional, but it closes the loop |

### M3: login and preferences

- **Login is a person's job, not the agent's.** Add a command, `morrisons-mcp login`, that opens a *visible* browser on the
  server, lets the person log in once (including any two-step check), and saves the session to the state folder. The
  agent's server never sees the password and has no tool that logs in. The login requests are allowed only in that
  command's own guard, never in the agent's.
- With a login, the trolley is the account's trolley, so the person sees it on their phone and can check out there.
- New **read-only** tools for what the account knows: `list_favourites`, `list_regulars`, `list_previous_orders`. The
  agent is told to prefer what the household has bought before, and the review panel says "bought before".
- `shopper_api` keeps a small preferences file (brands to prefer or avoid, "always organic eggs"), built from swaps
  made on the review panel, and puts it in the prompt.

## Risks and questions for you

1. **Product pages are blocked for headless browsers.** Morrisons' CDN answers `403` to headless clients on `/products/...`.
   A visible browser gets through, but I did not switch to one to get round the block, as that is defeating a bot check
   and not what you asked for. Search results already give what shopping needs. Allergens, ingredients and nutrition would
   need those pages, which matters if the household has dietary rules. Decision for you: live without them, ask
   Morrisons, or run a visible browser on the server knowing it sidesteps their check.
2. **Their terms.** `robots.txt` disallows `/api/` for crawlers, and I haven't read Morrisons' terms of use for
   automated shopping. This drives the pages like a person, at a human pace, for one household, but it is worth you
   reading their terms before it is used every week.
3. **Emptying the trolley.** `empty_trolley` is right for a throwaway guest trolley. On a logged-in account it would
   delete things the person put there themselves. Once there is a login, runs should refuse to start on a non-empty
   trolley (or add to it and say so) instead.
4. **Pantry staples.** Should "salt", "olive oil" and "plain flour" from recipes be bought every time? Probably a
   per-item "I always have this" list, kept in `shopper_api`.
5. **Website changes.** The server reads the site by its own `data-test` attributes, which are stable, but a redesign
   will break something. The opt-in live tests are the early warning; running them weekly on a schedule would catch it
   before Sunday's shop.
6. **Substitutions and stock.** Out-of-stock items show as `is_available: false`. The prompt covers a sensible
   substitute, and the review panel must label substitutes clearly.
7. **Delivery slot and the £25 minimum.** Slots are not chosen by the agent. The shortfall to the minimum is reported
   so the page can say "add £3.20 more".
8. **Cost per run.** Likely tens of tool calls on Sonnet. Worth measuring on a real week's list, then deciding between A
   and B above.

## Suggested next step

Build M1 and M2 against the guest trolley, run it on a real week's list a few times, and read the agent's reasons on the
review panel. That shows whether the choices are good enough to be worth building login (M3) for.
