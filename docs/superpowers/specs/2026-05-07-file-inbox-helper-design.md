# File Inbox Helper Design

## Overview

Petclaw currently exposes a screenshot action in the desktop pet toolbar and settings panel. The desired feature is not screenshot capture, but a lightweight file inbox helper: a safe local intake tray for files, images, and clipboard content.

The screenshot entry should be replaced by a "收纳" entry. The first version should feel like a small file transfer tray, not a heavy document management system or upload workflow.

## Goals

- Replace the toolbar screenshot button with a file inbox button.
- Remove or replace visible "Screenshot" wording from the settings panel.
- Let users collect files into a local Inbox without moving or deleting the original files.
- Support drag in: users can drag files onto the pet or inbox tray to collect them.
- Support drag out: users can drag collected file cards back out to the desktop, folders, upload fields, chat apps, or other apps.
- Use the Inbox copy as the drag-out source, not the original file.
- Support manual clipboard collection by default.
- Reserve a path for clipboard history, with automatic clipboard listening disabled by default.

## Non-Goals

- No Lark or Feishu upload workflow in this feature.
- No automatic screenshot capture.
- No deletion of original files.
- No complex AI auto-classification in P0.
- No long-term full clipboard-history database in P0.
- No broad redesign of the pet toolbar beyond replacing the screenshot entry and adding the inbox tray.

## Product Shape

The "收纳" toolbar button opens a compact HUD tray. The tray has four core jobs:

- Add files through the system file picker.
- Collect the current clipboard content.
- Show recent collected items.
- Open the local Inbox folder.

Dragging files onto the pet or tray should perform the same collect action as adding files through the picker. After a successful drag-in, the tray briefly appears or updates to show the new item.

Recent item cards are draggable. Dragging a card out should provide the collected Inbox file path to the OS drag operation.

## Inbox Location And Storage Rules

Default Inbox root:

```text
Documents/Petclaw Inbox/
```

Implementation should resolve this through Electron/Node's user documents path, not by hardcoding a username-specific path.

Default folder layout:

```text
Documents/Petclaw Inbox/YYYY-MM-DD/<type>/
```

Initial type buckets:

- `images`
- `docs`
- `sheets`
- `slides`
- `text`
- `links`
- `archives`
- `other`

Collection rules:

- Files are copied into the Inbox. Originals are left untouched.
- Duplicate names get a suffix such as `filename (2).pdf`.
- Drag-out uses the copied `inboxPath`.
- Removing an item from "recent collected" hides/removes the record only. It does not delete the copied file.
- If the Inbox copy is missing, the UI should show "文件已不在 Inbox" and offer to remove the stale record.

## Clipboard Rules

Manual clipboard collection is P0:

- Users click "收纳剪切板" to read the current clipboard.
- File and image clipboard content must be supported.
- Text, links, and code snippets should be collected when practical.
- Text/code snippets are saved under `text` as `.txt`.
- Links are saved under `links` as `.url` when feasible, otherwise `.txt`.

Automatic clipboard history is a reserved capability:

- A settings switch can be introduced as "记录剪切板历史".
- The default is off.
- P0 may show the switch disabled or omit it until implementation is ready.

## UI Design

### Toolbar

In `index.html`, replace:

- `btnScreenshot`
- title text "截图"
- `onclick="screenshot()"`
- camera icon

with a file inbox entry:

- `btnInbox`
- title text "收纳"
- `onclick="toggleInboxTray()"`
- inbox/file-tray icon

The settings panel should remove or replace the existing `Screenshot` button. Suggested replacement:

- `Open Inbox`
- or `File Inbox`

### Inbox Tray

The tray should match the current compact HUD style:

- Pixel-border panel.
- Small icon buttons.
- Dense but readable layout.
- No explanatory marketing copy.

Suggested structure:

- Header: `File Inbox`
- Actions row: `添加文件`, `收纳剪切板`, `打开 Inbox`
- Drop zone: `拖文件到这里收纳`
- Clipboard hint when relevant: `剪切板可收纳`
- Recent list with file cards.

Each recent file card should show:

- File name.
- Type bucket.
- Source: picker, drag, clipboard.
- Time.
- Actions: open, reveal, remove record.
- Optional action: send to assistant.

File cards must support drag-out for real files. Text/link cards can use copy-to-clipboard in P0 if native drag-out is unreliable.

### Drag States

When files are dragged over the pet or tray:

- Highlight the pet/tray.
- Show "松手收纳".
- Pause conflicting roam/toolbar dismissal behavior while drag-over is active.

On drop:

- Copy files into the Inbox.
- Update recent list.
- Show success state.
- On failure, show the specific error.

