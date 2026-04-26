# How to iterate on Phase A

The skeleton was designed around **four iteration modes**, ordered by speed / risk:

## 1. Feel iteration — *seconds per loop*

99% of "does this game feel good" work lives here. **Change one number, play, change another.** Never batch.

All vibe-tunable numbers are deliberately in **one file**: `src/contents/constants.ts`.

| Symptom | Touch |
|---|---|
| Jump feels floaty / too slow to peak | `PLAYER_TUNING.JUMP_VELOCITY` (less negative) or `GAME_CONFIG.GRAVITY` ↑ |
| Jump feels clunky / unforgiving | `PLAYER_TUNING.COYOTE_FRAMES` ↑ or `JUMP_BUFFER_FRAMES` ↑ |
| Tap-jump too bouncy | `JUMP_CUT_MULTIPLIER` ↓ (0.3ish) |
| Character feels sluggish / runs in mud | `MOVE_SPEED` ↑ |
| Fire rate too slow / too spammy | `FIRE_COOLDOWN_MS` |
| Bullets die too fast | `BULLET_LIFETIME_MS` / `BULLET_SPEED` |
| Camera whips around / clings to player | `CAMERA_TUNING.FOLLOW_LERP_*` / `DEAD_ZONE_*` |
| Hit-flash unsatisfying | `PLAYER_TUNING.INVULN_MS` + `Player.flashDamage()` tween params |
| Takes too many hits to die | `MAX_HP` |
| Can't recover from "off-by-one" damage | `INVULN_MS` ↑ |

Vite HMR reloads the scene on save without losing Vue state. Practical loop: `pnpm dev` → edit → tab back → see the change.

## 2. Content iteration — *minutes per loop*

No code, just data edits. Everything authored lives under `src/contents/data/`.

- **Redesign the level**: edit segments in `data/levels/level-01.ts`. Top-left coords for `platform` / `hazard`; center coords for `checkpoint`. Segment order doesn't matter except aesthetically.
- **Add a new level**: copy `level-01.ts` → `level-02.ts`, swap the import in `gameplay-scene.ts:40`. If you want both selectable, pass level id via `IGameplaySceneData`.
- **Tweak skill metadata** (display name, hotkey): edit `data/skills/skill-registry.ts`.

## 3. Structural iteration — *one session per feature*

This is where the architecture pays off. Three common recipes:

### Recipe A — add a new skill (e.g. Dash)

```
1. src/contents/constants.ts
   - SKILL_IDS.DASH = 'dash'
   - CAPABILITY_IDS.DASH = 'dash'
   - PLAYER_TUNING.DASH_SPEED / DASH_DURATION_MS / DASH_COOLDOWN_MS

2. src/contents/entities/player/capabilities/dash-capability.ts
   - implements Capability
   - onAction('skill-2', 'down') → if cooldown OK, set velocity.x = DASH_SPEED * facing,
     set player flag isDashing, stop after DASH_DURATION_MS

3. src/contents/data/skills/skill-registry.ts
   - add SkillDef { id: DASH, displayName: '冲刺', kind: 'active',
                    capabilities: [CAPABILITY_IDS.DASH], hotkey: ACTION_IDS.SKILL_2 }

4. src/contents/scenes/gameplay-scene.ts (one line in create)
   - skillManager.registerCapabilityFactory(CAPABILITY_IDS.DASH,
       () => new DashCapability(this.inputSystem))
   - (later, when story says so:) skillManager.unlock(DASH) + equip(DASH)

5. AGENTS.md: §13.4 capability row + §14 changelog entry.
```

Player class is **not touched**. HUD automatically shows the K slot filled because it listens for `SKILL_EQUIPPED`.

### Recipe B — add a new phase (e.g. Dialogue)

```
1. Implement class DialoguePhase implements Phase in contents/systems/phase-controller.ts
   (or pull it out into phases/ if the file grows past ~200 LOC)
   - enter: scene.physics.world.pause(); input.setMask(new Set(['interact']))
   - exit: done by RunningPhase on transition back

2. gameplay-scene.ts: register(new DialoguePhase(phaseCtx)) in create()

3. Trigger source: e.g. in NPC overlap callback →
     this.phaseController.transition(PHASE_IDS.DIALOGUE, { npcId, dialogueId })

4. AGENTS.md §13.10 if any new trade-off; §14 always.
```

### Recipe C — add a new segment type (e.g. NPC, moving platform)

```
1. Extend SegmentDef union in types.ts with new discriminated case.
2. Handle it in LevelRunner.load's switch — TS will force the exhaustiveness.
3. Add textures in boot-scene.ts if new visuals needed.
4. AGENTS.md §13.4 + §13.6.
```

## 4. Validation + debug workflow

