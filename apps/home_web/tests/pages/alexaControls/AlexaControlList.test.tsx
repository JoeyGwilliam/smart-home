import { render, screen, within } from '@testing-library/react'

import type { AlexaControl } from '@/alexa/alexaControls'
import { AlexaControlList } from '@/pages/alexaControls/AlexaControlList'

test('explains how to start with the invocation name when shown', () => {
  render(<AlexaControlList invocationName="home hub" controls={[]} />)

  const howToStart = within(screen.getByRole('region', { name: 'How to start' }))
  expect(howToStart.getByText('“Alexa, ask home hub”')).toBeInTheDocument()
  expect(howToStart.getByText('“Alexa, open home hub”')).toBeInTheDocument()
})

test('shows a control with its description and every phrase when the control is listed', () => {
  const control: AlexaControl = {
    intent: 'ListRemindersIntent',
    title: "Hear what's due",
    description: 'Reads out the reminders that are due today.',
    answers: null,
    phrases: [[{ text: "what's due today", isStandIn: false }], [{ text: 'read my reminders', isStandIn: false }]],
  }

  render(<AlexaControlList invocationName="home hub" controls={[control]} />)

  const card = within(screen.getByRole('region', { name: "Hear what's due" }))
  expect(card.getByText('Reads out the reminders that are due today.')).toBeInTheDocument()
  expect(card.getAllByRole('listitem').map((phrase) => phrase.textContent)).toEqual(["what's due today", 'read my reminders'])
})

test('marks out the stand-ins of a phrase when the phrase has them', () => {
  const control: AlexaControl = {
    intent: 'SetDueTimeIntent',
    title: 'Give the due time',
    description: null,
    answers: null,
    phrases: [
      [
        { text: 'on ', isStandIn: false },
        { text: 'a day', isStandIn: true },
      ],
    ],
  }

  render(<AlexaControlList invocationName="home hub" controls={[control]} />)

  const phrase = screen.getByRole('listitem')
  expect(phrase).toHaveTextContent('on a day')
  expect(within(phrase).getByText('a day').tagName).toBe('EM')
  expect(within(phrase).getByText('on').tagName).not.toBe('EM')
})

test('says which question a control answers when it answers one', () => {
  const control: AlexaControl = {
    intent: 'NoDueTimeIntent',
    title: 'Skip the due time',
    description: null,
    answers: 'When is it due?',
    phrases: [[{ text: 'no time', isStandIn: false }]],
  }

  render(<AlexaControlList invocationName="home hub" controls={[control]} />)

  const card = within(screen.getByRole('region', { name: 'Skip the due time' }))
  expect(card.getByText('When it asks “When is it due?”')).toBeInTheDocument()
})

test('says nothing about a question when a control can be used at any time', () => {
  const control: AlexaControl = {
    intent: 'ListRemindersIntent',
    title: "Hear what's due",
    description: null,
    answers: null,
    phrases: [[{ text: "what's due today", isStandIn: false }]],
  }

  render(<AlexaControlList invocationName="home hub" controls={[control]} />)

  expect(screen.queryByText(/When it asks/)).not.toBeInTheDocument()
})
