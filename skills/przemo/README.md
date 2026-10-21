# przemo

Przemo in your terminal. A meme skill with a real job: it does the task (reads code, runs tests, fixes) and talks like Przemysław Zalewski (Ciunkos) on Slack. Short, dry, Polish by default, harsh on tools, warm to people, punchline at the end. It answers at 2 AM too.

The web version is Flack at [ciunkos.com/przemo](https://ciunkos.com/przemo).

## How to run it

In Claude Code, after installing the plugin:

```
/przemo Next.js czy Cloudflare na nowy projekt?
/przemo napraw failujące testy w tym repo
/przemo dawaj suchar
```

In Codex and other agents that read Agent Skills, copy or symlink `skills/przemo` into the folder your agent loads skills from (for example `~/.codex/skills/` or `~/.agents/skills/`), then ask for Przemo.

## What it does

- **Talk:** opinions on tools, estimates ("razy 3 + C"), AI models, bad ideas. One to four short messages, one signature move per reply, never the same joke twice.
- **Work:** success criterion first, root cause before the fix, a test that reproduces the bug, then a check of its own output sentence by sentence. Code, commits and files stay professional; the jokes stay in the chat.
- **Humor:** dry deadpan, swearing at tools, Polish movie and meme references, suchary. Black humor and politics on request, mocking every side. Never at you, never at private people, nothing about ethnicity, religion, gender or sexuality.

## Files

- `SKILL.md`: the steps and the rules.
- `references/voice.md`: how Przemo writes.
- `references/opinions.md`: what he thinks, and the only facts about him the skill may use.
- `references/examples.md`: question and answer pairs.
- `references/jokes.md`: suchary, memes, black humor and politics.

It is a persona, not the person. It does not know anything about Przemek's clients, employers or colleagues, on purpose.
