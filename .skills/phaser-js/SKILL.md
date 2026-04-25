---
name: phaser-js
description: Build, scaffold, debug, and extend HTML5 2D games with Phaser 4 (Phaser.js). Use when: (1) creating a new Phaser game from scratch, (2) adding game objects, physics, animations, tilemaps, audio, UI, or filters to an existing game, (3) structuring scenes and scene transitions, (4) debugging Phaser physics/input/rendering issues, (5) setting up a Phaser 4 + TypeScript + Vite project, (6) migrating a Phaser 3 project to Phaser 4. Triggers on phrases like "make a game with Phaser", "Phaser platformer", "add sprites", "Phaser scene", "arcade physics", "Phaser 4", etc.
---

# Phaser 4 — Developer Guide

Phaser 4 ("Caladan") is the current stable release (April 2026). It features a completely rebuilt WebGL renderer (RenderNode architecture), unified Filter system, and new high-performance GPU game objects. Official docs: https://docs.phaser.io

> **Migrating from Phaser 3?** See [migration.md](references/migration.md) for a concise diff.

## Project Setup

**Recommended stack:** Phaser 4 + TypeScript + Vite

```bash
npm install phaser           # latest (v4.x)
# or pin: npm install phaser@v4.0.0
```

Official templates:
```bash
git clone https://github.com/phaserjs/template-vite-ts my-game
cd my-game && npm install
npm run dev    # localhost:8080 with HMR
npm run build  # → dist/
```

CDN (quick prototype):
```html
<script src="https://cdn.jsdelivr.net/npm/phaser@4/dist/phaser.min.js"></script>
```

## Game Config

```typescript
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.WEBGL,       // Phaser 4: WebGL recommended; Canvas is deprecated
    width: 800,
    height: 600,
    backgroundColor: '#1a1a2e',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 300 }, debug: false }
    },
    // Pixel art: use smoothPixelArt instead of roundPixels
    // smoothPixelArt: true,

    // roundPixels defaults to FALSE in Phaser 4 (was true in v3)
    // roundPixels: true,  // only set if you need it

    scene: [BootScene, PreloadScene, GameScene, UIScene]
};
new Phaser.Game(config);
```

## Scene Lifecycle

Identical to Phaser 3 — no changes needed here:

```typescript
class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }

    init(data: object) { /* receive data from previous scene */ }

    preload() {
        this.load.image('sky', 'assets/sky.png');
        this.load.spritesheet('player', 'assets/player.png', { frameWidth: 32, frameHeight: 48 });
        this.load.tilemapTiledJSON('map', 'assets/level1.json');
        this.load.audio('bgm', 'assets/theme.mp3');
    }

    create() { /* build game world */ }

    update(time: number, delta: number) { /* ~60fps game loop */ }
}
```

**Scene management** (unchanged from v3):
```typescript
this.scene.start('NextScene', { score: 100 });
this.scene.launch('UIScene');     // parallel scene
this.scene.sleep('GameScene');
this.scene.wake('GameScene');
this.scene.pause('GameScene');
this.scene.resume('GameScene');
```

**Fade transition:**
```typescript
this.cameras.main.fadeOut(500, 0, 0, 0);
this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    this.scene.start('NextScene');
});
```

## Game Objects

`this.add.*` — unchanged for most standard objects. New in v4:

| Object | Creation | Notes |
|--------|----------|-------|
| Image | `this.add.image(x, y, 'key')` | |
| Sprite | `this.add.sprite(x, y, 'key')` | Supports animations |
| Text | `this.add.text(x, y, 'hello', { fontSize: '32px' })` | |
| Graphics | `this.add.graphics()` | |
| Container | `this.add.container(x, y, [children])` | |
| Layer | `this.add.layer()` | |
| TileSprite | `this.add.tileSprite(x, y, w, h, 'key')` | Now supports atlas frames + tile rotation |
| **Gradient** | `this.add.gradient(x, y, w, h, ...)` | **NEW in v4** — replaces Gradient FX |
| **SpriteGPULayer** | `this.add.spriteGPULayer(x, y, 'key', maxCount)` | **NEW in v4** — GPU-driven, millions of sprites |
| **Noise** | `this.add.noise(...)` | **NEW in v4** — cell/simplex noise |

**Removed in v4:** `Mesh`, `Plane` — no direct replacement.

**Common component methods** (unchanged):
```typescript
go.setPosition(x, y)
go.setScale(x, y?)
go.setRotation(rad) / go.setAngle(deg)
go.setAlpha(value)
go.setDepth(value)
go.setOrigin(x, y?)
go.setFlipX(bool) / go.setFlipY(bool)
go.setScrollFactor(x, y?)   // 0 = fixed to camera (UI)
go.setVisible(bool)
go.setActive(bool)
go.destroy()
```

