/** One step of getting ready, such as "Doing makeup". */
export interface TimerTask {
  /** Tells the task apart from the others in its plan, and stays the same when the task is edited or moved. A UUID. */
  id: string
  /** What to do. Blank while it is still being written. */
  name: string
  /** How long the task takes when nobody faffs, in whole minutes. At least 1. */
  minutes: number
}

/** A time to be ready by, and the tasks that lead up to it. */
export interface TimerPlan {
  /** What the plan is for, such as "School run". Blank until the person names it. */
  name: string
  /** The time of day to be ready by, on this device's clock, as "HH:mm". */
  endTime: string
  /** How many times longer every task really takes than its minutes say. At least 1. */
  faffMultiplier: number
  /** The tasks to do one after another, first to last. The last one finishes at the end time. */
  tasks: TimerTask[]
}

/** A plan that the timers API keeps under its name, to be used again. */
export interface TimerPreset {
  /** Unique identifier that stays the same when the preset is edited. */
  id: string
  plan: TimerPlan
}

/** The one timer that every screen in the home shows, which the timers API holds. */
export interface ActiveTimer {
  /** The plan being worked on. */
  plan: TimerPlan
  /** When the timer was started, or null while it is stopped. */
  startedAt: Date | null
}

/**
 * Creates a task that can be told apart from every other task.
 *
 * @param name What to do.
 * @param minutes How long it takes when nobody faffs, in whole minutes. At least 1.
 * @returns The task.
 */
export function createTask(name: string, minutes: number): TimerTask {
  return { id: createUuid(), name, minutes }
}

// crypto.randomUUID would do this job, but browsers only offer it on secure origins, and the kiosk reaches the pages
// over plain HTTP. Random bytes are offered everywhere, so a version 4 UUID is put together from those instead.
function createUuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  // These two bytes carry the UUID's version and variant, which the format fixes.
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
