# Phaser 3 — Common Game Patterns

## Table of Contents
1. [Platformer](#platformer)
2. [Top-Down RPG / Shooter](#top-down-rpg--shooter)
3. [Space Shooter (Scrolling)](#space-shooter-scrolling)
4. [Scene Architecture (Multi-scene)](#scene-architecture)
5. [State Machine for Player](#state-machine-for-player)
6. [Save / Load with localStorage](#save--load)
7. [Responsive Scaling](#responsive-scaling)
8. [Particles & Visual FX](#particles--visual-fx)

---

## Platformer

```typescript
class PlatformerScene extends Phaser.Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private canJump = false;

    create() {
        // Tilemap
        const map = this.make.tilemap({ key: 'map' });
        const tiles = map.addTilesetImage('tiles', 'tiles');
        const ground = map.createLayer('Ground', tiles, 0, 0)!;
        ground.setCollisionByProperty({ collides: true });

        // Player
        this.player = this.physics.add.sprite(100, 400, 'player');
        this.player.setCollideWorldBounds(true);
        this.physics.add.collider(this.player, ground);

        // Animations
        this.anims.create({ key: 'run', frames: this.anims.generateFrameNumbers('player', { start: 0, end: 7 }), frameRate: 12, repeat: -1 });
        this.anims.create({ key: 'idle', frames: [{ key: 'player', frame: 0 }], frameRate: 1 });
        this.anims.create({ key: 'jump', frames: [{ key: 'player', frame: 8 }], frameRate: 1 });

        // Camera
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

        this.cursors = this.input.keyboard.createCursorKeys();
    }

    update() {
        const onGround = this.player.body!.blocked.down;
        const { left, right, up } = this.cursors;

        if (left.isDown) {
            this.player.setVelocityX(-180);
            this.player.setFlipX(true);
            if (onGround) this.player.anims.play('run', true);
        } else if (right.isDown) {
            this.player.setVelocityX(180);
            this.player.setFlipX(false);
            if (onGround) this.player.anims.play('run', true);
        } else {
            this.player.setVelocityX(0);
            if (onGround) this.player.anims.play('idle', true);
        }

        if (up.isDown && onGround) {
            this.player.setVelocityY(-420);
            this.player.anims.play('jump', true);
        }
    }
}
```

**Coyote time (jump after leaving edge):**
```typescript
private coyoteTime = 0;
private readonly COYOTE_FRAMES = 6;

update() {
    const onGround = this.player.body!.blocked.down;
    if (onGround) this.coyoteTime = this.COYOTE_FRAMES;
    else this.coyoteTime = Math.max(0, this.coyoteTime - 1);

    if (this.cursors.up.isDown && this.coyoteTime > 0) {
        this.player.setVelocityY(-420);
        this.coyoteTime = 0;
    }
}
```

**Variable jump height (hold for higher):**
```typescript
if (this.cursors.up.isUp && this.player.body!.velocity.y < -100) {
    this.player.setVelocityY(this.player.body!.velocity.y * 0.9);
}
```

---

## Top-Down RPG / Shooter

```typescript
class TopDownScene extends Phaser.Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
    private SPEED = 200;

    create() {
        this.player = this.physics.add.sprite(200, 200, 'player');
        this.player.setCollideWorldBounds(true);

        // 8-direction movement
        this.wasd = {
            up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
        };

        // Y-sort: objects render in front when lower on screen
        // Call setDepth(this.y) on player in update()
    }

    update() {
        let vx = 0, vy = 0;
        if (this.wasd.left.isDown) vx = -this.SPEED;
        else if (this.wasd.right.isDown) vx = this.SPEED;
        if (this.wasd.up.isDown) vy = -this.SPEED;
        else if (this.wasd.down.isDown) vy = this.SPEED;

        // Normalize diagonal movement
        if (vx !== 0 && vy !== 0) {
            vx *= 0.707;
            vy *= 0.707;
        }

        this.player.setVelocity(vx, vy);
        this.player.setDepth(this.player.y);  // Y-sort

        // Face direction
        if (vx < 0) this.player.setFlipX(true);
        else if (vx > 0) this.player.setFlipX(false);
    }
}
```

**Mouse-aim shooting:**
```typescript
this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, ptr.worldX, ptr.worldY);
    const bullet = this.bullets.get(this.player.x, this.player.y) as Phaser.Physics.Arcade.Sprite;
    if (bullet) {
        bullet.setActive(true).setVisible(true);
        this.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), 400, bullet.body!.velocity);
    }
});
```

---

## Space Shooter (Scrolling)

```typescript
class SpaceScene extends Phaser.Scene {
    private starfield!: Phaser.GameObjects.TileSprite;
    private player!: Phaser.Physics.Arcade.Sprite;
    private bullets!: Phaser.Physics.Arcade.Group;
    private enemies!: Phaser.Physics.Arcade.Group;
    private lastFire = 0;

    create() {
        // Parallax background
        this.starfield = this.add.tileSprite(400, 300, 800, 600, 'stars').setScrollFactor(0);

        this.player = this.physics.add.sprite(400, 500, 'ship');
        this.player.setCollideWorldBounds(true);

        this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 30 });
        this.enemies = this.physics.add.group({ defaultKey: 'enemy', maxSize: 10 });

        this.physics.add.overlap(this.bullets, this.enemies, this.hitEnemy, undefined, this);

        // Spawn enemies every 2s
        this.time.addEvent({ delay: 2000, callback: this.spawnEnemy, callbackScope: this, loop: true });
    }

    update(time: number) {
        // Scroll background
        this.starfield.tilePositionY -= 2;

        // Move player with mouse
        this.player.setPosition(
            Phaser.Math.Clamp(this.input.x, 20, 780),
            Phaser.Math.Clamp(this.input.y, 20, 580)
        );

        // Auto-fire
        if (time > this.lastFire + 200) {
            this.lastFire = time;
            const b = this.bullets.get(this.player.x, this.player.y - 20) as Phaser.Physics.Arcade.Sprite;
            if (b) { b.setActive(true).setVisible(true); b.setVelocityY(-500); }
        }

        // Cleanup off-screen
        this.bullets.children.each((go) => {
            const b = go as Phaser.Physics.Arcade.Sprite;
            if (b.active && b.y < -20) this.bullets.killAndHide(b);
        });
        this.enemies.children.each((go) => {
            const e = go as Phaser.Physics.Arcade.Sprite;
            if (e.active && e.y > 620) this.enemies.killAndHide(e);
        });
    }

    spawnEnemy() {
        const x = Phaser.Math.Between(50, 750);
        const e = this.enemies.get(x, -20) as Phaser.Physics.Arcade.Sprite;
        if (e) { e.setActive(true).setVisible(true); e.setVelocityY(Phaser.Math.Between(100, 250)); }
    }

    hitEnemy(bullet: Phaser.GameObjects.GameObject, enemy: Phaser.GameObjects.GameObject) {
        this.bullets.killAndHide(bullet as Phaser.Physics.Arcade.Sprite);
        this.enemies.killAndHide(enemy as Phaser.Physics.Arcade.Sprite);
        this.registry.inc('score', 10);
    }
}
```

---

## Scene Architecture

Recommended structure for a full game:

```
src/
  scenes/
    BootScene.ts        # set global game settings, start Preload
    PreloadScene.ts     # loading bar, load all assets, start Menu
    MenuScene.ts        # main menu, start Game on play
    GameScene.ts        # main gameplay
    UIScene.ts          # HUD, launched in parallel with Game
    GameOverScene.ts    # game over screen
  game.ts               # Phaser.Game config
```

**BootScene** — set scale, registry defaults:
```typescript
class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }
    create() {
        this.registry.set('score', 0);
        this.registry.set('lives', 3);
        this.scene.start('Preload');
    }
}
```

**PreloadScene** — loading bar:
```typescript
class PreloadScene extends Phaser.Scene {
    constructor() { super('Preload'); }
    preload() {
        const bar = this.add.graphics();
        this.load.on('progress', (v: number) => {
            bar.clear().fillStyle(0xffffff).fillRect(160, 290, 480 * v, 20);
        });
        // ... load all assets
    }
    create() { this.scene.start('Menu'); }
}
```

**UIScene** — HUD as separate scene:
```typescript
class UIScene extends Phaser.Scene {
    constructor() { super('UI'); }
    create() {
        const scoreText = this.add.text(16, 16, 'Score: 0', { color: '#fff' });
        scoreText.setScrollFactor(0);

        this.registry.events.on('changedata-score', (_: unknown, value: number) => {
            scoreText.setText('Score: ' + value);
        }, this);
    }
}

// In GameScene:
this.registry.inc('score', 10);  // triggers UIScene listener automatically
```

---

## State Machine for Player

Simple string-based FSM (no library needed):

```typescript
type PlayerState = 'idle' | 'run' | 'jump' | 'fall' | 'attack' | 'dead';

class Player extends Phaser.Physics.Arcade.Sprite {
    private state: PlayerState = 'idle';

    setState(newState: PlayerState) {
        if (this.state === newState) return;
        this.onExit(this.state);
        this.state = newState;
        this.onEnter(newState);
    }

    private onEnter(state: PlayerState) {
        switch(state) {
            case 'jump': this.setVelocityY(-420); this.anims.play('jump'); break;
            case 'dead': this.setTint(0xff0000); this.setVelocityX(0); break;
            default: this.anims.play(state, true);
        }
    }

    private onExit(state: PlayerState) {
        if (state === 'attack') this.clearTint();
    }

    update(cursors: Phaser.Types.Input.Keyboard.CursorKeys) {
        const onGround = (this.body as Phaser.Physics.Arcade.Body).blocked.down;

        if (this.state === 'dead') return;

        if (!onGround && this.body!.velocity.y > 0) this.setState('fall');
        else if (cursors.up.isDown && onGround) this.setState('jump');
        else if (cursors.left.isDown || cursors.right.isDown) this.setState('run');
        else if (onGround) this.setState('idle');
    }
}
```

---

## Save / Load

```typescript
// Save
function save(data: object) {
    localStorage.setItem('phaser-save', JSON.stringify(data));
}

// Load
function load(): object | null {
    const raw = localStorage.getItem('phaser-save');
    return raw ? JSON.parse(raw) : null;
}

// Usage in scene
create() {
    const save = load();
    const score = save?.score ?? 0;
    const level = save?.level ?? 1;
}

// Auto-save on scene sleep/stop
this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
    save({ score: this.registry.get('score'), level: this.currentLevel });
});
```

---

## Responsive Scaling

```typescript
// In game config
scale: {
    mode: Phaser.Scale.FIT,          // fit to screen, maintain aspect ratio
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 600,
    // OR use percentages:
    // width: '100%',
    // height: '100%',
}

// Lock orientation (mobile)
scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
}

// Responsive UI positioning
create() {
    const { width, height } = this.scale;
    const btn = this.add.text(width / 2, height * 0.8, 'PLAY', { fontSize: '48px' });
    btn.setOrigin(0.5);

    // Re-position on resize
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
        btn.setPosition(gameSize.width / 2, gameSize.height * 0.8);
    });
}
```

---

## Particles & Visual FX

**Phaser 3.60+ particle API:**

```typescript
// Explosion burst
this.add.particles(x, y, 'flare', {
    speed: { min: 50, max: 200 },
    scale: { start: 0.8, end: 0 },
    alpha: { start: 1, end: 0 },
    lifespan: 600,
    quantity: 20,
    emitting: false    // burst only
}).explode(20);

// Continuous trail on player
const trail = this.add.particles(0, 0, 'spark', {
    follow: this.player,
    followOffset: { y: 16 },
    speed: { min: 10, max: 40 },
    lifespan: 300,
    scale: { start: 0.4, end: 0 },
    quantity: 2
});

// Stop emitting
trail.stop();
trail.destroy();
```

**Screen flash + shake on hit:**
```typescript
hitEffect() {
    this.cameras.main.shake(200, 0.01);
    this.cameras.main.flash(100, 255, 0, 0);
    this.player.setTint(0xff0000);
    this.time.delayedCall(200, () => this.player.clearTint());
}
```

**Slow-motion effect:**
```typescript
// Slow everything to 20% speed for 500ms
this.physics.world.timeScale = 5;   // physics slow
this.tweens.timeScale = 0.2;         // tweens slow
this.anims.globalTimeScale = 0.2;    // animations slow
this.time.delayedCall(500, () => {
    this.physics.world.timeScale = 1;
    this.tweens.timeScale = 1;
    this.anims.globalTimeScale = 1;
});
```
