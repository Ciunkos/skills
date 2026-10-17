# Rubric 10: Risks

**Id:** `risks`

**Question:** What legal, regulatory, platform or ethical exposure could stop this, and is it addressed?

## What to look for

- **Regulated data and activities.** Health, finance, children, identity, employment, housing, legal advice, personal data at scale (GDPR), biometrics. Regulation adds cost and time; it can also be a moat (rubric 8).
- **Platform dependency.** Living inside an app store, a marketplace, a social network, a single model vendor, a single API. Policy changes and price changes land on the product.
- **Intellectual property.** Scraping, reusing content, trademarks, a name already taken.
- **Liability.** What happens when the product is wrong: an AI gives bad tax advice, a scheduling tool double-books a clinic, a safety-critical recommendation fails.
- **Ethics and reputation.** Dark patterns, surveillance of workers, addictive loops, deception. These create churn and press risk even when legal.
- **Mitigation in the text.** Does the founder know the exposure and have a plan (disclaimers, human review, licensing, data minimization)?

## Scoring anchors

- **5, Strong.** No serious exposure, or the exposure is named and the mitigation is credible and affordable.
- **4, Solid.** Ordinary exposure (GDPR, a platform dependency) that a standard setup handles; not yet addressed in the text.
- **3, Unclear.** The category carries exposure the text does not mention; it may be manageable but nothing shows awareness.
- **2, Weak.** Significant exposure (regulated data, a dependency on one vendor's policy, likely IP conflict) with no mitigation and a real chance it changes the product.
- **1, Red flag.** The idea's core activity is illegal in the target market, violates a platform's terms it depends on, or creates liability no insurance or disclaimer would cover.

## Confidence

- **High** when the text addresses the regulatory or platform context.
- **Medium** when the category makes the exposure predictable.
- **Low** when you are unsure which jurisdiction or platform applies; say which you assumed. A regulation that plainly applies to the core activity (prescription drugs, payments, gambling) is settled by general knowledge: high confidence even when the text ignores it.

## Traps

- Do not list every imaginable risk. Name the two or three that could actually stop this idea.
- GDPR applies to almost everything in the EU; mention it only when the data is sensitive or at scale.
- "Terms of service" risk is real for scrapers, bots and unofficial integrations.
- An AI product that can be wrong needs a human or a disclaimer; say which fits.

## Output

In `reasoning`, name the risks that matter and whether they are mitigated. In `assumptions`, state the jurisdiction and platforms you assumed. In `questions`, ask what the founder has checked already (terms, licensing, counsel).