## Architecture

### Main Process Module

Create `inbox-system.js`.

Responsibilities:

- Resolve Inbox root.
- Create date/type directories.
- Classify file types by extension and clipboard payload kind.
- Copy files safely.
- Handle duplicate file names.
- Persist recent records.
- Read clipboard content.
- Open files.
- Reveal files in the OS file manager.
- Open Inbox root.
- Provide file paths for drag-out.

This module should avoid UI concerns. It should expose methods that are easy to unit test with temporary directories.

### Main Process Integration

In `main.js`:

- Instantiate `InboxSystem` during window setup.
- Register IPC handlers.
- Use Electron `dialog.showOpenDialog` for "添加文件".
- Use Electron `clipboard` for manual clipboard collection.
- Use `shell.openPath` and `shell.showItemInFolder`.
- Use `event.sender.startDrag(...)` or `webContents.startDrag(...)` for drag-out.

The screenshot system can remain in the codebase if other diagnostics still depend on it, but the toolbar/settings UI must stop exposing it.

### Renderer Integration

In `index.html`:

- Add the inbox tray markup and styles.
- Replace `screenshot()` UI calls with inbox tray interactions.
- Implement drag-over/drop handlers for the pet and tray.
- Render recent records.
- Start drag-out from recent cards.
- Keep the tray from interfering with chat, settings, and pet game panels.

### Preload Channels

Add these invoke channels to `preload.js`:

- `inbox-get-state`
- `inbox-add-files`
- `inbox-capture-clipboard`
- `inbox-open-root`
- `inbox-open-item`
- `inbox-reveal-item`
- `inbox-remove-record`
- `inbox-start-drag`

## Data Model

Persist recent records in a local JSON file, initially:

```text
pet-inbox.json
```

Suggested record shape:

```json
{
  "id": "inbox_20260507_001",
  "name": "report.pdf",
  "type": "docs",
  "source": "picker",
  "originalPath": "C:\\Users\\...\\Desktop\\report.pdf",
  "inboxPath": "C:\\Users\\...\\Documents\\Petclaw Inbox\\2026-05-07\\docs\\report.pdf",
  "size": 123456,
  "createdAt": "2026-05-07T10:30:00.000Z",
  "note": ""
}
```

For clipboard text/link items, `originalPath` can be omitted or set to null, while `inboxPath` points to the generated `.txt` or `.url` file.

Recent list size can start at 20 records. Older records can remain in the JSON or be pruned after 100 records; P0 should keep behavior simple and predictable.

## Priority

### P0

- Replace screenshot toolbar entry with inbox entry.
- Remove visible screenshot entry from settings.
- File picker collection.
- Drag-in collection from pet/tray.
- Manual clipboard collection for files/images.
- Date/type Inbox copy layout.
- Duplicate name handling.
- Recent list persisted across restart.
- Open item, reveal item, open Inbox.
- Remove recent record without deleting the copied file.
- Drag-out for collected files/images using the Inbox copy.
- Unit tests for pure archive/classification/record behavior.
- Preload channel coverage.

### P1

- Clipboard text/link/code collection.
- Copy text/link item back to clipboard.
- Optional "send to assistant" action.
- Clipboard history setting placeholder.

### Later

- Automatic clipboard history.
- Search, pin, and delete for clipboard history.
- AI-assisted naming, summaries, or tags.
- Configurable Inbox root.
- Optional cleanup tools for copied Inbox files.

## Error Handling

The UI should surface specific, short errors:

- Source file missing.
- Copy failed.
- Permission denied.
- Clipboard unsupported.
- Inbox file missing.

Failures should not crash the pet UI. Partial multi-file collection should return successes and failures together.

## Testing

Unit tests:

- Type classification.
- Inbox path generation.
- Duplicate name generation.
- Copy behavior with temporary files.
- Record add/remove.
- Missing copied file detection.
- Clipboard payload normalization where it can be isolated from Electron.

Existing preload channel tests should be extended to cover new `inbox-*` channels.

Manual verification:

- Drag file onto pet.
- Drag file onto tray.
- Drag recent item out to desktop or a folder.
- Drag recent item to an upload field if available.
- Collect clipboard file/image.
- Confirm original file remains in place.
- Confirm copied file exists in `Documents/Petclaw Inbox/YYYY-MM-DD/<type>/`.

## Open Decisions

- Whether P0 includes text/link clipboard collection or leaves it as P1 depends on Electron clipboard behavior during implementation.
- Whether the settings panel shows `Open Inbox` only, or also a disabled `记录剪切板历史` switch, can be decided during implementation based on available space.