**Tint (CHANGED in v4):**
```typescript
// v3 (old):  sprite.setTintFill(0xff0000)  ← REMOVED
// v4:
sprite.setTint(0xff0000).setTintMode(Phaser.TintModes.FILL);

// Available tint modes:
// Phaser.TintModes.MULTIPLY (default)
// Phaser.TintModes.FILL
// Phaser.TintModes.ADD
// Phaser.TintModes.SCREEN
// Phaser.TintModes.OVERLAY
// Phaser.TintModes.HARD_LIGHT
```

**Depth / z-order:**
```typescript
sprite.setDepth(10);
// Y-sort (top-down):
sprite.setDepth(sprite.y);  // in update()
```

## Filters (NEW — replaces FX + Masks)

In Phaser 4, FX and Masks are unified into one **Filter** system applicable to any game object or camera:

```typescript
// Add a blur filter to a sprite
sprite.filters.internal.add(new Phaser.Filters.Blur());

// Bloom → now an Action
Phaser.Actions.AddEffectBloom(sprite, { strength: 0.5 });

// Shine → Action
Phaser.Actions.AddEffectShine(sprite, { speed: 0.3 });

// Circle mask → Action
Phaser.Actions.AddMaskShape(sprite, new Phaser.Geom.Circle(x, y, r));

// Mask (replaces BitmapMask)
const maskFilter = new Phaser.Filters.Mask(maskImage);
sprite.filters.internal.add(maskFilter);

// Lighting (CHANGED from v3 — no more pipeline assignment)
sprite.setLighting(true);
// Light z value (explicit in v4, was implicit):
const light = this.lights.addLight(x, y, 150);
light.z = 100;  // height from surface
```

## Physics

Two systems — do not mix objects between them.

### Arcade Physics (most common — largely unchanged)

```typescript
const player = this.physics.add.sprite(100, 450, 'player');
player.setBounce(0.2);
player.setCollideWorldBounds(true);

const platforms = this.physics.add.staticGroup();
platforms.create(400, 568, 'ground').setScale(2).refreshBody();

this.physics.add.collider(player, platforms);
this.physics.add.overlap(player, coins, collectCoin, undefined, this);

// Movement
player.setVelocityX(160);
player.setVelocityY(-330);

// Check contact
if (player.body!.blocked.down) { /* on ground */ }
```

**v4 improvements:** Fixed group collision detection, overhauled static group refresh.

### Matter.js (unchanged API)

```typescript
const box = this.matter.add.image(200, 50, 'crate');
box.setFriction(0.5);
box.setBounce(0.3);
```

## Animations (unchanged)

```typescript
// Define once (global)
this.anims.create({
    key: 'walk',
    frames: this.anims.generateFrameNumbers('player', { start: 0, end: 7 }),
    frameRate: 12,
    repeat: -1
});

sprite.anims.play('walk', true);
sprite.anims.stop();
sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => { /* done */ });
```

## SpriteGPULayer (NEW — high-performance batch rendering)

Use for backgrounds, particle-like effects, crowds — anything non-interactive:

```typescript
// preload: single texture only (no multi-atlas)
this.load.image('stars', 'assets/star.png');

// create
const layer = this.add.spriteGPULayer(0, 0, 'stars', 100000);

// Define GPU animations
layer.setAnimations([{
    key: 'twinkle',
    frames: [0, 1, 2, 1],
    duration: 1000,
    yoyo: true,
    repeat: -1
}]);

// Add members (sprites in the layer)
for (let i = 0; i < 50000; i++) {
    layer.addMember({
        x: Phaser.Math.Between(0, 800),
        y: Phaser.Math.Between(0, 600),
        scale: Phaser.Math.FloatBetween(0.5, 1.5),
        animation: 'twinkle'
    });
}
// ⚠️ Not interactive (no input/physics)
// ⚠️ Single texture only
// ⚠️ addMember/removeMember is expensive — batch with insertMembersData when possible
```

## Input (unchanged)

```typescript
const cursors = this.input.keyboard.createCursorKeys();
const W = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
if (W.isDown) { ... }

sprite.setInteractive();
sprite.on('pointerdown', handler);

this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
    console.log(ptr.x, ptr.y);
});

// Drag
this.input.setDraggable(sprite);
sprite.on('drag', (ptr, dragX, dragY) => sprite.setPosition(dragX, dragY));
```

## Camera (mostly unchanged)

