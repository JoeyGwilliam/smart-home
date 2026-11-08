# CLAUDE.md — Software Design Principles

> Based on *A Philosophy of Software Design* (2nd Ed.) by John Ousterhout.
> All quoted passages are from that book.

---

## TL;DR

1. **Fight complexity** — every decision must make the system simpler, not more complex.
2. **Be strategic, not tactical** — working code is the floor, not the goal.
3. **Make modules deep** — small interfaces hiding large functionality.
4. **Hide information ruthlessly** — each module owns its knowledge exclusively.
5. **Design it twice** — present at least two alternatives before implementing anything non-trivial.
6. **Write comments first** — if you can't describe it cleanly, the design is wrong.
7. **Name precisely** — a name that could mean many things means nothing.

---

## 1. The Prime Directive: Fight Complexity

> *"Complexity is anything related to the structure of a software system that makes
> it hard to understand and modify."*

Every decision — naming a variable, splitting a function, choosing a data structure,
drawing a module boundary — must be evaluated against one question:

**Does this make the system simpler or more complex?**

### Symptoms of complexity

- **Change amplification** — a seemingly simple change requires edits in many places.
- **Cognitive load** — a developer must hold too much in their head to do a task safely.
- **Unknown unknowns** — it is not obvious what code must change, or what depends on what.

Unknown unknowns are the worst symptom: the system has hidden landmines the developer
does not know to look for.

### Root causes of complexity

- **Dependencies** — code that cannot be understood or modified in isolation.
- **Obscurity** — important information that is not obvious.

Complexity is **incremental**. It accumulates from many small decisions. Each shortcut,
each leaking abstraction, each vague name adds a small amount; over time the system
becomes unmaintainable. There is no single moment of catastrophe — just a slow
accumulation of tax.

When Claude Code writes or modifies code that risks any of the above, it must stop,
flag it, and explain the trade-off before proceeding.

---

## 2. Strategic, Not Tactical Programming

> *"Working code isn't enough."*

> *"The problem with tactical programming is that it is short-sighted. If you program
> tactically, each programming task will add a bit of complexity... Eventually, some
> of your time will be spent fixing bugs... Eventually, a codebase designed tactically
> becomes too complex to modify."*

The fastest path to working code produces the worst long-term design. The strategic
approach invests extra time up front for clean, well-structured code — even when a
quick hack would pass the tests.

**Rules:**

- Do not introduce a shortcut without labeling it with `// TACTICAL HACK:` (or
  language equivalent) and a note on what the proper solution would be.
- For any non-trivial module, write the interface first — signatures, types, doc-comments
  — before writing the implementation body.
- When modifying existing code, ask: *"Does this leave the system in a better design
  state than I found it?"* If not, say so and propose what could be improved.
- Technical debt compounds. Every shortcut taken now costs more to fix later, because
  the next developer builds on the broken foundation.

**The tactical tornado:** Resist the temptation to be the developer who pumps out
features fastest by leaving messes behind. That developer creates disproportionate
complexity for everyone else, and the short-term speed gain evaporates within weeks.

---

## 3. Modules Must Be Deep

> *"The best modules are those that provide powerful functionality yet have simple
> interfaces. I use the term deep to describe such modules."*

Every module — class, function, package, component, microservice — should be **deep**:
a small, simple interface hiding a large amount of useful functionality.

**The rectangle test:** Imagine each module as a rectangle. The top edge is the
interface (the smaller, the better). The area is the functionality (the larger, the
better). Deep modules are wide and short. Shallow modules are tall and narrow — they
impose interface costs with little implementation benefit.

**Rules:**

- A module's interface should be **much simpler** than its implementation. If the two
  have similar complexity, the module is shallow — redesign it.
- **Classitis** — *"the mistaken belief that classes are good, so more classes are
  better"* — is a disease. Small classes accumulate interface costs with no benefit.
  Do not split a module just because decomposing feels virtuous.
