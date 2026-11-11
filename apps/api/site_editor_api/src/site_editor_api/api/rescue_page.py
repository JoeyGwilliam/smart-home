# A page that needs nothing from the site's own app, for discarding a change that has broken it. It asks for the
# change at addresses relative to its own, so it works wherever the API is mounted.
RESCUE_PAGE = """<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Site editor rescue</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
        button { font-size: 1.1rem; padding: 0.6rem 1.2rem; }
        li { white-space: pre-wrap; margin-bottom: 0.5rem; }
    </style>
</head>
<body>
    <h1>Site editor rescue</h1>
    <p>If a change has broken the site, discard it here. The site is put back as it was at the last saved change.</p>
    <p>State: <strong id="state">loading…</strong></p>
    <button id="discard" disabled>Discard the change</button>
    <p id="refusal" role="alert"></p>
    <h2>Latest progress</h2>
    <ol id="events"></ol>
    <script>
        const LATEST_EVENT_COUNT = 5
        const stateText = document.getElementById('state')
        const discardButton = document.getElementById('discard')
        const refusal = document.getElementById('refusal')
        const eventList = document.getElementById('events')

        async function showChange() {
            try {
                const change = await (await fetch('change', { cache: 'no-store' })).json()
                stateText.textContent = change.state
                discardButton.disabled = !['discussing', 'reviewing'].includes(change.state)
                eventList.replaceChildren(...change.events.slice(-LATEST_EVENT_COUNT).map((event) => {
                    const item = document.createElement('li')
                    item.textContent = `${event.kind}: ${event.text}`
                    return item
                }))
            } catch {
                stateText.textContent = 'the site editor cannot be reached'
            }
        }

        discardButton.addEventListener('click', async () => {
            const response = await fetch('change/discard', { method: 'POST' })
            refusal.textContent = response.ok ? '' : (await response.json()).detail
            await showChange()
        })

        showChange()
        setInterval(showChange, 1000)
    </script>
</body>
</html>
"""
