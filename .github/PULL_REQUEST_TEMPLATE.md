## What & why

<!-- One paragraph: what does this PR change, and why? Link any related issue. -->

## Checklist

- [ ] Read `AGENTS.md` + the relevant `STR/` doc before coding
- [ ] No hidden game data in any new payload (`STR/08` — `reveal:show` is the
      only face-leak event)
- [ ] Game RNG still goes through the injected crypto port
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes — full suite, no skipped tests
- [ ] Rules changes have table-driven tests
- [ ] No secrets, no `any` in exported signatures, no new deps without justification

## Screenshots (UI changes)

<!-- Mobile 390px + desktop 1440px where relevant. -->