- Before creating a new class or module, ask: *"Does this hide enough complexity to
  justify the new interface it introduces?"* If the answer is no, fold it into an
  existing module.
- A one-line pass-through function is almost always a mistake.

**Examples of deep modules:**

- Unix file I/O — five system calls (`open`, `read`, `write`, `lseek`, `close`) hiding
  hundreds of thousands of lines covering file systems, buffering, permissions, devices.
- A garbage collector — zero interface, enormous functionality.
- A well-designed HTTP client — one `request()` method hiding TLS, retries, connection
  pooling, redirects, encoding.

---

## 4. Information Hiding Is Non-Negotiable

> *"Each module should encapsulate a few pieces of knowledge, which represent design
> decisions. The knowledge is embedded in the module's implementation but does not
> appear in its interface."*

Every module owns specific knowledge. That knowledge must not leak across boundaries.

**Rules:**

- Implementation details must never appear in interfaces.
- If two modules both encode the same thing — a file format, a database schema, a
  protocol detail, a constant — that is **information leakage**. Fix it by moving the
  shared knowledge into a single owner.
- Private functions and fields are enforcement tools, not just convention. Use them
  deliberately to make leakage impossible, not just discouraged.
- Returning internal data structures (handing back the live map/dict/list that backs
  a class) is information leakage in disguise. Wrap or copy.

**Watch for temporal decomposition** — splitting code by *when* things happen
("first read, then parse, then save" → three classes) rather than by *what knowledge*
each module owns. Temporal decomposition almost always causes information leakage,
because the same knowledge is needed at multiple points in time.

**Red flags:**

- A module that exposes details only useful for its internal implementation.
- Two modules that must always change together when one underlying piece of knowledge
  changes.
- Getter/setter pairs that expose every internal field — information is not being hidden,
  just wrapped in noise.

---

## 5. General-Purpose Over Special-Purpose

> *"The sweet spot is to implement new modules in a somewhat general-purpose fashion.
> The functionality should reflect your current needs, but the interface should not."*

When designing an interface, make it somewhat general-purpose: the implementation
addresses current needs, but the interface must not be tied to those specific needs.

**Rules:**

- Ask: *"What is the simplest interface that covers all my current needs?"* Then ask:
  *"Could this interface serve related future needs without changing?"*
- Methods named after the feature that prompted them (e.g., `handleBackspaceKey`) are
  a red flag. Prefer general operations the feature can be built from
  (e.g., `delete(start, end)`).
- Special-purpose code must be cleanly separated from general-purpose code. Push
  specialization to the top layers (where features live) or the bottom (adapters);
  keep middle layers general.
- Eliminate special cases wherever possible. The normal-case code should handle
  edge conditions naturally, without scattered `if` statements.

**Test:** If a method will only ever be called from one place, that is a hint it may
be too special-purpose. Consider whether a more general operation serves better.

---

## 6. Better Together or Better Apart?

> *"The goal is to reduce the complexity of the system as a whole and improve its
> modularity. It might seem that the best way to achieve this goal is to divide the
> system into a large number of small components... Unfortunately, this approach can
> backfire."*

Splitting code into many small pieces is not inherently good. Every split introduces
a new interface, increases total complexity, and forces the reader to move between
files to understand one idea.

**Combine when:**

- The pieces share the same knowledge or the same data structure; separating them
  causes that knowledge to leak.
- The pieces are always used together — no one ever uses one without the other.
- Combining produces a simpler interface than having two separate ones.
- The pieces overlap in functionality, creating duplication if separated.

**Split when:**

- The pieces can be used or understood independently.
- They have completely different purposes and combining them adds complexity.
- The combined unit becomes difficult to understand as a whole.

**Key question:** *"Does this split make each piece simpler, or does it just move the
complexity to the boundary between them?"* If the latter, the split is wrong.

This applies at every scale: functions, classes, files, packages, services.
Microservices add network latency, versioning, deployment complexity, and distributed
failure modes. Justify that cost explicitly before choosing them over a monolith.

