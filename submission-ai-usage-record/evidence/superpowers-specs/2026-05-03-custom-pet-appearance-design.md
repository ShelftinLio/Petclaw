# Custom Pet Appearance Design

## Goal

Replace the current glass orb desktop pet with a Codex-inspired pixel cow-cat by default, and add a complete customization system so users can create or import their own pet appearances.

## Context

The current renderer in `index.html` draws a 67px glass orb with CSS layers, eye expressions, mood colors, drag handling, toolbar actions, idle micro-expressions, and gateway-driven mood changes. The new system should keep those interaction behaviors while changing the visual model from a fixed orb to a pet appearance renderer.

OpenAI's Hatch Pet reference uses compact pixel-art companions, transparent sprite cells, a manifest, and multiple animation states. This project does not need to fully clone that internal workflow in the first implementation, but it should adopt the same mental model: a pet is a package with metadata, visual assets, animation states, and a renderer that can select states based on app mood.

## Requirements

- The built-in default appearance is a cow-cat named `cow-cat`.
- The cow-cat should look like a small Codex-style pixel pet: black and white cow markings, chunky readable silhouette, dark outline, simple face, tiny limbs, tail, ears, and vertical `i`-like glowing eyes.
- Existing behaviors remain available: drag, click squish, hover toolbar, input bar, screenshot, voice toggle, model switch, gateway send, mood changes, idle expressions, and status-driven transitions.
- Users can customize the pet through three supported paths:
  - Upload a single image and generate a local pixel-style pet preview.
  - Use AI generation through `$imagegen` to produce multi-state Codex-style pet assets from a prompt or uploaded reference image.
  - Import a complete pet package, including Codex/Hatch-style `pet.json` plus `spritesheet.webp`, or an equivalent folder of state images.
- The app persists the active appearance in `pet-config.json`.
- The first implementation must remain useful without external API credentials. Local image upload and package import should work offline.
- AI generation must use `$imagegen` when invoked from Codex. If later runtime generation inside the Electron app needs an external API, the UI should surface a clear missing-configuration state instead of pretending generation succeeded.

## Data Model

Add an `appearance` section to the existing pet config:

```json
{
  "appearance": {
    "mode": "cow-cat",
    "activePetId": "cow-cat",
    "customPets": []
  }
}
```

Each custom pet entry should use this shape:

```json
{
  "id": "custom-20260503-153000",
  "name": "My Pet",
  "source": "local-image",
  "renderer": "image",
  "assetDir": "assets/pets/custom/custom-20260503-153000",
  "manifestPath": "assets/pets/custom/custom-20260503-153000/pet.json",
  "createdAt": "2026-05-03T15:30:00.000Z"
}
```

Allowed `source` values:

- `built-in`
- `local-image`
- `imagegen`
- `package`

Allowed `renderer` values:

- `dom-cow-cat`: built-in CSS/DOM cow-cat renderer.
- `image`: single transparent image renderer.
- `spritesheet`: manifest-driven sprite renderer.
- `frames`: state-folder renderer.

## File Structure

Create pet assets under:

```text
assets/pets/
  cow-cat/
    pet.json
  custom/
    <pet-id>/
      pet.json
      source.png
      generated.png
      spritesheet.webp
```

`assets/pets/cow-cat/pet.json` describes the built-in cow-cat and declares that it uses the `dom-cow-cat` renderer. The cow-cat visuals live mostly in CSS/DOM, so the initial package does not need a generated bitmap.

Custom pets should always have a `pet.json`, even when created from one image. This gives imported packages, local uploads, and AI-generated pets a shared contract.

## Rendering Architecture

Introduce a small renderer boundary in `index.html`:

- `PetAppearanceStore`: reads and writes appearance settings through IPC.
- `PetRenderer`: selects the rendering strategy for the active pet.
- `CowCatRenderer`: draws the default pixel cow-cat with DOM/CSS.
- `ImagePetRenderer`: draws a single generated image and applies existing mood transforms.
- `SpritePetRenderer`: reads manifest frame geometry and updates background position or image source by mood.

