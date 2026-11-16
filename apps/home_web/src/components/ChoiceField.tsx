interface ChoiceFieldProps<Value extends string> {
  /** Names what is being chosen, such as "Model". */
  label: string
  choices: { value: Value; label: string }[]
  value: Value
  onChange: (value: Value) => void
  disabled?: boolean
}

/** A labelled drop-down for choosing one of a few values. */
export function ChoiceField<Value extends string>({ label, choices, value, onChange, disabled }: ChoiceFieldProps<Value>) {
  return (
    <label className="grid gap-1 text-sm font-bold text-muted-foreground">
      {label}
      <select
        value={value}
        disabled={disabled}
        // The options are exactly the choices, so the chosen value is always one of them.
        onChange={(event) => onChange(event.target.value as Value)}
        className="h-11 rounded-full border border-input bg-field px-3 text-base font-semibold text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
      >
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  )
}
