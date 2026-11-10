import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { SettingsMenu } from '@/components/SettingsMenu'

test('shows a setting\'s choices only once that setting is picked', async () => {
  const user = userEvent.setup()
  render(<SettingsMenu />)
  await user.click(screen.getByRole('button', { name: 'Settings' }))
  expect(screen.queryByRole('menuitemradio', { name: 'Sunrise' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('menuitem', { name: 'Time of day' }))

  expect(screen.getByRole('menuitemradio', { name: 'Sunrise' })).toBeInTheDocument()
})

test('hides the time of day choices when the weather choices are opened', async () => {
  const user = userEvent.setup()
  render(<SettingsMenu />)
  await user.click(screen.getByRole('button', { name: 'Settings' }))
  await user.click(screen.getByRole('menuitem', { name: 'Time of day' }))

  await user.click(screen.getByRole('menuitem', { name: 'Weather' }))

  expect(screen.queryByRole('menuitemradio', { name: 'Sunrise' })).not.toBeInTheDocument()
  expect(screen.getByRole('menuitemradio', { name: 'Rain' })).toBeInTheDocument()
})

test('hides a setting\'s choices when that setting is picked again', async () => {
  const user = userEvent.setup()
  render(<SettingsMenu />)
  await user.click(screen.getByRole('button', { name: 'Settings' }))
  await user.click(screen.getByRole('menuitem', { name: 'Weather' }))

  await user.click(screen.getByRole('menuitem', { name: 'Weather' }))

  expect(screen.queryByRole('menuitemradio', { name: 'Rain' })).not.toBeInTheDocument()
})