---

## 7. Different Layers, Different Abstractions

> *"In a well-designed system, each layer provides a different abstraction from the
> layers above and below it."*

Each layer of a system must speak a different language from its neighbors. If two
adjacent layers look nearly identical, the layering is wrong.

**Rules:**

- **Pass-through methods are banned.** A method that does nothing but call another
  method with the same arguments adds complexity with no benefit. Either remove the
  wrapper, redistribute responsibility, or merge the layers.
- **Pass-through variables are banned.** A parameter threaded through many functions
  that only the deepest one uses is a design smell. Use a context object, configuration,
  or restructured ownership instead.
- **Decorators must justify themselves.** A decorator that adds little functionality
  for many lines of boilerplate is a shallow module. Consider merging it with the
  underlying class.
- A module's public interface should look different from its internal implementation.
  If the API mirrors the internal data structure one-to-one, no meaningful abstraction
  is being provided.

---

## 8. Pull Complexity Downward

> *"It is more important for a module to have a simple interface than a simple
> implementation. Most modules have more users than developers."*

When complexity could be handled either inside a module or by every caller, it must
go inside the module. The module's author suffers once; every caller benefits forever.

**Rules:**

- Provide sensible defaults. Do not require callers to specify things that have an
  obvious correct answer most of the time.
- Configuration parameters push complexity upward toward users and operators.
  Minimize them. Before exposing a configuration knob, ask: *"Could the system figure
  this out automatically?"*
- Throwing an exception to "let the caller decide" is often laziness disguised as
  flexibility. If the caller cannot reasonably make the decision, the module must.

---

## 9. Define Errors Out of Existence

> *"The best way to eliminate exception handling complexity is to define your APIs so
> that there are no exceptions to handle."*

Exception handling is one of the largest sources of complexity in real systems.
The goal is to minimize the number of places where exceptions must be handled —
not to add more handling, but to eliminate the conditions that produce exceptions.

**Rules:**

- Before throwing an error, ask: *"Can I redefine this operation so this case isn't
  an error?"*
  - Deleting a non-existent item is a no-op, not an error.
  - Looking up a missing key returns nothing — it is not a crash.
  - Substring with out-of-range indices clamps to valid bounds — it does not throw.
- **Mask exceptions at the lowest reasonable level.** If the caller cannot do anything
  useful with an error, do not surface it.
- **Aggregate exception handling.** Do not wrap every call in `try/catch`. Catch at a
  high level where one handler can address many failure modes.
- **Crash early on unrecoverable errors** rather than degrading silently. Memory
  corruption, broken invariants, and impossible states justify aborting — not silent
  recovery that masks the bug.
- Every `try/catch` block must include a comment explaining *why* the exception is
  caught at this level and what the recovery strategy is.

---

## 10. Design It Twice

> *"You'll end up with a much better result if you consider multiple options for each
> major design decision."*

> *"The design-it-twice principle is not limited to interfaces. It applies to any
> design decision where there are several reasonable alternatives."*

The first design that comes to mind is rarely the best. Comparing alternatives exposes
weaknesses in each and usually reveals a third option better than either.

**Rules:**

- For every non-trivial design decision, present **at least two alternatives** before
  implementing anything. For each alternative, state:
  - What it does well.
  - What it does poorly.
  - Which principles from this document it satisfies or violates.
- The alternatives must be meaningfully different — not minor variations of the same idea.
- After comparison, recommend one and explain why. Then wait for confirmation before
  writing the implementation.

This applies to: module boundaries, API design, data structures, error-handling
strategies, naming, layering, and any decision that will be hard to reverse later.

---

## 11. Write the Comments First

> *"If a method or variable requires a long comment to explain, that is a red flag
> that you don't have the right abstraction."*

Writing the doc-comment for a function *before* its body is not a documentation
practice — it is a **design practice**. The comment forces you to articulate the
abstraction. If the comment is hard to write, the design is wrong.

**Rules:**

