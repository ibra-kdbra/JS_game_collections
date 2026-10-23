# Handoff

State of the Game Lab upgrade, for continuing in a new session.

## Branches (all pushed, each contains the previous one)
1. `upgrade/phase-0-critical-fixes` – confirmed bug fixes, `docs/UPGRADE_PLAN.md`
2. `upgrade/phase-1-landing-redesign` – original Cyber Yellow hub kept; static pre-render,
   self-hosted fonts/icons/three.js, accessibility, feedback XSS fix, service worker v2
3. `upgrade/phase-2-games` – shared kit (`assets/kit/`) and every original game upgraded
4. `upgrade/phase-3-new-games` – adds Breakout, Snake, Minesweeper, Crate Lab (Sokoban). **Merge this one to deploy everything.**
5. `wip/souls-level-check` – merged into phase-2 and phase-3; kept for history.

## Open work
- Souls Bumper: done. Every level has a recorded input run (`Souls-Bumper/tools/runs.json`)
  and `verify-levels.mjs` replays each one plus the whole game from level 1. The reset fix
  (1c9ae88) is required: without it the straight-through run sticks on level 5. Long hall,
  The tower and Reclaim runs jump above the top row of the map (there is no ceiling, same as
  the original); the owner accepted that.
- Not tested by people: difficulty (bots only), sound, real phones/Safari.
- Phase 4 in `docs/UPGRADE_PLAN.md` (move README-only media out of the deploy, licensing and
  credits for forked games, CI smoke test) is not started.

## Rules the owner set
- Author/committer `ibra-kdbra <git-repo-develop@outlook.com>`; no AI/Claude attribution
  anywhere (commits, comments, docs, PRs); no `claude/` branch names.
- Keep the original Cyber Yellow & Obsidian design and original game thumbnails/descriptions.
- Preview before deploy; no CDN dependencies; every game playable on phones.

## Useful commands
- `node tools/render-pages.mjs` after editing `assets/js/data.js` (`--check` to verify).
- Level checkers: `node Brainy_Warrior/tools/verify-levels.mjs`, `node Sokoban/tools/verify-levels.mjs`,
  `node Breakout/tools/verify-levels.mjs`, `node Snake/tools/verify.mjs`, `node Minesweeper/test/solver.test.mjs`,
  `node Souls-Bumper/tools/verify-levels.mjs` (`node Souls-Bumper/tools/map.mjs <n>` prints a level).
- Serve locally: `python3 -m http.server 8000`.
