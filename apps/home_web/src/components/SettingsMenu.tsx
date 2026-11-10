import {
  ChevronDown,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  RefreshCw,
  Settings as SettingsIcon,
  Sun,
  SunMoon,
  Sunrise,
  Sunset,
  type LucideIcon,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { flushSync } from 'react-dom'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSettings, type Settings } from '@/settings/useSettings'
import { cn } from 'cn'

/** One of the values a setting can take, as the menu offers it. */
interface Choice<Value> {
  value: Value
  label: string
  icon: LucideIcon
}

const SCENE_TIME_CHOICES: Choice<Settings['sceneTime']>[] = [
  { value: 'live', label: 'Follow the sun', icon: RefreshCw },
  { value: 'sunrise', label: 'Sunrise', icon: Sunrise },
  { value: 'day', label: 'Day', icon: Sun },
  { value: 'sunset', label: 'Sunset', icon: Sunset },
  { value: 'night', label: 'Night', icon: Moon },
]

const SCENE_WEATHER_CHOICES: Choice<Settings['sceneWeather']>[] = [
  { value: 'live', label: 'Follow the forecast', icon: RefreshCw },
  { value: 'clear', label: 'Clear', icon: Sun },
  { value: 'cloudy', label: 'Cloudy', icon: Cloud },
  { value: 'fog', label: 'Fog', icon: CloudFog },
  { value: 'drizzle', label: 'Drizzle', icon: CloudDrizzle },
  { value: 'rain', label: 'Rain', icon: CloudRain },
  { value: 'snow', label: 'Snow', icon: CloudSnow },
  { value: 'thunder', label: 'Thunder', icon: CloudLightning },
]

/** The settings that the menu offers a list of choices for. */
type ChoiceSetting = 'sceneTime' | 'sceneWeather'

/** A gear button that opens this device's settings: the time of day and the weather that the backdrop shows. */
export function SettingsMenu() {
  const [settings, changeSettings] = useSettings()
  const [isOpen, setIsOpen] = useState(false)
  // Only one setting's choices show at a time, which keeps the menu short enough to fit on a phone.
  const [expandedSetting, setExpandedSetting] = useState<ChoiceSetting | null>(null)

  const toggleExpanded = (setting: ChoiceSetting) => setExpandedSetting(expandedSetting === setting ? null : setting)
  const changeIsOpen = (isNowOpen: boolean) => {
    setIsOpen(isNowOpen)
    if (!isNowOpen) setExpandedSetting(null)
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={changeIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className="panel rounded-full text-muted-foreground shadow-md shadow-shade hover:bg-accent hover:text-foreground"
          aria-label="Settings"
        >
          <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ type: 'spring', bounce: 0.3 }} className="grid place-items-center">
            <SettingsIcon className="size-5" />
          </motion.span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl border-[3px] border-panel-edge p-1.5 shadow-xl shadow-shade">
        <DropdownMenuLabel className="font-heading text-base font-semibold">Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ChoiceList
          title="Time of day"
          icon={SunMoon}
          choices={SCENE_TIME_CHOICES}
          chosenValue={settings.sceneTime}
          onChoose={(sceneTime) => changeSettings({ sceneTime })}
          isExpanded={expandedSetting === 'sceneTime'}
          onToggleExpanded={() => toggleExpanded('sceneTime')}
        />
        <ChoiceList
          title="Weather"
          icon={CloudSun}
          choices={SCENE_WEATHER_CHOICES}
          chosenValue={settings.sceneWeather}
          onChoose={(sceneWeather) => changeSettings({ sceneWeather })}
          isExpanded={expandedSetting === 'sceneWeather'}
          onToggleExpanded={() => toggleExpanded('sceneWeather')}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface ChoiceListProps<Value extends string> {
  title: string
  icon: LucideIcon
  choices: Choice<Value>[]
  chosenValue: Value
  /** Called with the new value when a different choice is picked. */
  onChoose: (value: Value) => void
  /** Whether the choices are showing beneath the title. */
  isExpanded: boolean
  /** Called when the title is picked, to show or hide the choices. */
  onToggleExpanded: () => void
}

/**
 * A row of the settings menu for one setting. Picking it shows the setting's choices beneath it, with the current one
 * ticked. They open beneath the row, rather than to its side, because a phone has no room beside the menu.
 */
function ChoiceList<Value extends string>({
  title,
  icon: Icon,
  choices,
  chosenValue,
  onChoose,
  isExpanded,
  onToggleExpanded,
}: ChoiceListProps<Value>) {
  return (
    <>
      <DropdownMenuItem
        aria-expanded={isExpanded}
        // Selecting an item normally closes the menu, but this one only shows or hides the choices.
        onSelect={(event) => {
          event.preventDefault()
          onToggleExpanded()
        }}
        className="rounded-xl px-2.5 py-2 font-semibold"
      >
        <Icon />
        {title}
        <ChevronDown className={cn('ml-auto transition-transform', isExpanded && 'rotate-180')} />
      </DropdownMenuItem>
      {isExpanded && (
        <DropdownMenuRadioGroup value={chosenValue} aria-label={title} className="pl-3">
          {choices.map((choice) => (
            <DropdownMenuRadioItem
              key={choice.value}
              value={choice.value}
              // Keeping the menu open lets the person see the backdrop change, and try another choice.
              onSelect={(event) => {
                event.preventDefault()
                revealChange(() => onChoose(choice.value))
              }}
              className="rounded-xl py-2 pl-2.5 font-semibold"
            >
              <choice.icon />
              {choice.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      )}
    </>
  )
}

/**
 * Makes a change that alters the whole page's look, revealing the result as a circle growing from this menu's button
 * (see index.css, which styles view transitions of type "theme"). Applies the change instantly where the browser
 * can't animate it, or the person asked for less motion.
 */
function revealChange(change: () => void): void {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || prefersReducedMotion) {
    change()
    return
  }

  // The browser captures the page before and after the callback, so React has to finish rendering inside it.
  document.startViewTransition({ update: () => flushSync(change), types: ['theme'] })
}