```typescript
const cam = this.cameras.main;
cam.startFollow(player, true, 0.08, 0.08);
cam.setBounds(0, 0, mapWidth, mapHeight);
cam.setZoom(1.5);

// Effects (unchanged)
cam.shake(500, 0.01);
cam.flash(300, 255, 255, 255);
cam.fadeIn(500);
cam.pan(x, y, 1000, 'Power2');
```

> ⚠️ If you access camera matrices directly, the matrix system was restructured in v4 — check the migration guide.

## Tweens (unchanged)

```typescript
this.tweens.add({
    targets: sprite,
    x: 400,
    alpha: 0,
    duration: 1000,
    ease: 'Power2',
    yoyo: false,
    repeat: 0,
    onComplete: () => sprite.destroy()
});

this.tweens.chain({
    targets: sprite,
    tweens: [
        { x: 200, duration: 500 },
        { y: 100, duration: 300, ease: 'Bounce' }
    ]
});
```

## Tilemaps (unchanged)

```typescript
// preload
this.load.tilemapTiledJSON('map', 'assets/level1.json');
this.load.image('tiles', 'assets/tileset.png');

// create
const map = this.make.tilemap({ key: 'map' });
const tileset = map.addTilesetImage('TilesetName', 'tiles');
const ground = map.createLayer('Ground', tileset, 0, 0)!;
ground.setCollisionByProperty({ collides: true });
this.physics.add.collider(player, ground);

this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
```

> ⚠️ If you use compressed textures, they must be re-compressed for v4's GL Y-axis orientation.

## Audio (unchanged)

```typescript
const bgm = this.sound.add('bgm', { loop: true, volume: 0.3 });
bgm.play();
const sfx = this.sound.add('jump');
sfx.play();
this.sound.mute = !this.sound.mute;
```

## Object Pooling (unchanged)

```typescript
this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 30 });

const b = this.bullets.get(x, y) as Phaser.Physics.Arcade.Sprite;
if (b) {
    b.setActive(true).setVisible(true);
    b.body!.enable = true;
    b.setVelocityY(-400);
}

// Recycle in update:
this.bullets.killAndHide(b);
(b.body as Phaser.Physics.Arcade.Body).enable = false;
```

## UI Overlay Pattern (unchanged)

```typescript
// GameScene
this.scene.launch('UIScene');
this.registry.set('score', 0);

// UIScene
this.registry.events.on('changedata-score', (_: unknown, v: number) => {
    scoreText.setText('Score: ' + v);
}, this);
// Update: this.registry.inc('score', 10);
```

## Math & Geometry

```typescript
Phaser.Math.Between(min, max)
Phaser.Math.FloatBetween(min, max)
Phaser.Math.Clamp(value, min, max)
Phaser.Math.Lerp(a, b, t)
Phaser.Math.Distance.Between(x1, y1, x2, y2)
Phaser.Math.Angle.Between(x1, y1, x2, y2)
Phaser.Math.DegToRad(deg)
Phaser.Math.RadToDeg(rad)

// CHANGED in v4:
// Math.TAU = PI * 2  (was PI/2 in v3 — bug fix!)
// Math.PI2 removed → use Math.TAU
// Geom.Point removed → use Math.Vector2

// Vector2 (replaces Geom.Point)
const v = new Phaser.Math.Vector2(x, y);
```

## Common Pitfalls

- **Canvas deprecated.** Use `Phaser.WEBGL`. Canvas works but misses all v4 rendering features.
- **`roundPixels` is `false` by default.** If your pixel art looks blurry, set `smoothPixelArt: true` in config.
- **`setTintFill()` is removed.** Use `.setTint(color).setTintMode(Phaser.TintModes.FILL)`.
- **`Geom.Point` is gone.** Use `Math.Vector2`.
- **`Math.TAU` corrected** to `PI*2` (was `PI/2` in v3). Use `Math.PI_OVER_2` if you need the old value.
- **`Phaser.Struct.Set/Map` removed.** Use native `Set` / `Map`.
- **`DynamicTexture` requires `.render()`.** If textures come out blank, call `.render()` after draw commands.
- **SpriteGPULayer** sprites are non-interactive — no input, no physics.
- **Custom WebGL pipelines from v3** must be rewritten as RenderNodes.

## Reference Files

- **[api-reference.md](references/api-reference.md)** — Full Phaser 4 API quick-lookup (namespaces, factory methods, events)
- **[game-patterns.md](references/game-patterns.md)** — Platformer, top-down, shooter, scene architecture, state machine
- **[migration.md](references/migration.md)** — Phaser 3 → 4 migration diff
