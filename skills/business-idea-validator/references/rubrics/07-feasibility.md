# Rubric 7: Feasibility

**Id:** `feasibility`

**Question:** Can this be built by this founder in a reasonable time, and what is the risky part?

## What to look for

- **Smallest useful version.** What is the thinnest slice that delivers the core value? Could it be a spreadsheet, a form plus a human, a no-code tool, before any custom code?
- **Technical risk.** Something nobody has made work yet (a model accuracy nobody reaches, a hardware constraint, an integration without an API) versus well-trodden engineering.
- **Dependencies.** Access to data, to a platform, to a partner, to a license. A product that cannot exist without a yes from someone else carries their risk.
- **Build cost in the agent era.** Standard web and mobile products are cheap and fast to build with coding agents. That cuts both ways: easy to build means easy to copy (rubric 8). Hard parts are still hard: data quality, integrations, compliance, reliability of model outputs.
- **Operational load.** What has to run every day: support, content moderation, manual review, data entry.

## Scoring anchors

- **5, Strong.** A thin first slice is obvious, the technology is proven, dependencies are in hand, and a first version could ship in weeks.
- **4, Solid.** Buildable with known technology; one dependency or integration is not yet secured.
- **3, Unclear.** The text describes the full vision only, so the first slice is not visible, or a key technical assumption is unverified.
- **2, Weak.** The idea needs a capability at the edge of what works (model accuracy, real-time constraints, regulated data access) without a plan to test it first, or the operational load exceeds what the founder can run.
- **1, Red flag.** Depends on something that does not exist or on access the founder has no path to, or the scope cannot be reduced below a multi-year build.

## Confidence

- **High** when the text or answers describe the stage, the stack or the first slice.
- **Medium** when you can infer the build from the product type.
- **Low** when the technical core is a black box in the text.

## Traps

- Do not reward complexity; a hard build is a cost, not a moat, unless rubric 8 says otherwise.
- "We will use AI to do X" needs a check that AI does X reliably today for this input.
- Hardware, regulated data, and physical operations change the time scale; say so.
- An MVP that cannot be built without the whole platform is not an MVP.

## Output

In `reasoning`, name the first slice you would build and the riskiest technical assumption. In `assumptions`, state the stack or capability you assumed. In `questions`, ask what the founder has already built or tested.