- For every new public function, class, or module: write the interface comment first,
  before any implementation code.
- The comment must describe what abstraction the function provides, not how it works.
  If describing it requires mentioning implementation details, the abstraction is wrong.
- If you cannot write a clean one-to-two sentence description of what a function does,
  that is a signal to stop and redesign — not to write a longer comment.
- The interface comment is a contract. It defines the behavior the implementation must
  satisfy. Writing the contract before the implementation clarifies both.

---

## 12. Comments Must Add Information

> *"Comments should describe things that aren't obvious from the code."*

Comments are not optional decoration. They capture information that cannot live in
the code itself: intent, abstractions, invariants, rationale, and constraints.

**Rules:**

- Every public function/method/class has a doc-comment that describes:
  - What abstraction it provides (not how it works internally).
  - Each parameter: meaning, units, constraints, and valid range.
  - The return value's meaning.
  - Errors/exceptions and the conditions that produce them.
  - Any preconditions or invariants the caller must uphold or can rely on.
- Doc-comments must describe the **interface**, not the implementation.
- Implementation comments inside function bodies explain **why**, not **what**. A
  comment that just translates the next line into English adds nothing — delete it.
- Higher-level comments (describing purpose and structure) are easier to maintain
  than low-level ones (describing each step). Prefer them.

**The "different information" test:** A comment that contains only words already
present in the code or signature adds nothing. The comment must convey what the
code cannot.

**The "obvious to a stranger" test:** "Obvious" means obvious to someone reading
the code for the first time, not to you who just wrote it. If a reviewer says
something is unclear, it is unclear — do not argue.

---

## 13. Naming

> *"A good name conveys a lot of information about what the underlying entity is,
> and, just as important, what it is not."*

Names are the densest form of documentation. A good name eliminates the need for
many comments.

**Rules:**

- Names must be **precise** — a reader should predict the variable's meaning without
  reading its declaration.
- Names must be **consistent** — the same concept always uses the same name everywhere;
  a given name always means the same thing.
- Avoid vague nouns: `data`, `info`, `result`, `obj`, `temp`, `manager`, `handler`,
  `processor`, `helper`, `util`. These signal the underlying thing has no clear identity.
- Boolean names and functions returning booleans must be predicates: `is_ready`,
  `has_value`, `should_retry`, `was_modified`.
- Type information in names (Hungarian notation) is unnecessary in typed languages.
  Names describe meaning, not type.
- Loop variables (`i`, `j`) are acceptable when the scope is short and obvious.
  For longer scopes, use descriptive names.

**The hard-to-name red flag:** If you cannot find a precise, short, intuitive name,
the design of the underlying entity probably needs rethinking. Naming difficulty
usually reveals that the entity is doing too much or doesn't have a coherent purpose.

---

## 14. Consistency

> *"Consistency creates cognitive leverage: once you have learned how something is
> done in one place, you can use that knowledge to immediately understand other
> places that use the same approach."*

Consistency is one of the cheapest and most powerful ways to reduce complexity
across a large codebase.

**Rules:**

- Match the existing style and patterns of the surrounding code. When in Rome,
  do as the Romans do.
- **Do not introduce a new convention just because you prefer it.** If a convention
  exists, follow it — even if a different approach would be marginally better.
  The compounding value of consistency almost always outweighs the improvement.
- If a convention should change, propose the change explicitly and apply it
  everywhere atomically — do not create inconsistency mid-codebase.
- Use the same name for the same concept everywhere. Use different names for
  different concepts, even when they look similar.
- Document invariants and never violate them. If a data structure guarantees something
  (e.g., "this list is always sorted"), that guarantee must be explicit and inviolable.

---

## 15. Code Should Be Obvious

> *"If code is obvious, it means that someone can read the code quickly, without much
> thought, and their first guesses about its behavior or meaning will be correct."*

Obscurity is one of the two root causes of complexity. Fight it deliberately.

**Things that make code more obvious:**

