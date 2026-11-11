import { render, screen } from '@testing-library/react'

import { HOME_HUB_CONTROL_GROUPS } from '@/alexa/homeHubSkill'
import { AlexaControlsPage } from '@/pages/alexaControls/AlexaControlsPage'

test('shows every group of the real skill when the page is opened', () => {
  render(<AlexaControlsPage />)

  const shownTitles = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
  expect(shownTitles).toEqual(['How to start', ...HOME_HUB_CONTROL_GROUPS.map((group) => group.title)])
})
