# Instagram Comment Activity Deleter

A script that bulk-deletes your Instagram comments from the "Your Activity" page. You paste it into your browser console, hit Enter, and walk away.

It does the same thing you'd do by hand — click Select, check a few boxes, hit Delete, confirm — just in a loop, 3 at a time, with delays baked in so Instagram doesn't rate-limit you.

## Why

Instagram doesn't let you delete comments in bulk. If you've commented on hundreds of posts over the years and want to clean up, you're stuck clicking through each one individually. This automates that process.

## How to use

1. Go to **https://www.instagram.com/your_activity/interactions/comments/** (log in first)
2. Open your browser's developer console:
   - **Chrome/Edge:** `Ctrl+Shift+J` (Windows) or `Cmd+Option+J` (Mac)
   - **Firefox:** `Ctrl+Shift+K` (Windows) or `Cmd+Option+K` (Mac)
3. Copy the entire contents of [`instagram-comment-activity-deleter.js`](instagram-comment-activity-deleter.js)
4. Paste it into the console and press **Enter**
5. Leave the tab open. The script logs progress as it works.

You'll see output like:
```
Batch 1 deleted (~3 comments total)
Batch 2 deleted (~6 comments total)
Batch 3 deleted (~9 comments total)
...
All comments deleted! Total batches: 47
```

The tab can't be closed while it runs, but your screen can lock and you can switch to other tabs. Just don't close the Instagram tab.

## Configuration

The top of the script has four knobs you can tweak:

```js
const DELETION_BATCH_SIZE = 3            // Comments per batch
const DELAY_BETWEEN_ACTIONS_MS = 1000    // Pause between major steps (1s)
const DELAY_BETWEEN_CHECKBOX_CLICKS_MS = 300  // Pause between checking boxes
const MAX_RETRIES = 60                   // How long to wait for page loads (60s)
```

Smaller batches and longer delays = safer but slower. The defaults are conservative and should work for most accounts.

## How it works

Instagram's "Your Activity" page shows your comments with a Select button at the top. The script:

1. Clicks **Select** to enter selection mode
2. Checks up to 3 comment checkboxes (clicking the comment row, not the checkbox icon — Instagram uses a CSS mask trick where the checkbox itself has `pointer-events: none`)
3. Clicks **Delete** (there are two Delete elements in the DOM; only the one with `pointer-events: auto` actually works)
4. Waits for the confirmation dialog and clicks **Delete** again
5. Waits for the page to reload the comment list
6. Repeats until no comments remain

The batch size is small (3) because Instagram's DOM gets unstable if you try to select too many at once. The delays exist for the same reason.

## Things that could break it

This script manipulates Instagram's DOM directly. If they change their page structure — different ARIA labels, new class names, a different dialog pattern — the script stops working. It'll error out rather than do something unexpected, but still: review the code before you run it.

The selectors this depends on:
- `[aria-label="Delete"]` — the delete button
- `[role="button"][aria-label="Image with button"]` — comment rows in select mode
- `[aria-label="Toggle checkbox"]` — checkboxes (checked via parent element click)
- `[role="dialog"]` — the confirmation popup
- Text content `"Select"` / `"Cancel"` — the mode toggle

## Running it unattended (headless)

The console script needs a live browser tab. If you want true fire-and-forget, you can run it headless via Chrome Remote Debugging + the Chrome DevTools Protocol. See [`headless.md`](headless.md) for instructions.

## Credits

- Original script by [sbolel](https://gist.github.com/sbolel/a2b2bfde16b3ab185fbc2e2049240abc)
- Updated for current Instagram DOM structure (Aug 2026) with fixes for:
  - Select button discovery (text-based instead of `[role="button"]` index)
  - Checkbox interaction (clicking the parent row, not the `pointer-events: none` checkbox)
  - Delete button selection (filtering for `pointer-events: auto`)
  - Confirmation dialog button targeting

## License

MIT — see [LICENSE](LICENSE).
