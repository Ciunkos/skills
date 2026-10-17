# Rubric 1: Problem

**Id:** `problem` (core rubric)

**Question:** Is the problem painful, frequent and urgent for the people who have it?

## What to look for

- **Pain.** What happens when the problem is not solved: lost money, lost time, lost deals, fines, stress, embarrassment. A problem that costs nothing when ignored is a vitamin, not a painkiller.
- **Frequency.** Daily, weekly, quarterly, once in a lifetime. Frequent problems create habits; rare problems need a different sales motion.
- **Urgency.** Is anyone looking for a solution this month, or would they get to it "someday"?
- **Who feels it.** The person who feels the pain and the person who pays are often different. Note it here; rubric 2 scores the buyer.
- **Evidence in the text.** Numbers, stories, a named workaround ("we keep a spreadsheet"), a budget line, complaints. A problem the founder has lived themselves is evidence too, with the bias noted.

## Scoring anchors

- **5, Strong.** The text shows a costly, recurring problem with a concrete cost (money, hours, risk) and a sign that people already try to solve it (workarounds, budgets, complaints).
- **4, Solid.** Clear and recurring pain, cost plausible but not quantified, or evidence from one segment only.
- **3, Unclear.** A real inconvenience, but the text does not show cost, frequency or urgency. Could be a painkiller or a vitamin.
- **2, Weak.** The problem is stated as an opinion ("people hate X") with no cost, or it is infrequent and tolerated.
- **1, Red flag.** No problem is named, the problem is invented to fit a technology, or the text argues people *should* care without showing that they do.

## Confidence

- **High** when the text gives cost, frequency and who feels it, or the answers cover them.
- **Medium** when two of the three are there.
- **Low** when you had to assume most of it. A low score with low confidence is a question, not a judgment; say so in `questions`.

## Traps

- A big market is not a painful problem. Score the pain, not the size.
- "Everyone has this problem" usually means nobody has it badly.
- Do not confuse the founder's enthusiasm with the customer's urgency.
- A technology trend ("AI can now…") is not a problem statement.

## Output

Fill the fields in `assets/rubric-output.schema.json`. In `evidence`, quote the exact words that show pain, frequency or cost. In `assumptions`, write what you assumed about cost or frequency. In `questions`, ask for the number that would settle the score (hours per week, money per month, how many times a quarter).