- Precise, descriptive names.
- Consistent patterns across the codebase.
- Whitespace that visually separates logical sections.
- Comments that fill in non-obvious context.
- Conformance to reader expectations — don't surprise people.

**Things that make code non-obvious — use with care:**

- **Event-driven / callback control flow** — the next handler is invisible from the
  call site. Document the flow explicitly.
- **Inheritance** — when a method is called on an object and it is not clear which
  subclass's implementation will run, the behavior is invisible. Prefer composition
  over deep inheritance hierarchies.
- **Generic container types** losing semantic information — a `(int, bool)` tuple with
  no field names, a `List<Object>`, a raw `dict`. Prefer named structs, records, or
  dataclasses.
- **Global and shared mutable state** — dependencies that do not appear in signatures.
  These are invisible inputs to every function that reads them.
- **Multi-threading** — concurrent execution creates non-obvious orderings. Make
  concurrency assumptions explicit in comments and variable names.
- Code that violates the conventions of its surroundings.
- Implicit behavior that depends on state set far away.

When non-obvious patterns are unavoidable, compensate with clear comments at the
point of confusion.

---

## 16. Modifying Existing Code

> *"Ideally, when you have finished with each change, the system will have the structure
> it would have had if you had designed it from the start with that change in mind."*

When changing existing code, do not just patch — improve.

**Rules:**

- Resist the "minimum-change" mentality. Each minimal patch adds a small amount of
  complexity; over time the codebase rots. Every change is an opportunity.
- Leave the design at least slightly better than you found it.
- Keep comments adjacent to the code they describe. Comments separated from their code
  go stale silently.
- Avoid duplicating documentation. Each piece of design knowledge should live in one
  obvious place.
- If a change invalidates a comment, update the comment in the same edit — never leave
  a comment that contradicts the code.
- Important context belongs in the code, not in commit messages alone. Future readers
  will see the code; they may never read the git log.

---

## 17. Performance

> *"Clean design and high performance are compatible."*

Most performance problems come from doing unnecessary work, not from clean code.
Simplicity and speed usually align: fewer layers, less indirection, less allocation.

**Rules:**

- Do not optimize speculatively. First measure, then optimize what matters.
- Develop awareness of fundamentally expensive operations: network round trips, disk
  I/O, lock contention, dynamic allocation, cache misses. Prefer cheaper alternatives
  when both are equally clean.
- Before optimizing: measure to find the actual bottleneck. After optimizing: measure
  again to confirm the improvement.
- When performance truly requires complexity, isolate that complexity to the critical
  path and keep the rest of the system clean.
- A simpler design often runs faster than a complex one, because it does less work.

---

## 18. How Claude Code Must Behave

### Before starting any new module, class, or significant function

1. State the purpose in one sentence.
2. Describe what it hides and what it exposes.
3. Present at least two meaningfully different design alternatives.
4. For each alternative, name which principles it satisfies and which it violates.
5. Recommend one and explain why.
6. Write the interface — signatures and doc-comments — before the implementation body.
7. Wait for approval before writing the full implementation.

### While writing code

- Call out red flags as they appear — even minor ones. Do not silently proceed past a
  design smell.
- If a function is growing long, say why — it may be doing deep work (acceptable) or
  accumulating conjoined responsibilities (split it).
- If the same pattern appears for the third time, stop and ask whether an abstraction
  is warranted.
- Match the existing conventions of the codebase. If no conventions exist yet,
  propose one explicitly before establishing it.
- When uncertain about a design decision, say so explicitly. Present the trade-offs
  and ask. Do not silently pick one option and move on.

### After completing a module

- Briefly walk through the red flags checklist below.
- Note any known design debt or follow-up improvements.
- Confirm every public interface has a doc-comment that describes the abstraction,
  not the implementation.

### Do not

