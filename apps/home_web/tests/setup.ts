import '@testing-library/jest-dom/vitest'

// jsdom doesn't lay pages out, so it has no scrolling. Dialogs call scrollTo when they open, which would only log noise.
window.scrollTo = () => {}
// For the same reason, elements can't be scrolled into view, which the site editor does to follow a conversation.
Element.prototype.scrollIntoView = () => {}