After any non-trivial change, in order:

```bash
pnpm exec vue-tsc -b --force --noEmit   # types pass (fast, ~2s)
pnpm dev                                 # play it
pnpm build                               # full production sanity (optional)
```

Debug switches:
- `src/contents/scenes/gameplay-scene.ts:71` — flip `private debug = false` to `true`: physics bodies drawn, every phase transition logged to console.
- `src/contents/entities/player/player.ts` — add `console.log(this._hp, this.facing, this.invulnerable)` in `update()` when you want per-frame state.
- `inputSystem.on((a, p) => console.log('input', a, p))` in the scene — trace every semantic action.

## 5. The §13 contract (don't skip)

Every structural PR must:
1. Register new scene-keys / event-keys / asset-keys / types in the appropriate §13 subsection **before** wiring them up.
2. Update `Last updated:` in each touched subsection.
3. Add one line to §14.
4. Record a row in §13.10 (decision log) if you made a non-obvious trade-off (new dependency, physics engine swap, scene strategy change…).
5. Claim WIP in §13.9 before starting a multi-turn feature.

The file is self-describing: it says what's there, not what's supposed to be there.

---

# Prompt for the next agent — Phase B demo

Paste the block below as-is. It's self-contained; the agent will hydrate context from `AGENTS.md` in the repo.

