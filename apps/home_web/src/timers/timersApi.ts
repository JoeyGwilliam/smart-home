import type { ActiveTimer, TimerPlan, TimerPreset } from '@/timers/timer'

// nginx.conf and vite.config.ts forward these to the timers API.
const PRESETS_URL = '/api/timers/presets'
const ACTIVE_TIMER_URL = '/api/timers/active-timer'

/** The timers API could not be reached, or failed to handle a request. */
export class TimersUnavailableError extends Error {}

/**
 * The timers API rejected what it was sent, which happens when a preset's name or the name of one of its tasks is
 * blank.
 */
export class InvalidTimerError extends Error {}

/** A plan as the API sends and receives it. */
interface PlanJson {
  name: string
  /** A time of day. The API sends it with seconds, as "17:00:00", and accepts it without. */
  end_time: string
  faff_multiplier: number
  tasks: { id: string; name: string; duration_minutes: number }[]
}

/** A preset as the API sends it. */
interface PresetJson {
  id: string
  plan: PlanJson
}

/** The active timer as the API sends and receives it. */
interface ActiveTimerJson {
  plan: PlanJson
  started_at: string | null
}

/**
 * Lists every preset.
 *
 * @returns All presets, oldest first.
 * @throws TimersUnavailableError If the API is unavailable.
 */
export async function listPresets(): Promise<TimerPreset[]> {
  const response = await send('GET', PRESETS_URL)
  const presetsJson: PresetJson[] = await response.json()
  return presetsJson.map(parsePreset)
}

/**
 * Saves a plan as a new preset.
 *
 * @param plan The plan to keep.
 * @returns The new preset, with the id the API gave it.
 * @throws InvalidTimerError If the API rejects the plan.
 * @throws TimersUnavailableError If the API is unavailable.
 */
export async function createPreset(plan: TimerPlan): Promise<TimerPreset> {
  const response = await send('POST', PRESETS_URL, { plan: formatPlan(plan) })
  return parsePreset(await response.json())
}

/**
 * Saves every part of a preset, replacing what the API held. Recreates the preset if it was deleted elsewhere.
 *
 * @param preset The preset as it should now be.
 * @throws InvalidTimerError If the API rejects the preset.
 * @throws TimersUnavailableError If the API is unavailable.
 */
export async function savePreset(preset: TimerPreset): Promise<void> {
  await send('PUT', `${PRESETS_URL}/${preset.id}`, { plan: formatPlan(preset.plan) })
}

/**
 * Ensures that a preset no longer exists. Does nothing if it doesn't exist.
 *
 * @param presetId Identifier of the preset to delete.
 * @throws TimersUnavailableError If the API is unavailable.
 */
export async function deletePreset(presetId: string): Promise<void> {
  await send('DELETE', `${PRESETS_URL}/${presetId}`)
}

/**
 * Fetches the active timer. There is always one: until it is first saved, it is stopped and its plan has no tasks.
 *
 * @returns The active timer.
 * @throws TimersUnavailableError If the API is unavailable.
 */
export async function getActiveTimer(): Promise<ActiveTimer> {
  const response = await send('GET', ACTIVE_TIMER_URL)
  const activeTimerJson: ActiveTimerJson = await response.json()
  return {
    plan: parsePlan(activeTimerJson.plan),
    startedAt: activeTimerJson.started_at ? new Date(activeTimerJson.started_at) : null,
  }
}

/**
 * Replaces the active timer, for every screen that shows it.
 *
 * @param activeTimer The active timer as it should now be.
 * @throws TimersUnavailableError If the API is unavailable.
 */
export async function saveActiveTimer(activeTimer: ActiveTimer): Promise<void> {
  const activeTimerJson: ActiveTimerJson = {
    plan: formatPlan(activeTimer.plan),
    started_at: activeTimer.startedAt ? activeTimer.startedAt.toISOString() : null,
  }
  await send('PUT', ACTIVE_TIMER_URL, activeTimerJson)
}

async function send(method: string, url: string, body?: object): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    // fetch only throws when the request never got a response. Callers can't recover from that any differently from a
    // server failure, so both become the one error they document.
    throw new TimersUnavailableError('The timers API could not be reached.', { cause: error })
  }

  // nginx answers 502 or 504 when the API container is down, which is the same situation as the API failing.
  if (response.status >= 500) {
    throw new TimersUnavailableError(`The timers API failed with status ${response.status}.`)
  }
  if (response.status === 422) {
    throw new InvalidTimerError(`The timers API rejected the content of ${method} ${url}.`)
  }
  if (!response.ok) {
    // Any other status means this client sent a request the API doesn't understand, which is a bug, not a condition.
    throw new Error(`The timers API unexpectedly answered ${method} ${url} with status ${response.status}.`)
  }
  return response
}

function parsePreset(presetJson: PresetJson): TimerPreset {
  return { id: presetJson.id, plan: parsePlan(presetJson.plan) }
}

function parsePlan(planJson: PlanJson): TimerPlan {
  return {
    name: planJson.name,
    endTime: planJson.end_time.slice(0, 'HH:mm'.length),
    faffMultiplier: planJson.faff_multiplier,
    tasks: planJson.tasks.map((taskJson) => ({ id: taskJson.id, name: taskJson.name, minutes: taskJson.duration_minutes })),
  }
}

function formatPlan(plan: TimerPlan): PlanJson {
  return {
    name: plan.name,
    end_time: plan.endTime,
    faff_multiplier: plan.faffMultiplier,
    tasks: plan.tasks.map((task) => ({ id: task.id, name: task.name, duration_minutes: task.minutes })),
  }
}
