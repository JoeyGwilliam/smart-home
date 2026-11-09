import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Moon, Sun, type LucideIcon } from 'lucide-react'

import type { WeatherCondition } from '@/weather/forecast'
import { cn } from 'cn'

interface WeatherIconProps {
  condition: WeatherCondition
  isDaytime: boolean
  className?: string
}

/** An icon for the weather, tinted to match it: butter for sunshine, sky for rain, lavender for night, and so on. */
export function WeatherIcon({ condition, isDaytime, className }: WeatherIconProps) {
  const { icon: Icon, colourClassName } = chooseIcon(condition, isDaytime)
  return <Icon className={cn(colourClassName, className)} aria-label={condition.label} role="img" />
}

function chooseIcon({ kind }: WeatherCondition, isDaytime: boolean): { icon: LucideIcon; colourClassName: string } {
  switch (kind) {
    case 'clear':
      return isDaytime ? { icon: Sun, colourClassName: 'text-butter' } : { icon: Moon, colourClassName: 'text-lavender' }
    case 'partlyCloudy':
      return isDaytime ? { icon: CloudSun, colourClassName: 'text-butter' } : { icon: CloudMoon, colourClassName: 'text-lavender' }
    case 'cloudy':
      return { icon: Cloud, colourClassName: 'text-secondary-foreground' }
    case 'fog':
      return { icon: CloudFog, colourClassName: 'text-muted-foreground' }
    case 'drizzle':
      return { icon: CloudDrizzle, colourClassName: 'text-sky' }
    case 'rain':
      return { icon: CloudRain, colourClassName: 'text-sky' }
    case 'snow':
      return { icon: CloudSnow, colourClassName: 'text-sky' }
    case 'thunder':
      return { icon: CloudLightning, colourClassName: 'text-peach' }
  }
}
