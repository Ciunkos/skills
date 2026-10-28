# Rubric 3: Market and timing

**Id:** `market`

**Question:** What is the order of magnitude of the market, and why is now the right time?

## What to look for

- **Bottom-up size.** Number of potential buyers × plausible yearly price. Reason it out from the customer in rubric 2; do not quote a report the text does not contain. State the arithmetic in `reasoning`.
- **Reachable share.** The slice the founder could actually serve in two years with their resources (SOM). A huge TAM with an unreachable SOM scores low.
- **Why now.** A change that opens the window: a new regulation, a platform shift, a cost that just dropped (model prices, hardware), a behavior that just became normal. "AI exists" alone is not a why-now unless the idea needs it.
- **Direction.** Growing, flat or shrinking category. Shrinking markets can still work for a niche, but say so.
- **Geography.** Local-first ideas (Poland, EU) should be sized for their first market, not the planet.

## Scoring anchors

- **5, Strong.** A bottom-up estimate is possible from the text, the reachable share supports a business worth the founder's time, and a specific change explains why now.
- **4, Solid.** Sizing is plausible and the market is growing; why-now is implied rather than shown.
- **3, Unclear.** The market exists but the text gives nothing to size it, or the reachable share is tiny for the ambition stated.
- **2, Weak.** The sizing argument depends on a top-down number ("1% of a $50B market") or the timing argument is "because AI".
- **1, Red flag.** The market is shrinking or hostile, the reachable share cannot support a single salary, or the window has closed (a dominant player already owns the behavior).

## Confidence

General rule (see `report-style.md`): high when the text settles the score, or when general knowledge settles it in a way no extra text would change; medium when you filled gaps the founder could still overturn; low when you assumed most of it.

- **High** when the text gives customer count, price and a why-now, or you could derive them from named facts.
- **Medium** when one of the three had to be assumed.
- **Low** when the arithmetic rests on guesses; put the guesses in `assumptions`.

## Traps

- Do not invent market statistics. If you need a number, say "assuming" and give the range.
- A big market is a reason for competition, not a reason the idea will work.
- "Nobody is doing this" is more often a bad sign than a good one.
- Local ideas in small currencies: size in the local currency and say so.

## Market scan

When a `<market-scan>` is present, use the published prices of direct competitors as the price range in your arithmetic, and say so ("Web scan, <date>: entry prices run from X to Y"). Many direct competitors mean the market exists and is contested, not that it is large. The scan does not give market size; never turn a competitor count into one.

## Output

Show your arithmetic in `reasoning` (buyers × price = yearly ceiling; reachable share). Put every number you assumed in `assumptions`. In `questions`, ask for the fact that would move the estimate most.
