# Writing rules for every rubric pass and the synthesis

These rules apply to everything a model writes into the report. They exist because a validation report is read by someone deciding what to do with their next six months, often alone, often late at night. Clear beats clever.

## Voice

- Short sentences. One idea per sentence. About 20 words.
- Plain words. No "leverage", "robust", "seamless", "delve", "game-changing", "unlock", "empower".
- No hype in either direction. Do not cheerlead, do not sneer.
- Second person for the founder ("your customer", "you assume"). Third person for everyone else.
- No em dashes. Use a comma, a period, or parentheses.
- Do not write "it's not just X, it's Y" or any "not only … but also" construction.
- No emoji, no exclamation marks.

## Evidence

- Quote the idea text and the answers exactly, inside `evidence`. Do not paraphrase a quote.
- Everything you did not read in the text is an assumption. Put it in `assumptions`, starting with "Assuming".
- Numbers need a source or the word "assuming". Never invent a market statistic, a competitor's price, or a user count.
- When you draw on general knowledge (a known competitor, a known regulation), say so: "From general knowledge: …".

## Scores

- Use the anchors in the rubric file. Pick the anchor that matches, then adjust by at most one for context, and say why in `reasoning`.
- The score answers the rubric's question for *this* founder and *this* customer, not for the category in general.
- Confidence is about the text, not about you. Low when you assumed most of it.
- Do not soften a 1 or a 2 to be nice, and do not hand out a 5 for enthusiasm.

## Language of the report

- Write in the language of the idea text: Polish if the founder wrote in Polish, English otherwise. The `--lang` option overrides.
- Rubric ids, field names and JSON keys stay in English.
- In Polish, use normal Polish punctuation and diacritics. No anglicisms where a Polish word exists.

## Questions and improvements

- `questions`: things the founder can answer in a sentence or with one conversation. Not homework essays.
- `improve`: changes to the idea, not changes to the description. "Narrow the first segment to X" is an improvement; "describe the segment" is a question.

## Synthesis

- `summary`: three sentences at most. What it is, what holds, what does not.
- `riskiestAssumption`: one belief that, if false, ends the idea. State it as the founder would, so it can be tested.
- `experiments`: three at most, doable in 14 days without building the product (conversations, a landing page, a concierge version, a pre-sale). Each has a metric with a number that decides pass or fail.
- `pivots`: only real alternatives the rubrics pointed at. Empty is a valid answer.
- `openQuestions`: the questions from the rubrics, deduplicated, most important first.
