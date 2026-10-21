# Craft

How Przemo writes code and runs agents. Use these as defaults in work mode. The repo's own rules (CLAUDE.md, AGENTS.md, lint, existing patterns) win over this file.

## Before code

- One success criterion, observable: "user clicks X, Y appears, event Z lands". Then "Done?"
- "Jak wiesz, co zrobić, implementacja to dziś szczegół." Spend the time on what and why.
- A ticket describes the problem, not the implementation. An agent will do exactly what the ticket says, including the wrong parts.
- Make it work, make it right, make it fast. In that order. Push hard on "make it work".

## Writing code

- Match the code around you: naming, comment density, idioms. The change should look like it was always there.
- TypeScript over JavaScript. Platform APIs over libraries. A new dependency has to earn its place.
- Web-native: plain Request → Response, standard headers, HTML that works before JavaScript. React as islands where there is interaction.
- Postgres or SQLite before anything fashionable. "Większość appek to jedna tabela."
- Declarative over clever. One obvious way over a configurable framework.
- Error messages say what happened and what to do, with no secrets, tokens or personal data in them.
- Small, focused diffs. No drive-by refactors in the same change.
- Delete what you made dead. Nobody will clean it later.

## Product behavior

- A repeated action is idempotent: inviting, importing or saving the same thing twice sends the link again or updates in place. It never duplicates and never breaks.
- What exists stays untouched. An empty field from a form means "no change", never "erase".
- A cheap warning for the user ("this person is already a member, we will send a new link") is fine when it is a line of UI.

## Bugs

The default bug loop: investigate, plan, write a test that reproduces it, fix, improve observability so the next one is cheaper.

- "Zawsze zamiast pierw fiksować, zapytaj, dlaczego?"
- Evidence first: the log line, the request, the screenshot, the version. Without it you are fixing a guess.
- If the fix touches many files for a one-line cause, stop and look again.
- Zero bug policy: a bug is fixed or consciously closed, never parked.

## Shipping

- Trunk-based: main, every commit builds, checks run before push. Mechanical checks over written rules.
- Risky changes behind a flag, and remember a flag doubles the tests.
- Deploy in daylight. Know how to roll back before you roll forward.
- Measured, not assumed: an event or a metric for anything that matters to the business.
- For any incident: impact, root cause, fix, and one sentence on what we learned.

## Working with agents

- Agents work under rules: hooks that fix and check after every change, lint and tests as gates, a human review on every PR.
- Can the agent launch the project on its own? If yes, half the battle is won.
- UI change: a screenshot or a short recording as proof.
- Temporary files go to a scratch directory, never into the repo.
- Repeated review comments become rules, so the agent does not repeat the mistake.
- The model suggests. Explicit criteria and thresholds decide.
- Use the strongest model for planning and hard root causes. When the first session produces a patch that works but feels like a hack, run a second pass with the evidence as input.
- Disclose AI help where it matters. The bot can be the author; you are the reviewer who answers for it.
