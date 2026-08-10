# IG Sanitize

Bulk-delete your Instagram comment history from the "Your Activity" page. Reduces your OSINT footprint by wiping years of comments in one run. Paste into your browser console and walk away.

Part of a digital hygiene toolkit. Think of it like [EasyOptOuts](https://www.easyoptouts.com) or [DeleteMe](https://joindeleteme.com), but for the data Instagram already has about you — specifically, the public commentary that builds a profile of your interests, opinions, and associations over time.

## Why this exists

Every comment you leave on Instagram is a data point. It shows up on the post, in your activity log, in Instagram's recommendation engine, and in the databases of anyone scraping the platform. Intelligence X, Maltego, and similar OSINT tools index Instagram comments. So do marketing firms and data brokers.

Your comments reveal:
- Political leanings and opinions on current events
- Accounts you interact with (and by extension, their communities)
- Your writing style, vocabulary, and patterns of speech
- Geographic clues (local news, regional slang)
- Timestamps and activity patterns

Deleting comments doesn't make you invisible. But it removes one of the easiest surface-level datasets that anyone — from a stalker to a prospective employer to a data broker — can scrape without any special access.

This script targets the one category Instagram actually lets you bulk-delete: comments. Likes, story replies, and search history are separate and need their own cleanup (see [Roadmap](#roadmap)).

## How to use

1. Go to **https://www.instagram.com/your_activity/interactions/comments/** (log in first)
2. Open your browser's developer console:
   - **Chrome/Edge:** `Ctrl+Shift+J` (Windows) or `Cmd+Option+J` (Mac)
   - **Firefox:** `Ctrl+Shift+K` (Windows) or `Cmd+Option+K` (Mac)
3. Copy the entire contents of [`ig-sanitize.js`](ig-sanitize.js)
4. Paste it into the console and press **Enter**
5. Leave the tab open. The script logs progress as it works.

```
Batch 1 deleted (~3 comments total)
Batch 2 deleted (~6 comments total)
...
Batch 145 deleted (~435 comments total)
All comments deleted! Total batches: 145
```

The tab can't be closed while it runs, but your screen can lock and you can switch to other tabs. Just don't close the Instagram tab. Closing it kills the script.

## Configuration

```js
const DELETION_BATCH_SIZE = 3            // Comments per batch
const DELAY_BETWEEN_ACTIONS_MS = 1000    // Pause between major steps (1s)
const DELAY_BETWEEN_CHECKBOX_CLICKS_MS = 300  // Pause between checking boxes
const MAX_RETRIES = 60                   // How long to wait for page loads (60s)
const RATE_LIMIT_COOLDOWN_MS = 30000     // Cooldown when rate limited (30s)
const MAX_CONSECUTIVE_ERRORS = 3         // Bail after 3 consecutive failures
```

Smaller batches and longer delays = safer but slower. The defaults are conservative.

## Rate limiting

Instagram will eventually show "something went wrong" if you delete too many comments too fast. The script handles this three ways:

1. **Error detection** — checks the page text for Instagram's error messages before each batch
2. **Auto-cooldown** — pauses for 30 seconds when an error is detected, then retries
3. **Periodic pauses** — adds a 3-second delay every 50 batches
4. **Graceful bail** — stops after 3 consecutive failures and logs how far it got

If the script stops due to rate limiting, wait a few minutes and run it again. It picks up where it left off (deleting whatever comments remain).

## How it works

Instagram's "Your Activity" page shows your comments with a Select button at the top. The script:

1. Clicks **Select** to enter selection mode
2. Checks up to 3 comment rows (clicking the row itself, not the checkbox icon — Instagram uses a CSS mask trick where the checkbox element has `pointer-events: none` and only the parent row is actually clickable)
3. Clicks **Delete** (there are two Delete elements in the DOM; only the one with `pointer-events: auto` actually works)
4. Waits for the confirmation dialog and clicks **Delete** again
5. Waits for the page to reload the comment list
6. Repeats until no comments remain

Batch size is 3 because Instagram's DOM gets unstable with larger selections. The delays exist for the same reason and to avoid rate-limiting.

## Running headless

The console script needs a live browser tab. For true fire-and-forget, you can drive Chrome via the DevTools Protocol. See [`headless.md`](headless.md).

This is useful if you're building an automated hygiene routine (e.g., run weekly via cron to catch new comments).

## What this does NOT do

- Delete your likes (separate activity page, same technique)
- Delete your story replies
- Clear your search history
- Remove cached copies from third-party scrapers (Intelligence X, Wayback Machine, etc.)
- Delete the post itself or other people's comments
- Make your account private or change any settings

If you've commented publicly for years, assume some of that data has already been scraped and archived. This tool cleans the source (Instagram), not the downstream copies.

## Roadmap

- [x] Comment deletion (this repo)
- [ ] Like removal (`/your_activity/interactions/likes/`)
- [ ] Story reply deletion (`/your_activity/interactions/story_replies/`)
- [ ] Search history clearing (`/your_activity/search_history/`)
- [ ] Headless automation script (cron-able, Docker-ready)

## Things that could break it

This script manipulates Instagram's DOM directly. If they change their page structure, it stops working. It'll error out rather than do something wrong, but review the code before running it.

Key selectors:
- `[aria-label="Delete"]` — delete button
- `[role="button"][aria-label="Image with button"]` — comment rows (select mode)
- `[aria-label="Toggle checkbox"]` — checkboxes (clicked via parent row)
- `[role="dialog"]` — confirmation popup
- Text `"Select"` / `"Cancel"` — mode toggle

## Credits

- Original comment deletion script by [sbolel](https://gist.github.com/sbolel/a2b2bfde16b3ab185fbc2e2049240abc)
- Fixed and reworked for current Instagram DOM (Aug 2026): text-based Select discovery, parent-element checkbox clicks, `pointer-events` filtering, dialog-scoped confirmation targeting

## License

MIT — see [LICENSE](LICENSE).
