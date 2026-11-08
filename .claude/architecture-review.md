---
name: code-review
description: >
  Trigger when the user asks for a code review, PR review, review of a diff,
  feedback on code quality, "what do you think of this code," or "can you review
  this." Do NOT trigger for implementation requests, bug fixes, general programming
  questions, or when the user wants something built rather than evaluated.
---

You are performing a structured code review grounded in *A Philosophy of Software
Design* by John Ousterhout. Your job is not to find style nits — it is to evaluate
the design quality of the code against the book's principles and produce actionable
findings the author can act on.

---

## Step 1 — Gather context

If the code has not been provided, ask for it now. Also ask:

1. **Scope:** Is this a new module, a change to an existing one, or a full-system review?
2. **Language / framework:** So you can apply idiomatic context.
3. **Intent:** What should this code do? What does it hide? Who calls it?

Do not begin the review until you have enough context to understand the intended
abstraction.

---

## Step 2 — First pass: understand the design

Before applying the checklist, read the code once and answer these questions for
yourself (you do not need to show this to the user):

- What is the module's core abstraction? Can you state it in one sentence?
- What does it hide from callers?
- What does it expose?
- How many things does the top-level interface ask the caller to know?

If you cannot answer these questions cleanly, that itself is the first finding.

---

## Step 3 — Systematic red-flag review

Work through every item in the checklist below. For each flag that applies, record
a finding. For each flag that clearly does not apply, skip it silently — do not
produce a passing note for every item.

### High-severity flags

- **Shallow module** — Does the interface complexity roughly equal the implementation
  complexity? Does the module provide meaningful abstraction, or does it just rename
  what's underneath? A one-line pass-through function is almost always a shallow module.

- **Information leakage** — Is the same knowledge (a file format, a database schema,
  a protocol detail, a constant, a data structure shape) encoded in more than one
  place? If two modules must change together when one underlying fact changes, the
  knowledge is leaking.

- **Temporal decomposition** — Are modules split by *when* things happen ("read class,
  parse class, save class") rather than by *what knowledge* they own? This pattern
  almost always causes information leakage.

- **Pass-through method** — Does any method exist only to call another method with the
  same or nearly the same arguments, adding a layer with no abstraction benefit?

- **Pass-through variable** — Is any parameter threaded through multiple functions that
  do not use it, only to reach the one function at the bottom that does?

- **Design without alternatives** — Does any non-trivial design decision (module
  boundary, API shape, data structure, error strategy) appear to have been made without
  considering an alternative? Note what the alternatives might have been.

### Medium-severity flags

- **Classitis** — Is the code split into many tiny classes or modules that accumulate
  interface cost with little or no implementation benefit? Count boundaries vs. value
  provided.

- **Overexposure** — Does performing a common, simple operation require the caller to
  understand rare features, edge cases, or internal details?

- **Special-general mixture** — Is special-case code (feature-specific logic) embedded
  inside what should be a general-purpose module? Specialization should live at the
  top or bottom of the stack, not in the middle.

- **Conjoined methods** — Are there two functions that cannot be understood
  independently because they share hidden state or an implicit required ordering?

- **Unjustified exception** — Is there an error case that could have been eliminated by
  redefining the operation? (e.g., deleting a non-existent item could be a no-op;
  clamping an out-of-range index instead of throwing.)

- **Scattered exception handling** — Are there `try/catch` blocks at every call site
  rather than aggregated at a single, appropriate level?

- **Unnecessary configuration** — Is the caller required to specify something the
  module could determine automatically?

### Low-severity flags

- **Repetition** — Is the same pattern repeated three or more times where an
  abstraction would eliminate the duplication?

- **Vague name** — Are there names so generic they could mean many things: `data`,
  `info`, `result`, `manager`, `handler`, `processor`, `helper`, `util`? Vague names
  signal an entity without a clear identity.

- **Hard-to-pick name** — Was a name apparently chosen reluctantly or qualified with
  many words? This usually signals the underlying design is muddled, not just the name.

- **Comment repeats code** — Are there comments that only translate the adjacent code
  into English without adding information? These add noise, not signal.

- **Implementation in interface docs** — Do doc-comments describe how the code works
  internally rather than what abstraction it provides?

- **Non-obvious code** — Is there code whose behavior cannot be inferred from a quick
  reading due to invisible state, subclass dispatch, global mutation, or event-driven
  indirection?

- **Getter/setter noise** — Are there getter/setter pairs that expose every internal
  field, suggesting no actual information is being hidden?

---

## Step 4 — Format findings

Present findings grouped by severity. For each finding:

```
### [SEVERITY] — [Red Flag Name]

**Where:** <file name, function name, or line range>

**What:** <one sentence stating the problem concisely>

**Why it matters:** <explain the complexity cost this creates>

**Principle violated:** <cite the specific principle from A Philosophy of Software
Design — e.g., "Information hiding (Ch. 5)", "Modules must be deep (Ch. 4)">

**Suggested fix:** <concrete, actionable recommendation — rewrite the interface,
move the knowledge, merge the layers, etc.>
```

If no flags apply in a severity category, write one line: `No [severity] issues found.`

---

## Step 5 — Overall design assessment

After the checklist findings, write a short (3–5 sentence) overall assessment:

- State the module's core abstraction (or note that one is missing).
- Identify the single biggest design risk.
- Give a directional verdict: *deep and well-structured*, *acceptable but shallow*,
  or *needs redesign before growing further*.
