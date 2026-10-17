# Rubric 8: Defensibility

**Id:** `moat`

**Question:** Once this works, what stops a competitor, an incumbent, or a platform from copying it and winning?

## What to look for

- **Data.** Proprietary data that improves the product and that others cannot buy or scrape.
- **Network effects.** Each new user makes the product better for the others (marketplaces, communities, standards).
- **Switching costs.** Workflows, integrations, history and habits that make leaving painful once in.
- **Distribution or brand.** An audience, a channel, or a reputation competitors would need years to build.
- **Regulatory or contractual position.** Licenses, certifications, exclusive agreements.
- **AI wrapper risk.** A product that is a prompt plus a UI over a general model can be reproduced in days, and the model vendor can ship it as a feature. The moat must be somewhere else: data, workflow, distribution, trust.

## Scoring anchors

- **5, Strong.** At least one durable advantage is already present or will appear with the first customers (data loop, network effect, a locked distribution channel), and the incumbents have a reason not to follow (channel conflict, segment too small for them).
- **4, Solid.** A plausible advantage will build over time (switching costs, accumulated data), not present on day one.
- **3, Unclear.** No stated advantage; the business could still work on execution in a niche, but nothing stops a copy.
- **2, Weak.** The core is a thin layer over a general model or an API, and the model or platform vendor is already moving in this direction.
- **1, Red flag.** The product competes directly with the platform it depends on, or an incumbent can add it as a free feature for the same customers with no cost.

## Confidence

- **High** when the text addresses data, network or distribution advantages explicitly.
- **Medium** when the category makes the moat structure predictable.
- **Low** when you are speculating about advantages the text never mentions. An obvious wrapper over a general model, with the vendor already shipping the feature, is settled by general knowledge: score it with high confidence.

## Traps

- Being first is not a moat. Being cheaper is not a moat. A patent in software is rarely a moat.
- A small niche can be a moat if incumbents cannot serve it profitably; say so when it applies.
- Early-stage ideas rarely have a moat yet. Score 3 for "none yet, plausible later" and do not punish stage alone.
- Execution speed is an advantage, but it is scored in rubric 9, not here.

## Output

In `reasoning`, name the most likely copier (incumbent, platform, new entrant) and what would stop them. In `assumptions`, say whether you assumed an AI-wrapper structure. In `questions`, ask what the product will know after a year that a new competitor would not.
