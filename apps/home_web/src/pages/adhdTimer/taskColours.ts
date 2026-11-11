// The highlight colours from index.css, which stay light in both colour schemes, so dark text always sits on them.
const TASK_COLOURS = ['var(--peach)', 'var(--butter)', 'var(--mint)', 'var(--sky)', 'var(--lavender)', 'var(--primary)']

/**
 * Picks the colour that stands for a task wherever it is shown, so that the dial and the list of tasks can be matched
 * up at a glance.
 *
 * @param taskPosition The task's position in its plan, counting from 0.
 * @returns A CSS colour. Tasks next to each other get different colours.
 */
export function pickTaskColour(taskPosition: number): string {
  return TASK_COLOURS[taskPosition % TASK_COLOURS.length]
}
