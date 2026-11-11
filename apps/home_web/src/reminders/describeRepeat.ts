import type { Repeat } from '@/reminders/reminder'

/** Every way a reminder can repeat, in order of how often, each with how it is described to the person. */
export const REPEAT_DESCRIPTIONS: Record<Repeat, string> = {
  daily: 'Every day',
  weekly: 'Every week',
  fortnightly: 'Every 2 weeks',
  monthly: 'Every month',
  yearly: 'Every year',
}
