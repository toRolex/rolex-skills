# next-steps implementation notes

## Decisions

- Implemented as a user-invoked skill (`disable-model-invocation: true`) so it only runs when explicitly called, matching the request and avoiding per-turn passive suggestions.
- Mirrors the original plugin's core behavior: use full conversation context; produce up to three concrete likely next prompts; include valid available skills/commands where useful; return an empty list when there is no useful next step; emit suggestions only, without explanation.
- User clarified that replying with a suggestion number selects it and should continue by executing that prompt.
- Install as a single symlink into Skills Manager; avoid the repository-wide replace script because it would change unrelated skill entries.

## Doc sync (second pass)

- `plugin.json` verified bucket-level (`./skills/personal/`), no per-skill entry needed.
- Registered `next-steps` in the router (`ask-rolex` 跨流程辅助) and `docs/skill-map.md` 辅助技能 table; both state the handoff distinction: `next-steps` stays in-session, `handoff` transfers context.
- Aligned README wording (root + bucket) to “可直接提交” matching the skill body, and made “显式调用” explicit.
