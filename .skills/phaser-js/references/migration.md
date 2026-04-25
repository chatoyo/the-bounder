# Phaser 3 → 4 Migration Guide

Official full guide: https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/MIGRATION-GUIDE.md

## TL;DR

For games using the **standard API** (sprites, text, tilemaps, arcade physics): a few hours of work, mostly find-and-replace.  
For games with **custom WebGL pipelines or shaders**: plan for more — rewrites required.

---

## Breaking Changes by Impact

### 1. Renderer — Pipelines → RenderNodes (HIGH impact only if custom pipelines)

| v3 | v4 |
|----|----|
| Custom pipeline extending `Phaser.Renderer.WebGL.WebGLPipeline` | Rewrite as RenderNode (`run` method; `batch` method optional) |
| `WebGLRenderer.textureIndexes` | `glTextureUnits.unitIndices` |
| `WebGLRenderer#genericVertexBuffer` | Removed (saves ~16MB RAM/VRAM) |
| Direct `gl.*` calls | Use `Extern` game object instead |

If you only use standard objects (Sprite, Text, Tilemap, etc.) → **no changes needed**.

### 2. Canvas Renderer

Canvas still works but is **deprecated**. No v4 rendering features (filters, GPU layers, advanced lighting) work on Canvas. Use `Phaser.WEBGL` for all new projects.

### 3. FX + Masks → Unified Filters (MEDIUM)

| v3 | v4 |
|----|----|
| `sprite.preFX.addBloom()` | `Phaser.Actions.AddEffectBloom(sprite, config)` |
| `sprite.preFX.addShine()` | `Phaser.Actions.AddEffectShine(sprite, config)` |
| `sprite.preFX.addCircle()` | `Phaser.Actions.AddMaskShape(sprite, new Phaser.Geom.Circle(...))` |
| Gradient FX | `this.add.gradient(...)` (new game object) |
| `BitmapMask` | `new Phaser.Filters.Mask(maskImage)` → `sprite.filters.internal.add(...)` |
| `GeometryMask` | Mask filter |
| `preFX` / `postFX` distinction | `filters.internal` (object) / `filters.external` (scene context) |

### 4. Tint System (LOW-MEDIUM)

| v3 | v4 |
|----|----|
| `sprite.setTint(0xff0000)` | ✅ Unchanged |
| `sprite.setTintFill(0xff0000)` | `sprite.setTint(0xff0000).setTintMode(Phaser.TintModes.FILL)` |
| No tint mode control | `sprite.setTintMode(Phaser.TintModes.MULTIPLY\|FILL\|ADD\|SCREEN\|OVERLAY\|HARD_LIGHT)` |

### 5. Lighting (LOW)

| v3 | v4 |
|----|----|
| Enable lighting via pipeline assignment | `sprite.setLighting(true)` |
| Light height implicit | `light.z = 100` (explicit z value) |

### 6. Camera System (LOW — only if using internals)

Standard camera usage (`startFollow`, `setBounds`, `setZoom`, effects) → **no changes needed**.  
If you access camera matrix internals directly → matrix system restructured, update references.

### 7. Geometry: Point → Vector2 (LOW — find & replace)

| v3 | v4 |
|----|----|
| `new Phaser.Geom.Point(x, y)` | `new Phaser.Math.Vector2(x, y)` |
| `Phaser.Geom.Point.Clone(p)` | `new Phaser.Math.Vector2(p.x, p.y)` |

Find-and-replace `Phaser.Geom.Point` → `Phaser.Math.Vector2` across your codebase.

### 8. Math Constants (LOW — check if used)

| v3 | v4 |
|----|----|
| `Phaser.Math.TAU` = `Math.PI / 2` (⚠️ was a bug!) | `Phaser.Math.TAU` = `Math.PI * 2` (correct) |
| `Phaser.Math.PI2` | Removed → use `Phaser.Math.TAU` |
| — | `Phaser.Math.PI_OVER_2` = `Math.PI / 2` (new constant for old TAU value) |

### 9. Data Structures (LOW — find & replace)

| v3 | v4 |
|----|----|
| `Phaser.Struct.Set` | Native `Set` |
| `Phaser.Struct.Map` | Native `Map` |

Custom methods removed. Use native `Set`/`Map` equivalents.

### 10. DynamicTexture / RenderTexture (LOW — if used)

Drawing commands are no longer executed immediately. Call `.render()` after your draw commands or textures will appear blank.

```typescript
// v3
texture.draw(gameObject, x, y);  // immediate

// v4
texture.draw(gameObject, x, y);
texture.render();  // ← required
```

### 11. Shader API (HIGH if custom shaders)

Complete rewrite required. `PostFXPipeline` is replaced by a two-class system:
- `BaseFilterShader` (RenderNode for rendering)
- A Controller class (manages uniforms, applies to objects)

See: https://phaser.io/news/2025/11/migrating-phaser-3-shaders-to-phaser-4

### 12. roundPixels (LOW — config)

| v3 | v4 |
|----|----|
| `roundPixels: true` (default) | `roundPixels: false` (default) |
| Pixel art just worked | Set `smoothPixelArt: true` in config for pixel art |

### 13. Compressed Textures (LOW — if used)

Re-compress textures for v4's GL Y-axis orientation (Y=0 at bottom, WebGL standard).

### 14. Removed Game Objects

| Removed | Alternative |
|---------|-------------|
| `Mesh` | No direct replacement |
| `Plane` | No direct replacement |
| Camera3D plugin | Removed, no replacement |
| Layer3D plugin | Removed, no replacement |
| Spine 3/4 plugins | Switch to official Esoteric Software Spine plugin |

---

## Migration Checklist

- [ ] Update `npm install phaser` to v4
- [ ] Run game, collect all errors
- [ ] Set `type: Phaser.WEBGL` (drop Canvas)
- [ ] Check for custom WebGL pipelines → rewrite as RenderNodes
- [ ] Replace `preFX/postFX` with Filters / Actions
- [ ] Replace `setTintFill()` → `setTint().setTintMode()`
- [ ] Replace `Geom.Point` → `Math.Vector2`
- [ ] Check `Math.TAU` usage (now `PI*2`)
- [ ] Replace `Phaser.Struct.Set/Map` → native `Set`/`Map`
- [ ] Add `.render()` after DynamicTexture draw calls
- [ ] Rewrite shaders if using custom GLSL
- [ ] Set `smoothPixelArt: true` if pixel art game
- [ ] Re-compress textures if using compressed formats
- [ ] Migrate Spine plugin if applicable
- [ ] Set `lighting.z` explicitly on lights if used
- [ ] Enable lighting with `sprite.setLighting(true)`
- [ ] Test `roundPixels` behavior (now false by default)

---

## What Didn't Change

- Scene lifecycle (`init`, `preload`, `create`, `update`)
- Scene management (`scene.start`, `scene.launch`, `scene.sleep`, etc.)
- Arcade Physics API
- Matter.js API
- Animation system
- Input system (keyboard, mouse, touch, gamepad)
- Standard camera usage
- Tweens
- Tilemaps (Tiled JSON)
- Audio
- Object pooling with Groups
- `this.add.*` factory for standard objects
- Cross-scene communication (registry, events)
- Timer (`this.time.*`)
- All `Phaser.Math.*` utilities (except TAU/PI2)
