# Phaser 4 API Quick Reference

## Table of Contents
1. [Namespaces](#namespaces)
2. [Game Object Factory (`this.add.*`)](#game-object-factory)
3. [Physics (`this.physics.*`)](#physics)
4. [Loader (`this.load.*`)](#loader)
5. [Input (`this.input.*`)](#input)
6. [Cameras (`this.cameras.*`)](#cameras)
7. [Tweens (`this.tweens.*`)](#tweens)
8. [Sound (`this.sound.*`)](#sound)
9. [Scene Plugin (`this.scene.*`)](#scene-plugin)
10. [Math Utilities (`Phaser.Math.*`)](#math-utilities)
11. [Events](#events)

---

## Namespaces

| Namespace | Description |
|-----------|-------------|
| `Phaser.Game` | Root game instance |
| `Phaser.Scene` | Base scene class |
| `Phaser.GameObjects` | All display objects |
| `Phaser.Physics.Arcade` | Arcade physics classes |
| `Phaser.Physics.Matter` | Matter.js integration |
| `Phaser.Cameras.Scene2D` | Camera system |
| `Phaser.Animations` | Animation manager |
| `Phaser.Sound` | Sound manager |
| `Phaser.Input` | Input manager |
| `Phaser.Tilemaps` | Tilemap + layers |
| `Phaser.Tweens` | Tween manager |
| `Phaser.Math` | Math helpers |
| `Phaser.Time` | Timer/clock |
| `Phaser.Events` | EventEmitter |
| `Phaser.Geom` | Geometric shapes |
| `Phaser.Display` | Color/bounds utilities |

---

## Game Object Factory

`this.add.*` — creates and adds to scene display list:

| Method | Description |
|--------|-------------|
| `image(x, y, key, frame?)` | Static image |
| `sprite(x, y, key, frame?)` | Animated sprite |
| `text(x, y, text, style)` | Text object |
| `bitmapText(x, y, font, text, size?)` | Bitmap font text |
| `graphics()` | Programmatic drawing |
| `container(x, y, children?)` | Transform group |
| `layer(children?)` | Display list layer |
| `rectangle(x, y, w, h, fill?, alpha?)` | Rectangle shape |
| `circle(x, y, radius, fill?, alpha?)` | Circle shape |
| `triangle(x1,y1,x2,y2,x3,y3, fill?)` | Triangle shape |
| `zone(x, y, w, h)` | Invisible input zone |
| `particles(x, y, key, config)` | Particle emitter |
| `tileSprite(x, y, w, h, key)` | Scrolling tiled texture (now supports atlas frames + tile rotation) |
| `nineslice(x, y, key, frame, w, h, lw, rw?, th?, bh?)` | 9-slice scaling |
| `existing(go)` | Add manually created GO |
| `gradient(x, y, w, h, ...)` | **NEW v4** — Gradient game object (replaces Gradient FX) |
| `spriteGPULayer(x, y, key, maxCount)` | **NEW v4** — GPU batch renderer, millions of sprites |
| `noise(...)` | **NEW v4** — Cell/Simplex noise game object |

**Common component methods** (available on most GOs):

```typescript
go.setPosition(x, y)
go.setScale(x, y?)
go.setRotation(radians)
go.setAngle(degrees)
go.setAlpha(value)           // 0–1
go.setTint(0xff0000)
go.setTintMode(Phaser.TintModes.MULTIPLY)  // v4: MULTIPLY|FILL|ADD|SCREEN|OVERLAY|HARD_LIGHT
go.clearTint()
// NOTE: setTintFill() REMOVED in v4 → use setTint().setTintMode(Phaser.TintModes.FILL)
go.setVisible(bool)
go.setActive(bool)
go.setDepth(value)
go.setOrigin(x, y?)          // 0–1, default 0.5
go.setFlipX(bool)
go.setFlipY(bool)
go.setName('mySprite')
go.setData('key', value)
go.getData('key')
go.setScrollFactor(x, y?)    // 0 = fixed to camera (UI)
go.destroy()
```

---

## Physics

### Arcade

```typescript
// Sprites
this.physics.add.sprite(x, y, key)   → Phaser.Physics.Arcade.Sprite
this.physics.add.image(x, y, key)    → Phaser.Physics.Arcade.Image
this.physics.add.staticImage(x, y, key)
this.physics.add.staticSprite(x, y, key)

// Groups
this.physics.add.group(config?)       → dynamic physics group
this.physics.add.staticGroup(config?) → static physics group

// Interactions
this.physics.add.collider(a, b, callback?, process?, scope?)
this.physics.add.overlap(a, b, callback?, process?, scope?)

// ⚠️ Callback argument order is NOT always the call order.
// When one side is a sprite and the other is a group, Phaser rewrites the pair
// to (sprite, group) internally (see collideHandler swap in
// phaser/src/physics/arcade/World.js:1946) before invoking
// collideSpriteVsGroup(sprite, group). The callback then always receives
// (spriteGO, groupMemberGO), even if you called overlap(group, sprite, cb).
//
//   overlap(sprite, sprite, cb)     → cb(sprite1, sprite2)        (preserves order)
//   overlap(sprite, group,  cb)     → cb(sprite, groupMember)
//   overlap(group,  sprite, cb)     → cb(sprite, groupMember)     ← NOT (group, sprite)
//   overlap(groupA, groupB, cb)     → cb(groupAMember, groupBMember)
//   overlap(array,  array,  cb)     → cb(arrayAItem,  arrayBItem) (preserves order)
//
// Same rule applies to collider() and to the processCallback.
// Classic bug this causes: code that "kills the bullet" by calling
// bullet.setActive(false) / body.enable = false on the first callback arg
// actually disables the enemy sprite — subsequent overlap checks bail at
// collideSpriteVsGroup:!bodyA.enable, and the enemy stops responding to
// every collider/overlap (bullets, player contact, etc.) after one hit.

// World
this.physics.world.setBounds(x, y, w, h)
this.physics.world.gravity.y = 300
this.physics.pause() / this.physics.resume()
```

**Body properties:**
```typescript
body.velocity.x / body.velocity.y
body.acceleration.x / body.acceleration.y
body.gravity.y
body.drag.x / body.drag.y
body.maxVelocity.x / body.maxVelocity.y
body.bounce.x / body.bounce.y
body.blocked.down / body.blocked.up / body.blocked.left / body.blocked.right
body.touching.down
body.enable          // toggle physics
body.checkCollision.up/down/left/right
```

**Sprite methods:**
```typescript
sprite.setVelocity(x, y)
sprite.setVelocityX(x)
sprite.setVelocityY(y)
sprite.setAcceleration(x, y)
sprite.setBounce(x, y?)
sprite.setGravity(x, y)
sprite.setFriction(x, y?)
sprite.setCollideWorldBounds(bool)
sprite.setImmovable(bool)
sprite.setMaxVelocity(x, y?)
sprite.setDrag(x, y?)
sprite.refreshBody()          // required after static body changes
```

---

## Loader

`this.load.*` in `preload()`:

| Method | Params | Notes |
|--------|--------|-------|
| `image(key, url)` | | |
| `spritesheet(key, url, frameConfig)` | `{ frameWidth, frameHeight, margin?, spacing? }` | |
| `atlas(key, imgUrl, jsonUrl)` | | TexturePacker JSON Hash |
| `tilemapTiledJSON(key, url)` | | Tiled JSON export |
| `tilemapCSV(key, url)` | | |
| `audio(key, urls)` | `string \| string[]` | Multiple formats fallback |
| `audioSprite(key, jsonUrl, audioUrl)` | | |
| `json(key, url)` | | |
| `xml(key, url)` | | |
| `text(key, url)` | | |
| `bitmapFont(key, imgUrl, xmlUrl)` | | |
| `glsl(key, url)` | | Shader |
| `pack(key, url)` | | Asset pack JSON |

**Progress events:**
```typescript
this.load.on('progress', (value: number) => { bar.scaleX = value; });
this.load.on('complete', () => { this.scene.start('GameScene'); });
```

---

## Input

```typescript
// Keyboard
const cursors = this.input.keyboard.createCursorKeys();
// → { up, down, left, right, space, shift } — all Key objects

const key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
key.isDown  // poll
this.input.keyboard.on('keydown-SPACE', handler);
this.input.keyboard.on('keyup-A', handler);

// Disable browser shortcuts
this.input.keyboard.disableGlobalCapture();

// Pointer
this.input.on('pointerdown', (ptr) => { ptr.x; ptr.y; ptr.button; });
this.input.on('pointerup', handler);
this.input.on('pointermove', handler);

// Interactive game objects
go.setInteractive()                                     // rectangle hitbox (default)
go.setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains)
go.setInteractive({ pixelPerfect: true })              // alpha-based hit
go.on('pointerdown', handler)
go.on('pointerover', handler)  // hover start
go.on('pointerout', handler)   // hover end

// Drag
this.input.setDraggable(go)
go.on('drag', (ptr, dragX, dragY) => go.setPosition(dragX, dragY))
go.on('dragstart', handler)
go.on('dragend', handler)

// Gamepad
this.input.gamepad.on('connected', (pad) => { ... });
const pad = this.input.gamepad.getPad(0);
pad.axes[0].getValue()  // left stick X
pad.buttons[0].pressed  // A button
```

---

## Cameras

```typescript
const cam = this.cameras.main;

// Follow
cam.startFollow(target, roundPixels?, lerpX?, lerpY?, offsetX?, offsetY?)
cam.stopFollow()

// Bounds
cam.setBounds(x, y, width, height, centerOn?)

// Transform
cam.setZoom(value)
cam.setRotation(radians)
cam.setScroll(x, y)
cam.scrollX / cam.scrollY

// Effects
cam.fadeIn(duration, r?, g?, b?, callback?)
cam.fadeOut(duration, r?, g?, b?, callback?)
cam.shake(duration, intensity?, force?, callback?)
cam.flash(duration, r?, g?, b?, force?, callback?)
cam.pan(x, y, duration, ease?, force?, callback?)
cam.zoomTo(zoom, duration, ease?, force?, callback?)

// Multiple cameras
const minimap = this.cameras.add(0, 0, 200, 150);
minimap.setZoom(0.2);
minimap.ignore(player);  // don't render player in minimap

// Ignore a GO in main camera
this.cameras.main.ignore(uiElement);
```

---

## Tweens

```typescript
this.tweens.add({
    targets: go | go[],
    // Any numeric property: x, y, alpha, scaleX, rotation, angle, etc.
    x: 500,
    y: { from: 0, to: 200 },
    alpha: { value: 0, duration: 200, ease: 'Linear' },
    duration: 1000,
    delay: 500,
    ease: 'Power2',     // Linear, Sine, Bounce, Elastic, Back, Expo, Circ, Quad, Cubic, Quart, Quint
    easeParams: [],
    repeat: 0,          // -1 = infinite
    yoyo: false,
    hold: 0,            // ms before yoyo
    repeatDelay: 0,
    paused: false,
    onStart: () => {},
    onUpdate: () => {},
    onRepeat: () => {},
    onYoyo: () => {},
    onComplete: () => {}
});

// Timeline (sequence)
this.tweens.timeline({
    tweens: [
        { targets: go, x: 100, duration: 300 },
        { targets: go, y: 200, duration: 300 }
    ]
});

// Counter tween
this.tweens.addCounter({
    from: 0, to: 100, duration: 2000,
    onUpdate: (tween) => { const v = Math.round(tween.getValue()); }
});
```

---

## Sound

```typescript
// Add
const sfx = this.sound.add('key', { volume: 1, loop: false, rate: 1 });
sfx.play();
sfx.pause() / sfx.resume() / sfx.stop();
sfx.setVolume(0.5);
sfx.setRate(1.5);  // pitch shift
sfx.setDetune(100); // cents

// Background music pattern
const bgm = this.sound.add('bgm', { loop: true, volume: 0.3 });
if (!this.sound.get('bgm')?.isPlaying) bgm.play();

// Global
this.sound.setVolume(0.8);
this.sound.mute = true;
this.sound.pauseAll() / this.sound.resumeAll() / this.sound.stopAll();

// Events
sfx.on('complete', handler);
sfx.on('looped', handler);
```

---

## Scene Plugin

```typescript
// From within a scene: this.scene.*
this.scene.start(key, data?)      // stop self, start target
this.scene.restart(data?)         // restart current scene
this.scene.launch(key, data?)     // run in parallel
this.scene.sleep(key?)            // pause update + render
this.scene.wake(key?, data?)
this.scene.pause(key?)            // pause update only
this.scene.resume(key?)
this.scene.stop(key?)             // shutdown
this.scene.remove(key)            // remove from manager
this.scene.switch(key)            // sleep self, wake target
this.scene.get(key)               // get scene instance
this.scene.isActive(key) → bool
this.scene.isSleeping(key) → bool
this.scene.bringToTop(key?)
this.scene.sendToBack(key?)
this.scene.moveAbove(keyA, keyB)
this.scene.moveBelow(keyA, keyB)

// Data to/from scene
this.scene.start('Next', { level: 2 });
// Receive in Next.init(data) { this.level = data.level; }

// Cross-scene event bus
this.game.events.emit('custom-event', payload);
this.game.events.on('custom-event', handler);
```

---

## Math Utilities

```typescript
Phaser.Math.Between(min, max)           // random int
Phaser.Math.FloatBetween(min, max)      // random float
Phaser.Math.Clamp(value, min, max)
Phaser.Math.Lerp(a, b, t)
Phaser.Math.Distance.Between(x1,y1, x2,y2)
Phaser.Math.Angle.Between(x1,y1, x2,y2)  // radians
Phaser.Math.DegToRad(degrees)
Phaser.Math.RadToDeg(radians)
Phaser.Math.Wrap(value, min, max)
Phaser.Math.Snap.To(value, gap)
Phaser.Math.Vector2                    // 2D vector class (also REPLACES Geom.Point)

// v4 constants (CHANGED from v3):
// Phaser.Math.TAU = PI * 2  (was PI/2 in v3 — that was a bug)
// Phaser.Math.PI_OVER_2 = PI / 2  (new — for the old TAU value)
// Phaser.Math.PI2 REMOVED — use Phaser.Math.TAU

// Geometry
new Phaser.Geom.Rectangle(x, y, w, h)
new Phaser.Geom.Circle(x, y, radius)
// Phaser.Geom.Point REMOVED in v4 — use Phaser.Math.Vector2
new Phaser.Math.Vector2(x, y)          // replaces Geom.Point
Phaser.Geom.Rectangle.Contains(rect, x, y) → bool
```

---

## Filters (NEW in v4 — replaces FX + Masks)

```typescript
// Apply internal filter (affects just the object)
sprite.filters.internal.add(new Phaser.Filters.Blur({ strength: 4 }));
sprite.filters.internal.add(new Phaser.Filters.Glow({ outerStrength: 3 }));
sprite.filters.internal.add(new Phaser.Filters.Vignette());
sprite.filters.internal.add(new Phaser.Filters.Pixelate({ amount: 4 }));

// Apply external filter (full-screen / scene context)
sprite.filters.external.add(new Phaser.Filters.ColorMatrix());

// Mask filter (replaces BitmapMask)
const mask = new Phaser.Filters.Mask(maskSprite);
sprite.filters.internal.add(mask);

// Bloom → Action
Phaser.Actions.AddEffectBloom(target, { strength: 0.5, radius: 1 });

// Shine → Action
Phaser.Actions.AddEffectShine(target, { speed: 0.3, lineWidth: 0.5 });

// Shape mask → Action
Phaser.Actions.AddMaskShape(target, new Phaser.Geom.Circle(cx, cy, r));

// Remove all filters
sprite.filters.internal.clear();

// Apply filter to camera
this.cameras.main.filters.internal.add(new Phaser.Filters.Vignette());
```

---

## Events

Key built-in event strings:

```typescript
// Scene lifecycle
Phaser.Core.Events.READY
Phaser.Scenes.Events.CREATE
Phaser.Scenes.Events.SHUTDOWN
Phaser.Scenes.Events.DESTROY
Phaser.Scenes.Events.PAUSE
Phaser.Scenes.Events.RESUME

// Animation
Phaser.Animations.Events.ANIMATION_START
Phaser.Animations.Events.ANIMATION_COMPLETE
Phaser.Animations.Events.ANIMATION_REPEAT

// Input
Phaser.Input.Events.POINTER_DOWN
Phaser.Input.Events.POINTER_UP
Phaser.Input.Events.POINTER_MOVE
Phaser.Input.Events.GAME_OBJECT_POINTER_DOWN
Phaser.Input.Events.DRAG
Phaser.Input.Events.DRAG_START
Phaser.Input.Events.DRAG_END

// Camera
Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE
Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE
Phaser.Cameras.Scene2D.Events.SHAKE_COMPLETE

// Loader
Phaser.Loader.Events.COMPLETE
Phaser.Loader.Events.PROGRESS
Phaser.Loader.Events.FILE_COMPLETE

// Physics
Phaser.Physics.Arcade.Events.COLLIDE
Phaser.Physics.Arcade.Events.OVERLAP
Phaser.Physics.Arcade.Events.WORLD_BOUNDS

// Game Object
Phaser.GameObjects.Events.ADDED_TO_SCENE
Phaser.GameObjects.Events.REMOVED_FROM_SCENE
Phaser.GameObjects.Events.DESTROY
```
