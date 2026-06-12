# AGENTS.md

## Project Shape
- Expo/React Native app with route screens in `app/`.
- Shared UI lives in `src/components/`; chat-specific UI is in `src/components/chat/`.
- Local AI providers, model selection, token budgeting, and model download/import logic live in `src/ai/`.
- Retrieval and source ranking live in `src/retrieval/`; SQLite schema, migrations, and seed loading live in `src/db/`.
- Student chat orchestration lives mainly in `src/hooks/useChatMessages.ts` and `src/services/answerService.ts`.
- The mascot is the HD cartoon Haki in `src/mascot/hd/` (one PNG per expression in `assets/images/mascot/`, procedural motion via Reanimated). `HakiMascotCompat` is the status-driven entry point; `src/components/mascot/` keeps only the interaction hook (tap/double-tap/shake) and the `MascotStatus` contract.
- Theme tokens live in `src/theme/themes.ts` behind `ThemeProvider`/`useTheme()`; the legacy `colors` export is aliased to the light theme, and dark mode stays admin-preview until every screen consumes tokens.

## Commands
- Use `npm.cmd` on Windows PowerShell to avoid `npm.ps1` execution-policy failures.
- Typecheck: `npm.cmd run typecheck`
- Retrieval tests: `npm.cmd run test:golden`
- Edge-case tests: `npm.cmd run test:edge-cases`
- Chat scenario tests: `npm.cmd run test:chat-scenarios`
- Local model tests: `npm.cmd run test:local-models`
- Full suite: `npm.cmd run test:all`

## Data Rules
- `src/data/seed-documents.json` is the source of bundled campus data.
- Do not add mock campus facts, fake fees, fake office locations, or invented deadlines.
- If source data changes, update `SEED_VERSION` in `src/db/seed.ts` so installed apps reseed.
- Keep tests aligned to real chunk IDs and real office names from the seed file.

## Chat And AI Rules
- Haki should answer in English only. Tagalog/Taglish user input should be redirected to English, not translated into an answer.
- Preserve actor roles exactly. Do not swap what the user, teacher, office, company, or classmate needs.
- Ask one short clarification question when intent or pronoun references are ambiguous.
- Fetch persistent prior conversation context only when it is related; avoid attaching unrelated history.
- Keep local model activation conservative. Do not auto-activate models above the detected safe device tier.

## Engineering Notes
- Follow existing architecture and UI conventions before adding new abstractions.
- Do not revert or overwrite unrelated dirty worktree changes.
- Prefer focused tests that cover the specific behavior changed.
- Use `apply_patch` for manual edits.
