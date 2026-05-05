# Pet Studio Design

Date: 2026-05-05

## Goal

Petclaw needs a visual pet appearance workspace that matches the Codex hatch-pet flow. Users should configure pets from one Settings entry, inspect each animation before activating it, and have two creation paths:

- Upload a reference image so Petclaw creates a hatch-style generation package now, and can later call an image-generation API automatically.
- Import a completed pet package produced by a Petclaw/Codex skill.

The default pet remains the animated pixel cow cat. The system must keep the current spritesheet package format so future game work can reuse the same animation contract.

## Entry Point

The desktop pet Settings panel gets one pet-facing command: `Pet Studio`. Existing quick pet buttons stay out of the toolbar-level experience. The Pet Studio opens as a separate Electron window because it needs more space than the floating HUD.

## Studio Layout

The Pet Studio window uses a simple black-and-white pixel tool style consistent with the current HUD.

- Left column: pet library.
  - Built-in Cow Cat.
  - Imported packages.
  - Generated request packages.
  - Each item shows name, source, renderer, and active state.
- Center column: live preview.
  - Large pet preview.
  - Action selector for `idle`, `walking`, `happy`, `talking`, `thinking`, `sleepy`, `surprised`, `focused`, `offline`, and `sad`.
  - Preview plays the selected action using the manifest row/frame/duration data.
- Right column: creation and package tools.
  - Upload reference image: asks for pet name and description, then creates the hatch image-generation package with `pet.json`, `imagegen-jobs.json`, `imagegen-prompt.md`, and optional reference image.
  - Import package: accepts a folder containing `pet.json` and required assets.
  - Activate selected pet.
  - Reset to Cow Cat.

## Package Contract

The preferred animation package is a spritesheet:

```json
{
  "id": "custom-id",
  "name": "Pet Name",
  "renderer": "spritesheet",
  "spritesheet": "spritesheet.webp",
  "cell": { "width": 192, "height": 208 },
  "layout": { "columns": 8, "rows": 10 },
  "states": {
    "idle": { "row": 0, "frames": 8, "duration": 140 },
    "walking": { "row": 9, "frames": 8, "duration": 90 }
  }
}
```

Single-image pets remain supported for compatibility, but the Studio labels them as static and does not pretend they have full motion.

## Data Flow

The main process remains the source of truth for appearance state. The Studio uses the existing IPC channels where possible:

- `appearance-get`
- `appearance-set-active`
- `appearance-reset`
- `appearance-import-package`
- `appearance-create-imagegen-request`

New IPC:

- `pet-studio-open`: opens or focuses the Studio window.

The renderer reads `appearance-get`, renders the library, and refreshes after imports, generated package creation, activation, or reset.

## Error Handling

- If an import is canceled, the Studio stays unchanged and shows a short status message.
- If a package is invalid, the existing manifest validation error is shown.
- If a pet lacks a selected state, the preview falls back to `idle`.
- If a renderer is `image`, the preview shows the image in a stable frame and marks it as static.

## Testing

Tests cover the package/manifest behavior rather than fragile DOM pixels:

- Existing appearance helper tests continue to validate the cow-cat spritesheet and hatch generation package.
- Add coverage that generated hatch requests include all Studio-previewable states.
- Add a preload whitelist check so `pet-studio-open` is exposed.

Manual verification:

- Settings opens Pet Studio.
- Studio lists Cow Cat and custom pets.
- Action buttons animate rows without jumping.
- Upload creates a generation package.
- Import activates a completed package.
