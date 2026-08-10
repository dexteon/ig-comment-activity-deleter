/**
 * Instagram Comment Activity Deleter
 *
 * Deletes your own comments from Instagram's "Your Activity" page in batches.
 * Works by automating the same clicks you'd do manually: Select, check boxes,
 * Delete, confirm. Runs in a loop until all comments are gone.
 *
 * Based on original script by sbolel (https://gist.github.com/sbolel/a2b2bfde16b3ab185fbc2e2049240abc)
 * Fixed and updated for current Instagram DOM structure (Aug 2026).
 *
 * HOW TO USE:
 *
 * 1. Go to https://www.instagram.com/your_activity/interactions/comments/
 * 2. Open your browser's developer console:
 *    - Chrome/Edge:  Ctrl+Shift+J  (Windows/Linux) or Cmd+Option+J (Mac)
 *    - Firefox:      Ctrl+Shift+K  (Windows/Linux) or Cmd+Option+K (Mac)
 * 3. Paste this entire script and press Enter.
 * 4. Walk away. The script runs until all your comments are deleted.
 *
 * The script deletes 3 comments per batch with built-in delays to avoid
 * rate limiting. It logs progress to the console as it goes.
 *
 * CONFIGURATION:
 * You can change the batch size and delays at the top of the script if you
 * need it faster or slower.
 *
 * WARNING: This directly manipulates the DOM. If Instagram changes their
 * page structure, the script will break (harmlessly — it'll just error out).
 * Always review code before pasting it into your console.
 *
 * @license MIT
 */
;(async function () {
  // ── Config ──────────────────────────────────────────────────────────────
  const DELETION_BATCH_SIZE = 3
  const DELAY_BETWEEN_ACTIONS_MS = 1000
  const DELAY_BETWEEN_CHECKBOX_CLICKS_MS = 300
  const MAX_RETRIES = 60
  // ─────────────────────────────────────────────────────────────────────────

  const delay = (ms) => new Promise((r) => setTimeout(r, ms))

  // Find the "Select" button by text content (Instagram doesn't give it a role)
  const findSelectButton = () =>
    Array.from(document.querySelectorAll('div, span, button')).find(
      (e) => e.innerText && e.innerText.trim() === 'Select' && e.offsetParent !== null
    )

  // In select mode, "Cancel" replaces "Select"
  const findCancelButton = () =>
    Array.from(document.querySelectorAll('div, span, button')).find(
      (e) => e.innerText && e.innerText.trim() === 'Cancel' && e.offsetParent !== null
    )

  // Wait for the page to settle (Select or Cancel visible)
  const waitForReady = async () => {
    for (let i = 0; i < MAX_RETRIES; i++) {
      if (findSelectButton() || findCancelButton()) return
      await delay(1000)
    }
    throw new Error('Timed out waiting for page to become ready')
  }

  // Find the clickable Delete button (there are duplicates; only one has pointer-events: auto)
  const findClickableDelete = () =>
    Array.from(document.querySelectorAll('[aria-label="Delete"]')).find(
      (b) => getComputedStyle(b).pointerEvents === 'auto' && b.offsetParent !== null
    )

  // Find the "Delete" confirm button inside the dialog
  const findConfirmDelete = () => {
    const dialogs = document.querySelectorAll('[role="dialog"]')
    for (const d of dialogs) {
      const buttons = d.querySelectorAll('button')
      for (const b of buttons) {
        if (
          b.innerText &&
          b.innerText.trim().toLowerCase() === 'delete' &&
          b.offsetParent !== null
        )
          return b
      }
    }
    return null
  }

  // Check if a comment item is already selected (checkbox icon changes from outline to filled)
  const isChecked = (item) => {
    const icon = item.querySelector('[aria-label="Toggle checkbox"] div[style*="mask-image"]')
    return icon && icon.style.cssText.includes('filled')
  }

  // ── Main loop ────────────────────────────────────────────────────────────
  let batchCount = 0

  try {
    while (true) {
      await waitForReady()

      // Enter select mode if we're not already in it
      const selectBtn = findSelectButton()
      if (selectBtn) {
        selectBtn.click()
        await delay(DELAY_BETWEEN_ACTIONS_MS)
      }

      // Find comment items (only visible in select mode)
      const items = document.querySelectorAll(
        '[role="button"][aria-label="Image with button"]'
      )
      if (items.length === 0) {
        console.log('All comments deleted! Total batches: ' + batchCount)
        break
      }

      // Check up to BATCH_SIZE items
      let selected = 0
      for (const item of items) {
        if (selected >= DELETION_BATCH_SIZE) break
        if (!isChecked(item)) {
          item.click()
          selected++
          await delay(DELAY_BETWEEN_CHECKBOX_CLICKS_MS)
        }
      }

      if (selected === 0) {
        console.log('No more items to select. Total batches: ' + batchCount)
        break
      }

      await delay(DELAY_BETWEEN_ACTIONS_MS)

      // Click Delete (the clickable one)
      const deleteBtn = findClickableDelete()
      if (!deleteBtn) throw new Error('Delete button not found')
      deleteBtn.click()

      // Wait for the confirmation dialog, then click Delete again
      let confirmBtn = null
      for (let i = 0; i < 10; i++) {
        await delay(300)
        confirmBtn = findConfirmDelete()
        if (confirmBtn) break
      }
      if (!confirmBtn) throw new Error('Confirmation button not found')
      confirmBtn.click()

      batchCount++
      console.log(
        'Batch ' +
          batchCount +
          ' deleted (~' +
          batchCount * DELETION_BATCH_SIZE +
          ' comments total)'
      )

      await delay(DELAY_BETWEEN_ACTIONS_MS)
      await waitForReady()
      await delay(DELAY_BETWEEN_ACTIONS_MS)
    }

    console.log('Done! Total comments deleted: ~' + batchCount * DELETION_BATCH_SIZE)
  } catch (error) {
    console.error('Stopped: ' + error.message)
    console.log('Deleted ' + batchCount * DELETION_BATCH_SIZE + ' comments in ' + batchCount + ' batches before stopping.')
  }
})()