```text
You are implementing Phase B of the momakoding jam starter. The goal is a playable demo on
top of the existing Phase A runner skeleton. Work inside this repo; do not create a new
project.

========================================================================
REQUIRED FIRST STEP
========================================================================
Read /AGENTS.md end-to-end before writing any code. Pay special attention to:
  - §0 (multi-agent protocol — the §13 contract is mandatory)
  - §11 (layering: engine / contents / runtime / pages)
  - §13 (living registry — the ground truth map of what currently exists)
  - §14 (change log — Phase A was just shipped; read that entry)

Then skim these files in order, so you understand the architecture before editing:
  src/contents/constants.ts
  src/contents/types.ts
  src/contents/scenes/gameplay-scene.ts
  src/contents/systems/phase-controller.ts
  src/contents/systems/skill-manager.ts
  src/contents/systems/input-system.ts
  src/contents/entities/player/player.ts
  src/contents/entities/player/capabilities/shoot-capability.ts

========================================================================
DEMO GOAL (the player should experience this)
========================================================================
Walk right from the start. At a placeholder NPC standing near the mid-1 checkpoint,
press E. A Vue dialogue overlay appears; the game pauses in the background. The NPC
offers a choice: "Take the dash." / "Leave it." Picking "Take the dash" closes the
dialogue, grants a new DASH skill (hotkey K), and the HUD's K-slot fills in
("冲刺" or similar). Continue right; a spike wall or wide gap now requires a dash to
cross. Reach the end checkpoint. That's the demo.

========================================================================
WHAT TO BUILD (concrete file list)
========================================================================
New:
  src/contents/entities/npc/npc-entity.ts
    - wraps an Arcade.Sprite; exposes a proximity overlap zone + id + dialogueId.
    - no AI for now; static placeholder.
  src/contents/entities/player/capabilities/dash-capability.ts
    - onAction('skill-2','down') → short horizontal burst along facing, respecting
      DASH_SPEED / DASH_DURATION_MS / DASH_COOLDOWN_MS from PLAYER_TUNING.
    - sets player.isDashing flag (add to Player) so shoot/jump can react later.
    - grants brief i-frames during the dash.
  src/contents/systems/dialogue-runner.ts
    - steps through a DialogueDef tree: {nodes, startNodeId}.
    - each node: {speaker, text, choices?, next?, onEnter?: DialogueCommand[]}.
    - DialogueCommand union: {type:'grant-skill', id} | {type:'set-flag', key, value}
      (keep it minimal for the demo; extensible later).
    - emits DIALOGUE_START / DIALOGUE_NODE / DIALOGUE_CHOICE_AVAILABLE / DIALOGUE_END
      on the EventBus so the Vue overlay can render.
  src/contents/data/dialogues/npc-sage.ts
    - tree: 2–3 lines of flavor + 1 choice node. Picking "take" triggers
      grant-skill(dash) and ends. Picking "leave" just ends.
  src/components/dialogue-overlay.vue
    - listens for DIALOGUE_* events; renders speaker + text + choice buttons.
    - input goes through the overlay (keyboard 1/2 for choices + Enter to advance).

Extend:
  src/contents/constants.ts
    - ACTION_IDS: add 'choice-1','choice-2','advance' for dialogue input (or reuse SKILL_2/3
      + INTERACT if you prefer — document your choice in §13.10).
    - SKILL_IDS.DASH = 'dash', CAPABILITY_IDS.DASH = 'dash'.
    - PLAYER_TUNING: DASH_SPEED, DASH_DURATION_MS, DASH_COOLDOWN_MS, DASH_INVULN_MS.
    - EVENT_KEYS: DIALOGUE_START / DIALOGUE_NODE / DIALOGUE_CHOICE_AVAILABLE /
      DIALOGUE_CHOICE_SELECTED / DIALOGUE_END.
  src/contents/types.ts
    - NpcSegmentDef variant for SegmentDef ({type:'npc', id, x, y, dialogueId}).
    - DialogueDef, DialogueNode, DialogueCommand, Dialogue* event payloads.
  src/contents/systems/level-runner.ts
    - handle 'npc' in the load switch; expose an `npcs: StaticGroup` + id lookup.
  src/contents/systems/phase-controller.ts
    - new DialoguePhase implements Phase; enter() pauses physics + sets input mask
      to dialogue actions only; exit() lets RunningPhase re-enable everything.
  src/contents/data/skills/skill-registry.ts
    - add SkillDef for DASH ({kind:'active', capabilities:[DASH], hotkey:SKILL_2}).
  src/contents/data/levels/level-01.ts
    - add one 'npc' segment near mid-1 (x ~ 1500).
    - add one "gate": either widen an existing gap OR place a tall spike wall after
      mid-1 that requires a dash to cross.
  src/contents/scenes/gameplay-scene.ts
    - register DashCapability factory.
    - add NpcEntity overlap with player: on 'interact' press while overlapping,
      transition to DialoguePhase with the NPC's dialogueId.
    - listen for DIALOGUE_END and transition back to RunningPhase.
    - listen for grant-skill command side-effect → skillManager.unlock+equip(DASH).
  src/pages/game-demo/index.vue
    - mount <DialogueOverlay /> alongside <GameHud />.
  src/contents/scenes/boot-scene.ts
    - generate 'npc' placeholder texture (pick any color not reused).

========================================================================
CONSTRAINTS (non-negotiable, pulled from AGENTS.md)
========================================================================
- Strict TS: no `any`, no `var`, `import type` for type-only imports
  (verbatimModuleSyntax is on).
- Capabilities cannot import other capabilities. Coordinate via Player flags only.
- All string literals for scene-key / event-key / asset-key / action-id / skill-id
  / capability-id go through `as const` objects in constants.ts first. No magic
  strings inline.
- Vue owns dialogue DOM; Phaser owns world. Communication only via the EventBus.
- Object-pool anything spawned in bulk (enemy bullets, if you add them).
- Do NOT add a Pinia store unless the demo explicitly needs persistence across
  page reloads. Phase B targets don't.
- Do NOT rename anything existing (scene keys, event keys, asset keys, exported
  symbols) without a §13.10 row explaining why.
- Do NOT extend Phaser.Scene with a new scene class — DialoguePhase is an
  in-scene FSM state, not a parallel scene.

========================================================================
GUARDRAILS
========================================================================
- Do NOT run `pnpm dev`. The user runs the dev server.
- You may run `pnpm exec vue-tsc -b --force --noEmit` and `pnpm build` to verify.
- Plan with TodoWrite. Claim a WIP row in AGENTS.md §13.9 before coding.
- Update §13.1 / §13.3 (if a new SegmentDef changes the diagram) / §13.4 (NPC + DASH
  capability rows) / §13.5 (new events) / §13.6 (npc texture) / §13.7 (new types) /
  §13.9 (mark DONE when shipped) / §13.10 (any non-obvious trade-off) and append one
  line to §14 — all in the same turn that ships the feature.

========================================================================
DONE CRITERIA
========================================================================
- Typecheck clean: `pnpm exec vue-tsc -b --force --noEmit`.
- Vite build clean: `pnpm build`.
- Walking up to the NPC + pressing E opens a dialogue; physics pauses; HUD
  remains visible; choice buttons work via keyboard.
- Choosing "take" grants dash; HUD K-slot fills with the dash skill name.
- Pressing K after that performs a visible horizontal burst.
- The post-NPC gate in level-01 is impassable without dash and passable with it.
- All AGENTS.md registries touched in the same turn.

If any spec above conflicts with AGENTS.md, AGENTS.md wins. Surface the conflict
in your response instead of silently deviating.
```

Two ways I'd use this:
- Paste into a **fresh Kilo session in this repo** — it has full access to AGENTS.md and the code.
- Paste into another Claude / coding agent — same, provided it's pointed at the repo root.

If you want to scope down further, cut out dialogue-runner + the choice system and just have the NPC emit `grant-skill dash` on interact (one button, no dialogue). That ships in half the time but doesn't prove out the Dialogue phase mask logic.