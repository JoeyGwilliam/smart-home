import { format } from 'date-fns'
import { ChevronDown, CloudOff, CloudRain, Sunrise, Sunset } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'

import { Pill } from '@/components/Pill'
import { Button } from '@/components/ui/button'
import { WeatherIcon } from '@/pages/dashboard/WeatherIcon'
import type { Forecast } from '@/weather/forecast'
import { FORECAST_LOCATION_NAME } from '@/weather/openMeteo'
import { useForecast } from '@/weather/useForecast'

// Enough hours to see the rest of the morning or afternoon at a glance; the full forecast is a tap away.
const HOURS_AT_A_GLANCE = 6

/**
 * The weather now, with the next few hours beneath. Tapping it opens today's high and low, the sunrise and sunset
 * times, and an hour-by-hour forecast with the chance of rain.
 */
export function WeatherCard() {
  const forecastQuery = useForecast()

  if (forecastQuery.data) return <ForecastCard forecast={forecastQuery.data} />
  if (forecastQuery.isError) return <WeatherUnavailableCard onRetry={() => void forecastQuery.refetch()} />
  return <motion.div className="h-72 rounded-4xl bg-field" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.6, repeat: Infinity }} />
}

function ForecastCard({ forecast }: { forecast: Forecast }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { current, today, hours } = forecast

  return (
    <motion.section layout className="panel overflow-hidden rounded-4xl shadow-lg shadow-shade" aria-label={`Weather in ${FORECAST_LOCATION_NAME}`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="block w-full px-7 pt-6 pb-5 text-left transition-colors hover:bg-accent/30"
      >
        <motion.div layout="position" className="flex items-center gap-5">
          <motion.span animate={{ y: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} className="shrink-0">
            <WeatherIcon condition={current.condition} isDaytime={current.isDaytime} className="size-20 drop-shadow-lg" />
          </motion.span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold tracking-[0.2em] text-primary-text uppercase">{FORECAST_LOCATION_NAME}</p>
            <p className="font-heading text-6xl leading-none font-semibold">{formatTemperature(current.temperature)}</p>
            <p className="mt-1 font-semibold">{current.condition.label}</p>
          </div>
          <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} className="grid size-9 shrink-0 place-items-center rounded-full bg-field text-muted-foreground">
            <ChevronDown className="size-5" />
          </motion.span>
        </motion.div>

        <AnimatePresence initial={false} mode="popLayout">
          {!isExpanded && (
            <motion.div
              key="glance"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-5 grid grid-cols-6 gap-1 border-t border-border/60 pt-4"
            >
              {hours.slice(0, HOURS_AT_A_GLANCE).map((hour, index) => (
                <div key={hour.time.getTime()} className="grid justify-items-center gap-1 text-center">
                  <span className="text-xs font-bold text-muted-foreground">{index === 0 ? 'Now' : format(hour.time, 'HH:mm')}</span>
                  <WeatherIcon condition={hour.condition} isDaytime={hour.isDaytime} className="size-7" />
                  <span className="font-bold">{formatTemperature(hour.temperature)}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="hourly"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
          >
            <div className="flex flex-wrap gap-2 border-t border-border/60 px-7 pt-4">
              <Pill className="bg-peach text-[oklch(0.42_0.1_40)]">H {formatTemperature(today.high)}</Pill>
              <Pill className="bg-sky text-[oklch(0.4_0.07_240)]">L {formatTemperature(today.low)}</Pill>
              <Pill className="bg-butter text-[oklch(0.42_0.08_80)]">
                <Sunrise className="size-3.5" />
                <span aria-label={`Sunrise at ${format(today.sunrise, 'HH:mm')}`}>{format(today.sunrise, 'HH:mm')}</span>
              </Pill>
              <Pill className="bg-lavender text-[oklch(0.38_0.08_300)]">
                <Sunset className="size-3.5" />
                <span aria-label={`Sunset at ${format(today.sunset, 'HH:mm')}`}>{format(today.sunset, 'HH:mm')}</span>
              </Pill>
            </div>
            <ol className="grid gap-1 px-4 pt-2 pb-4">
              {hours.map((hour, index) => (
                <motion.li
                  key={hour.time.getTime()}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="grid grid-cols-[3.5rem_2rem_minmax(0,1fr)_3rem_6.5rem] items-center gap-2 rounded-2xl px-3 py-1.5 even:bg-field/50"
                >
                  <span className="font-bold text-muted-foreground">{index === 0 ? 'Now' : format(hour.time, 'HH:mm')}</span>
                  <WeatherIcon condition={hour.condition} isDaytime={hour.isDaytime} className="size-6" />
                  <span className="truncate text-sm font-semibold">{hour.condition.label}</span>
                  <span className="text-right font-heading text-lg font-semibold">{formatTemperature(hour.temperature)}</span>
                  <RainChance percentage={hour.rainChance} />
                </motion.li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

/** A small bar that fills with the chance of rain. The rain cloud marks it as rain, rather than humidity. */
function RainChance({ percentage }: { percentage: number }) {
  return (
    <span className="flex items-center gap-1.5" aria-label={`${percentage}% chance of rain`}>
      <CloudRain className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-field">
        <motion.span
          className="block h-full rounded-full bg-sky"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </span>
      <span className="w-8 text-right text-xs font-bold text-muted-foreground">{percentage}%</span>
    </span>
  )
}

function WeatherUnavailableCard({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="panel grid place-items-center gap-2 rounded-4xl px-7 py-10 text-center shadow-lg shadow-shade">
      <span className="grid size-14 place-items-center rounded-full bg-lavender text-secondary-foreground">
        <CloudOff className="size-7" />
      </span>
      <h2 className="text-xl font-semibold">The weather's hiding</h2>
      <p className="text-muted-foreground">The forecast couldn't be fetched just now.</p>
      <Button onClick={onRetry} className="mt-2 h-9 rounded-full px-5 font-bold shadow-md shadow-shade">
        Try again
      </Button>
    </section>
  )
}

function formatTemperature(celsius: number): string {
  return `${Math.round(celsius)}°`
}
