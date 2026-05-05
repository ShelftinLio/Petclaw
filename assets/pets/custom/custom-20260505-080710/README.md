# Generated Pet Imagegen Request
This folder is a Petclaw custom pet package scaffold.
1. Open `imagegen-jobs.json` and run each job through Codex `$imagegen`.
2. First generate `base-reference.png`; use it as the canonical reference for every row job.
3. Generate each 8-frame row strip into `rows/<state>.png`.
4. Assemble the rows into `spritesheet.webp` using the same 8x10, 192x208-cell layout.
5. Keep `pet.json` next to `spritesheet.webp`.
6. Import this folder from the Petclaw appearance panel.
Expected output:
- `pet.json`
- `spritesheet.webp`