import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { AlexaControl } from '@/alexa/alexaControls'
import { AlexaControlList } from '@/pages/alexaControls/AlexaControlList'

function createControl(changes: Partial<AlexaControl>): AlexaControl {
  return {
    intent: 'ListRemindersIntent',
    title: 'Check reminders',
    description: null,
    answers: null,
    phrases: [[{ text: "what's due today", isStandIn: false }]],
    ...changes,
  }
}

test('explains how to start with the invocation name when shown', () => {
  render(<AlexaControlList invocationName="home hub" groups={[]} />)

  const howToStart = within(screen.getByRole('region', { name: 'How to start' }))
  expect(howToStart.getByText('“Alexa, ask home hub”')).toBeInTheDocument()
  expect(howToStart.getByText('“Alexa, open home hub”')).toBeInTheDocument()
})

test('shows only the group names, each with how many controls it has, when nothing has been opened', () => {
  const groups = [
    { title: 'Reminders', controls: [createControl({ intent: 'A', title: 'Add a reminder' }), createControl({ intent: 'B', title: 'Check reminders' })] },
    { title: 'Timers', controls: [createControl({ intent: 'C', title: 'Stop the timer' })] },
  ]

  render(<AlexaControlList invocationName="home hub" groups={groups} />)

  expect(screen.getByRole('heading', { level: 2, name: 'Reminders' })).toBeVisible()
  expect(screen.getByRole('heading', { level: 2, name: 'Timers' })).toBeVisible()
  expect(screen.getAllByRole('group').map((foldedPart) => foldedPart.querySelector('summary')?.textContent)).toEqual(
    expect.arrayContaining(['Reminders2', 'Timers1']),
  )
  expect(screen.getByText('Add a reminder')).not.toBeVisible()
  for (const phrase of screen.getAllByText("what's due today")) expect(phrase).not.toBeVisible()
})

test('shows the names of a group’s controls, but not their phrases, when the group is opened', async () => {
  const groups = [{ title: 'Reminders', controls: [createControl({ title: 'Check reminders' })] }]
  render(<AlexaControlList invocationName="home hub" groups={groups} />)

  await userEvent.click(screen.getByRole('heading', { level: 2, name: 'Reminders' }))

  expect(screen.getByRole('heading', { level: 3, name: 'Check reminders' })).toBeVisible()
  expect(screen.getByText("what's due today")).not.toBeVisible()
})

test('shows a control’s description and every phrase when the control is opened', async () => {
  const control = createControl({
    title: 'Check reminders',
    description: 'Reads out the reminders that are due today.',
    phrases: [[{ text: "what's due today", isStandIn: false }], [{ text: 'read my reminders', isStandIn: false }]],
  })
  render(<AlexaControlList invocationName="home hub" groups={[{ title: 'Reminders', controls: [control] }]} />)

  await userEvent.click(screen.getByRole('heading', { level: 2, name: 'Reminders' }))
  await userEvent.click(screen.getByRole('heading', { level: 3, name: 'Check reminders' }))

  expect(screen.getByText('Reads out the reminders that are due today.')).toBeVisible()
  const phrases = within(screen.getByRole('list', { name: 'Ways to say “Check reminders”' })).getAllByRole('listitem')
  expect(phrases.map((phrase) => phrase.textContent)).toEqual(["what's due today", 'read my reminders'])
  expect(phrases[0]).toBeVisible()
})

test('folds a control away again when it is clicked a second time', async () => {
  const groups = [{ title: 'Reminders', controls: [createControl({ title: 'Check reminders' })] }]
  render(<AlexaControlList invocationName="home hub" groups={groups} />)
  await userEvent.click(screen.getByRole('heading', { level: 2, name: 'Reminders' }))
  await userEvent.click(screen.getByRole('heading', { level: 3, name: 'Check reminders' }))

  await userEvent.click(screen.getByRole('heading', { level: 3, name: 'Check reminders' }))

  expect(screen.getByText("what's due today")).not.toBeVisible()
})

test('marks out the stand-ins of a phrase when the phrase has them', () => {
  const control = createControl({
    phrases: [
      [
        { text: 'on ', isStandIn: false },
        { text: 'a day', isStandIn: true },
      ],
    ],
  })

  render(<AlexaControlList invocationName="home hub" groups={[{ title: 'Reminders', controls: [control] }]} />)

  const phrase = screen.getByRole('listitem', { hidden: true })
  expect(phrase).toHaveTextContent('on a day')
  expect(within(phrase).getByText('a day').tagName).toBe('EM')
  expect(within(phrase).getByText('on').tagName).not.toBe('EM')
})

test('says which question a control answers when it answers one', () => {
  const control = createControl({ title: 'Skip the due time', answers: 'When is it due?' })

  render(<AlexaControlList invocationName="home hub" groups={[{ title: 'Reminders', controls: [control] }]} />)

  expect(screen.getByText('When it asks “When is it due?”')).toBeInTheDocument()
})

test('says nothing about a question when a control can be used at any time', () => {
  const control = createControl({ answers: null })

  render(<AlexaControlList invocationName="home hub" groups={[{ title: 'Reminders', controls: [control] }]} />)

  expect(screen.queryByText(/When it asks/)).not.toBeInTheDocument()
})
