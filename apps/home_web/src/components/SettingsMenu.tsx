import {
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
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSettings, type Settings } from '@/settings/useSettings'

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

/** A gear button that opens this device's settings: the time of day and the weather that the backdrop shows. */
export function SettingsMenu() {
  const [settings, changeSettings] = useSettings()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
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
        <ChoiceMenu
          title="Time of day"
          icon={SunMoon}
          choices={SCENE_TIME_CHOICES}
          chosenValue={settings.sceneTime}
          onChoose={(sceneTime) => changeSettings({ sceneTime })}
        />
        <ChoiceMenu
          title="Weather"
          icon={CloudSun}
          choices={SCENE_WEATHER_CHOICES}
          chosenValue={settings.sceneWeather}
          onChoose={(sceneWeather) => changeSettings({ sceneWeather })}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface ChoiceMenuProps<Value extends string> {
  title: string
  icon: LucideIcon
  choices: Choice<Value>[]
  chosenValue: Value
  /** Called with the new value when a different choice is picked. */
  onChoose: (value: Value) => void
}

/** A row of the settings menu that opens a list of choices for one setting, with the current one ticked. */
function ChoiceMenu<Value extends string>({ title, icon: Icon, choices, chosenValue, onChoose }: ChoiceMenuProps<Value>) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="rounded-xl px-2.5 py-2 font-semibold">
        <Icon />
        {title}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56 rounded-2xl border-[3px] border-panel-edge p-1.5 shadow-xl shadow-shade">
        <DropdownMenuRadioGroup value={chosenValue}>
          {choices.map((choice) => (
            <DropdownMenuRadioItem
              key={choice.value}
              value={choice.value}
              // Selecting an item normally closes the menu. Keeping it open lets the person see the backdrop change,
              // and try another choice.
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
      </DropdownMenuSubContent>
    </DropdownMenuSub>
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
