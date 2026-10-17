# Intake: what to ask before scoring

Score only what the founder wrote. A thin description produces low confidence, and low confidence produces "Validate first", which is honest but not very useful. One short round of questions before scoring is cheaper for everyone.

## When to ask

Ask when any of these is true:

- The idea text is under about 40 words.
- It does not say **who** it is for (a person or role, not a market).
- It does not say **what** the product does in one sentence.
- It does not say **how** it makes money (price, model, or "free, and here is who pays").

Ask once, in a single message, at most five questions. Do not ask a second round. Do not ask questions the text already answers.

## The five questions

Pick the ones that are missing. Use the founder's language and keep each question to one line.

1. **For whom.** Who exactly would pay for this? A role, a company size, a place.
2. **How it makes money.** Price and model (per month, per use, commission, free with a paying side).
3. **What they use today.** What those people do about the problem right now, including "nothing".
4. **Unfair advantage.** Why you: audience, access, experience, data, a partner.
5. **Stage.** Idea only, prototype, first users, first revenue; time per week and runway.

## When you cannot ask

Running non-interactively (no user turn available, or `--quick`): proceed with assumptions. Each rubric records what it assumed in `assumptions`, and the synthesis lists the unanswered items under open questions. Never invent answers and present them as the founder's.

## Where the answers go

Into `idea.answers` in the report (`for`, `money`, `today`, `advantage`, `stage`). Rubric passes treat answers as part of the idea text and may quote them as evidence.
