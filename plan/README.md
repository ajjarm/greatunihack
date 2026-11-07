# plan/

One Markdown file per feature in `plan/active/`. It is the handoff artifact between
people and between agents. Keep it short.

Template (`plan/active/<feature>.md`):

```markdown
# <feature>

- **Owner:** ajjar | zack | person3 | person4
- **Branch:** <name>/<feature>
- **Directories:** apps/web/<x>, packages/<y>
- **Goal:** one sentence
- **Shows in demo as:** what the judge sees
- **Done when:** checklist of 2–4 observable things
- **Depends on:** nothing | <other feature> (what exactly)

## Steps
1.
2.

## Status (update at every checkpoint)
- Done:
- Not done:
- Next step:
- Open question (filed as handoff issue #):
```

Move a file to `plan/done/` when it has landed on main and the demo path uses it.