The existing mood system should stay as the source of truth. `setMood(mood)` should continue to update scale, bounce, talking, and idle behavior, then notify the active renderer so visual details can react to the same mood.

## Customization UI

Add a new toolbar button for appearance. Clicking it opens a compact panel next to the pet with these actions:

- `Cow Cat`: switch back to the default built-in pet.
- `Upload Image`: choose a local image and create a local pixel-style pet.
- `Generate with AI`: show the generation panel for `$imagegen` workflow support.
- `Import Package`: choose a folder or files containing a pet package.
- `Reset`: clear active custom selection and return to `cow-cat`.

The panel should be dense and tool-like, matching the current floating toolbar rather than becoming a full settings page.

## Local Image Upload

The Electron main process should expose an IPC handler to open a file picker for images. It should copy the selected image into `assets/pets/custom/<pet-id>/source.<ext>`.

The renderer can then create a local pixel-style preview using canvas:

- Draw the source image into a fixed square working canvas.
- Crop/fit with contain behavior so the subject is not distorted.
- Reduce resolution and scale up with `imageSmoothingEnabled = false`.
- Apply a limited contrast/saturation pass.
- Save the generated PNG through IPC as `generated.png`.
- Create a `pet.json` with `renderer: "image"`.

This is not a substitute for AI-generated animation; it is the offline-friendly customization path.

## AI Generation With `$imagegen`

When Codex is asked to generate pet assets as part of this project, use the installed `$imagegen` skill. The prompt should be pet-specific and terse, following Hatch Pet style:

```text
Create a Codex-compatible small pixel-art cow-cat desktop pet sprite reference on a perfectly flat chroma-key background. Compact chibi proportions, chunky silhouette, thick dark 1-2 px outline, black and white cow-cat markings, tiny ears, tail, tiny paws, vertical i-like glowing eyes, flat cel shading, no text, no shadows, no scenery, no gradients, no detached effects.
```

For user-uploaded reference images, label the image as the character reference and ask `$imagegen` to simplify it into the same Codex digital pet style.

The Electron app should include an `imagegen` source type and manifest format now, but the runtime UI may show a clear configuration-needed message until an API or local generator is wired in. If the user provides extra image-generation API credentials later, the implementation can connect the UI to a real generator without changing the pet package contract.

## Package Import

Package import should accept:

- A folder containing `pet.json` and `spritesheet.webp`.
- A folder containing `pet.json` and state image files.
- A zip package can be added later; folder/file import is enough for the first implementation.

The import path should validate:

- `pet.json` exists and is valid JSON.
- `name` exists or can be inferred from the folder.
- Renderer can be inferred from files if missing.
- `spritesheet.webp` exists for `spritesheet` pets.
- At least one usable image exists for image/frame pets.

Invalid imports return a readable error in the appearance panel.

## Error Handling

- If config loading fails, default to `cow-cat`.
- If the active custom pet is missing files, show `cow-cat` and keep the broken entry in config for troubleshooting.
- If image upload fails, show the error and keep the current pet unchanged.
- If `$imagegen` or runtime AI generation is unavailable, show a configuration-needed message and keep the current pet unchanged.
- If package import validation fails, do not copy partial files into the active pets list.

## Testing

- Add tests for `PetConfig` default `appearance` values.
- Add tests for helper logic that validates and normalizes pet manifests.
- Add tests for switching active pet config without losing existing voice/model settings.
- Run existing Jest tests.
- Start the Electron app in dev mode and visually verify:
  - Default cow-cat renders.
  - Dragging still moves the pet.
  - Toolbar still appears on hover.
  - Mood changes still animate.
  - Local image upload produces a custom pet entry.
  - Reset returns to cow-cat.

## Out Of Scope For First Implementation

- Fully automated nine-row Hatch Pet atlas generation inside the Electron runtime.
- Zip extraction for imported packages.
- Publishing custom pets to an external gallery.
- Replacing the app icon or tray icon with the active pet.

These are intentionally left out so the first implementation can land a stable appearance system without blocking on external services.
