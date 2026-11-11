import { format } from 'date-fns'
import { useId, type ReactNode } from 'react'

import { pickTaskColour } from '@/pages/adhdTimer/taskColours'
import type { TimerSchedule } from '@/timers/scheduleTimer'

// The dial is drawn in its own units, with the centre of the ring at the origin, and scales to fit its container.
const RING_RADIUS = 100
const RING_WIDTH = 28
const LABEL_RADIUS = 140

// Task names are written along the ring. The font is not measured, so how much of a name fits is judged from the
// width of an average character, which is close enough for names to stay inside their own task.
const NAME_FONT_SIZE = 11
const AVERAGE_CHARACTER_WIDTH = NAME_FONT_SIZE * 0.6
// Kept clear at each end of a task, so that names don't touch the boundaries.
const NAME_MARGIN = 6
// A name cut down to fewer characters than this says too little to be worth showing.
const FEWEST_NAME_CHARACTERS = 4
const VIEW_HALF_WIDTH = 180
const VIEW_HALF_HEIGHT = 160

// Start times closer together than this would be printed on top of each other, so the later one is left off. The
// list of tasks shows every start time, so nothing is lost.
const SMALLEST_LABEL_GAP_DEGREES = 16

// The hand and the greyed-out part glide from one position to the next, rather than ticking, as the page updates
// them once a second.
const GLIDE = '1s linear'

interface TimerDialProps {
  /** The tasks to draw, and the span of time that the whole ring stands for. */
  schedule: TimerSchedule
  /**
   * How much of the schedule has passed, from 0 to 1, which places the hand and greys out the ring behind it. Null
   * leaves both out, for a timer that hasn't been started.
   */
  elapsedFraction: number | null
  /** Shown in the hollow middle of the ring. */
  children: ReactNode
}

/**
 * A timer drawn as a hollow ring. The ring stands for the time from the first task's start, at the top, clockwise to
 * the moment to be ready by, back at the top. Each task takes a share of the ring in proportion to its length, with
 * its name written along it and its start time printed at its boundary. A name that is too long for its task is cut
 * short, and left off altogether when hardly any of it would fit. A small hand travels around the outside as time
 * passes.
 */
export function TimerDial({ schedule, elapsedFraction, children }: TimerDialProps) {
  // Paths are referred to by ids that have to be unique in the whole page.
  const idPrefix = useId()
  const totalMilliseconds = schedule.endsAt.getTime() - schedule.startsAt.getTime()
  const findAngle = (moment: Date) => ((moment.getTime() - schedule.startsAt.getTime()) / totalMilliseconds) * 360

  const segments = schedule.tasks.map((scheduledTask, position) => ({
    id: scheduledTask.task.id,
    name: scheduledTask.task.name,
    startLabel: format(scheduledTask.startsAt, 'HH:mm'),
    startAngle: findAngle(scheduledTask.startsAt),
    sweepAngle: findAngle(scheduledTask.endsAt) - findAngle(scheduledTask.startsAt),
    colour: pickTaskColour(position),
  }))
  const anglesWithRoomForLabel = findAnglesWithRoomForLabel(segments.map((segment) => segment.startAngle))

  const labelledSegments = segments.filter((segment) => anglesWithRoomForLabel.has(segment.startAngle))

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <svg
        viewBox={`${-VIEW_HALF_WIDTH} ${-VIEW_HALF_HEIGHT} ${VIEW_HALF_WIDTH * 2} ${VIEW_HALF_HEIGHT * 2}`}
        className="block w-full"
        role="img"
        aria-label={describeDial(schedule)}
      >
        <circle r={RING_RADIUS} fill="none" stroke="var(--muted)" strokeWidth={RING_WIDTH} />

        {/* Each task is the same circle with only its own share drawn: pathLength makes the dash lengths degrees. */}
        {segments.map((segment) => (
          <circle
            key={segment.id}
            r={RING_RADIUS}
            fill="none"
            stroke={segment.colour}
            strokeWidth={RING_WIDTH}
            pathLength={360}
            strokeDasharray={`${segment.sweepAngle} 360`}
            // A circle's outline begins at 3 o'clock, so it is turned back a quarter to begin at the top.
            transform={`rotate(${segment.startAngle - 90})`}
          >
            <title>{`${segment.name} from ${segment.startLabel}`}</title>
          </circle>
        ))}

        {elapsedFraction !== null && (
          <circle
            data-testid="elapsed-time"
            r={RING_RADIUS}
            fill="none"
            stroke="var(--elapsed)"
            strokeWidth={RING_WIDTH + 1}
            pathLength={360}
            strokeDasharray={`${elapsedFraction * 360} 360`}
            transform="rotate(-90)"
            style={{ transition: `stroke-dasharray ${GLIDE}` }}
          />
        )}

        {/* Names are drawn over the greyed-out part, so that the task being done stays readable. Their colour is
            dark in both colour schemes, as the ring is light in both. */}
        {segments.map((segment) => {
          const fittedName = fitNameToArc(segment.name, segment.sweepAngle)
          if (!fittedName) return null
          const pathId = `${idPrefix}-name-${segment.id}`
          return (
            <g key={segment.id}>
              <path id={pathId} d={describeNamePath(segment.startAngle, segment.sweepAngle)} fill="none" />
              <text className="fill-[oklch(0.3_0.05_15)] font-bold" fontSize={NAME_FONT_SIZE} textAnchor="middle" aria-hidden>
                <textPath href={`#${pathId}`} startOffset="50%">
                  {fittedName}
                </textPath>
              </text>
            </g>
          )
        })}

        {segments.map((segment) => (
          <line
            key={segment.id}
            y1={-(RING_RADIUS - RING_WIDTH / 2 - 2)}
            y2={-(RING_RADIUS + RING_WIDTH / 2 + 2)}
            stroke="var(--card)"
            strokeWidth={3}
            strokeLinecap="round"
            transform={`rotate(${segment.startAngle})`}
          />
        ))}

        {labelledSegments.map((segment) => {
          const angleRadians = (segment.startAngle * Math.PI) / 180
          const sideways = Math.sin(angleRadians)
          return (
            <text
              key={segment.id}
              x={LABEL_RADIUS * sideways}
              y={-LABEL_RADIUS * Math.cos(angleRadians)}
              // A label grows away from the ring: rightwards on the right, leftwards on the left, and both ways at
              // the top and bottom.
              textAnchor={Math.abs(sideways) < 0.35 ? 'middle' : sideways > 0 ? 'start' : 'end'}
              dominantBaseline="central"
              className="fill-foreground font-heading text-[14px] font-semibold tabular-nums"
            >
              {segment.startLabel}
            </text>
          )
        })}

        {elapsedFraction !== null && (
          <g data-testid="hand" style={{ transform: `rotate(${elapsedFraction * 360}deg)`, transition: `transform ${GLIDE}` }}>
            <path
              d={`M 0 ${-(RING_RADIUS + RING_WIDTH / 2 + 3)} l 8 -15 h -16 Z`}
              fill="var(--primary-text)"
              stroke="var(--card)"
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
          </g>
        )}
      </svg>

      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        {/* As wide as the hole in the ring, less a little breathing room. */}
        <div className="w-[42%] text-center">{children}</div>
      </div>
    </div>
  )
}