- Do not produce a design with only one option presented.
- Do not write implementation before the interface is agreed on.
- Do not add a configuration parameter when the system could compute the answer.
- Do not add a new class or module without justifying what complexity it hides.
- Do not suppress a red flag without naming it and explaining the trade-off.
- Do not leave a comment that repeats what the code already says.
- Do not accept "it works" as sufficient justification for a design decision.
- Do not break an existing convention without proposing and confirming the change first.

---

## 19. Red Flags Checklist

Work through this list before any commit. Flags are grouped by severity.

### High — fix before proceeding

- [ ] **Shallow module** — interface complexity ≈ implementation complexity; the module
      provides little abstraction value.
- [ ] **Information leakage** — the same knowledge (format, schema, constant, protocol
      detail) is encoded in more than one place.
- [ ] **Temporal decomposition** — modules split by execution order rather than by the
      knowledge they own; causes information leakage across time.
- [ ] **Pass-through method** — exists only to call another method with the same
      arguments; adds a layer with no abstraction.
- [ ] **Pass-through variable** — threaded through many functions that do not use it;
      only the final receiver needs it.
- [ ] **Design without alternatives** — a non-trivial design decision was made without
      considering at least one other option.

### Medium — fix or explicitly defer with a note

- [ ] **Classitis** — code split into many tiny classes/modules that accumulate interface
      cost with no implementation benefit.
- [ ] **Overexposure** — using common operations requires understanding rare features
      or edge cases.
- [ ] **Special-general mixture** — special-case code embedded inside general-purpose
      modules instead of being isolated at the appropriate layer.
- [ ] **Conjoined methods** — two functions that cannot be understood independently;
      they share hidden state or implicit ordering.
- [ ] **Unjustified split** — a split that moves complexity to the boundary rather than
      reducing it.
- [ ] **Unjustified exception** — an error case that could have been defined away by
      redefining the operation.
- [ ] **Scattered exception handling** — `try/catch` at every call site rather than
      aggregated at the appropriate level.
- [ ] **Configuration the system could compute** — a parameter that forces the caller
      to reason about something the module should handle internally.

### Low — address in the same PR when convenient

- [ ] **Repetition** — the same pattern repeated three or more times where an
      abstraction would serve.
- [ ] **Vague name** — a name (`data`, `manager`, `helper`, `result`) so generic it
      could mean many things.
- [ ] **Hard-to-pick name** — naming difficulty is a signal the underlying design is
      muddled; investigate the design, not just the name.
- [ ] **Comment repeats code** — the comment adds no information beyond what the code
      already says; delete it.
- [ ] **Implementation in interface docs** — the doc-comment describes internals rather
      than the abstraction.
- [ ] **Non-obvious code** — behavior cannot be inferred from a quick reading; requires
      tracking down invisible state, subclass dispatch, or distant side effects.
- [ ] **Getter/setter noise** — pairs that expose every internal field with no actual
      hiding; reconsider whether information is being encapsulated at all.

---

## 20. The Mindset

The book's core message is not a set of rules — it is a mindset:

- **Complexity is incremental.** It accumulates from many small decisions. Every line
  matters. There is no single moment where the system "became" complex.
- **Working code is not the goal.** A clean, understandable, maintainable design is
  the goal. Working code is the floor.
- **Design is iterative.** No one gets it right the first time. Be willing to refactor
  after you understand the problem better — the first working version is often the
  design prototype, not the final design.
- **Simplicity is harder than it looks.** Achieving a genuinely simple design takes
  more time than producing a complex one — and pays off many times over.
- **Code is read far more than it is written.** Optimize for the reader, not the
  author.
- **Investment pays dividends.** Every hour spent on clean design today saves multiple
  hours of debugging, onboarding, and rework tomorrow.

> *"The reward for being a good designer is that you get to spend a larger fraction
> of your time in the design phase, which is fun. Poor designers spend most of their
> time chasing bugs in complicated and brittle code."*

When in doubt, choose the option that the next person to read this code —
including your future self — will thank you for.

---

*Based on "A Philosophy of Software Design" (2nd Edition) by John Ousterhout
(Yaknyam Press, 2021). All quoted passages are from that book.*