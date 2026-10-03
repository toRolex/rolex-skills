# next-steps implementation notes

## Decisions

- Implemented as a user-invoked skill (`disable-model-invocation: true`) so it only runs when explicitly called, matching the request and avoiding per-turn passive suggestions.
- Initial implementation copied the fork's JSON response format rather than the user-facing numbered UI. This is corrected in the upstream-alignment pass below.
- The earlier clarification to execute a selected prompt is superseded by the user's later explicit request to align with the plugin: selection creates a draft only.
- Install as a single symlink into Skills Manager; avoid the repository-wide replace script because it would change unrelated skill entries.

## Doc sync (second pass)

- `plugin.json` verified bucket-level (`./skills/personal/`), no per-skill entry needed.
- Registered `next-steps` in the router (`ask-rolex` 跨流程辅助) and `docs/skill-map.md` 辅助技能 table; both state the handoff distinction: `next-steps` stays in-session, `handoff` transfers context.
- Initially aligned README wording (root + bucket) to “可直接提交”; the upstream-alignment pass now makes draft-only selection explicit.

## Upstream interaction alignment

- Read upstream `next-steps/README.md` and `hooks/register.tsx`: the fork's JSON is internal; the UI offers up to three numbered labels plus `0: dismiss`, fills a selected prompt, and never submits it. No useful suggestions means the UI stays hidden.
- Preserve user-invoked operation as requested. Present human-readable numbered suggestions with complete prompts, echo/fill only the selected draft, and produce no output for no suggestions or dismiss. No extra clarification round is needed because the later explicit requirement resolves the earlier conflict.
- Preserve upstream recommendation rules: concrete imperative prompts in the user's voice, natural next actions, exact available slash-command/skill names and arguments, and the label/prompt size limits.
- Document the pure-skill boundary: no automatic turn hook, buttons, ghost text/Tab, or assumed input-box mutation; draft echo is the portable fallback.
- Updated only the skill, its two README summaries, and this task's existing notes; unrelated directories remain untouched.

## Validation

- `pnpm test:skills-structure`: passed all 8 tests (0 failures).
- `pnpm check-skills-structure`: passed (`skills structure ok`).
- Reviewed `jj diff --git` and `jj status`: only the four intended Markdown files changed; unrelated directories remain untouched.
