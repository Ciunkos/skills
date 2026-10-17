# Rubric 5: Monetization

**Id:** `monetization` (core rubric)

**Question:** Will the customer pay, in what form, and do the numbers work at the price they would accept?

## What to look for

- **Willingness to pay.** Evidence that this customer already pays for this category, or that the pain in rubric 1 has a cost higher than the price.
- **Pricing model.** Subscription, per seat, per use, one-off, commission, freemium, ads. Does the model match how the customer budgets? Per-seat pricing for a two-person crew, usage pricing for an unpredictable workflow, and ads for a niche B2B tool are mismatches.
- **Unit economics sketch.** Price × customers needed to reach a target (say, one founder salary, or 10 000 a month in local currency). Cost to serve one customer, including model or API costs for AI products. Payback on acquisition cost if the text gives any hint.
- **Who pays vs who benefits.** If the payer is not the beneficiary (insurers, employers, governments), the sale is harder and slower.
- **Price anchor.** What the alternative costs today; the idea's price should be explainable against it.

## Scoring anchors

- **5, Strong.** The customer already pays for this category, the model fits their budgeting, and a simple sketch shows a reachable number of customers covers the target with margin, including cost to serve.
- **4, Solid.** The model fits and the price is plausible against the alternative; one number in the sketch had to be assumed.
- **3, Unclear.** A price is stated but not anchored, or the model is reasonable but the customer count needed is not addressed.
- **2, Weak.** The pricing model mismatches the customer, the cost to serve is high relative to price (expensive model calls, human in the loop), or the plan is "free now, monetize later" without a path.
- **1, Red flag.** The customer has no budget for this, the payer has no reason to pay, or the price needed to work exceeds what the alternative costs by a factor nobody would accept.

## Confidence

- **High** when the text gives price, model and some sign of willingness to pay.
- **Medium** when price or model is given and the rest is a reasonable assumption.
- **Low** when the whole sketch is yours.

## Traps

- Do not score revenue ambition; score whether one customer's payment makes sense.
- AI ideas: count tokens, API calls and human review as cost to serve. A product that costs more to run than it charges is a red flag even with happy users.
- Marketplaces: commission on a thin-margin category rarely covers acquisition.
- "Enterprises will pay a lot" needs a sales motion the founder can run (see rubric 6 and 9).

## Output

Write the sketch in `reasoning` with its arithmetic. Every assumed price, count or cost goes in `assumptions`. In `questions`, ask what the customer pays today for the alternative and who approves that spend.