/**
 * Chooses which of the angles around the ring can have a label printed beside them without labels overlapping.
 *
 * @param angles Angles in degrees clockwise from the top of the ring, in increasing order.
 * @returns The angles that are far enough from the one chosen before them, and from the top of the ring coming back
 *   round to it, where the first label is.
 */
function findAnglesWithRoomForLabel(angles: number[]): Set<number> {
  const chosenAngles = new Set<number>()
  let lastChosenAngle = -Infinity
  for (const angle of angles) {
    if (angle - lastChosenAngle < SMALLEST_LABEL_GAP_DEGREES || 360 - angle < SMALLEST_LABEL_GAP_DEGREES) continue
    chosenAngles.add(angle)
    lastChosenAngle = angle
  }
  return chosenAngles
}

/**
 * Cuts a task's name down to what can be written along the task's share of the ring.
 *
 * @param name The task's name.
 * @param sweepAngle The size of the task's share of the ring, in degrees.
 * @returns The whole name if it fits, the start of it followed by "…" if some of it does, or null if too little of
 *   it fits to be worth showing.
 */
function fitNameToArc(name: string, sweepAngle: number): string | null {
  const trimmedName = name.trim()
  const arcLength = (sweepAngle / 360) * 2 * Math.PI * RING_RADIUS
  const characterCount = Math.floor((arcLength - 2 * NAME_MARGIN) / AVERAGE_CHARACTER_WIDTH)
  if (trimmedName.length <= characterCount) return trimmedName || null
  if (characterCount < FEWEST_NAME_CHARACTERS) return null
  return `${trimmedName.slice(0, characterCount - 1).trimEnd()}…`
}

/**
 * Draws the line that a task's name is written along: an arc through the middle of the task's share of the ring.
 *
 * @param startAngle Where the task starts, in degrees clockwise from the top of the ring.
 * @param sweepAngle The size of the task's share of the ring, in degrees.
 * @returns The arc as SVG path data. It runs clockwise for a task in the top half of the ring and anticlockwise for
 *   one in the bottom half, so that the name always reads from left to right, the right way up.
 */
function describeNamePath(startAngle: number, sweepAngle: number): string {
  // A full circle starts and ends at the same point, which an arc can't express, so it stops just short.
  const endAngle = startAngle + Math.min(sweepAngle, 359.9)
  const middleAngle = (startAngle + endAngle) / 2
  const isInBottomHalf = middleAngle > 90 && middleAngle < 270

  // Letters stand on the line and rise towards the outside of a clockwise arc, and towards the inside of an
  // anticlockwise one. Moving the line by about half the height of a capital letter centres them in the ring.
  const baselineShift = NAME_FONT_SIZE * 0.35
  const radius = isInBottomHalf ? RING_RADIUS + baselineShift : RING_RADIUS - baselineShift
  const findPoint = (angle: number) => {
    const angleRadians = (angle * Math.PI) / 180
    return `${radius * Math.sin(angleRadians)} ${-radius * Math.cos(angleRadians)}`
  }

  const [fromAngle, toAngle] = isInBottomHalf ? [endAngle, startAngle] : [startAngle, endAngle]
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0
  const sweepFlag = isInBottomHalf ? 0 : 1
  return `M ${findPoint(fromAngle)} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${findPoint(toAngle)}`
}

function describeDial(schedule: TimerSchedule): string {
  const taskDescriptions = schedule.tasks.map((scheduledTask) => `${scheduledTask.task.name} from ${format(scheduledTask.startsAt, 'HH:mm')}`)
  return [`A timer that ends at ${format(schedule.endsAt, 'HH:mm')}`, ...taskDescriptions].join(', ')
}
