/**
 * IG Sanitize — Comment History Deleter
 *
 * Bulk-deletes your Instagram comments from the "Your Activity" page.
 * Part of a digital hygiene / OSINT footprint reduction toolkit.
 *
 * Based on original script by sbolel (https://gist.github.com/sbolel/a2b2bfde16b3ab185fbc2e2049240abc)
 * Fixed and updated for current Instagram DOM structure (Aug 2026).
 *
 * HOW TO USE:
 *
 * 1. Go to https://www.instagram.com/your_activity/interactions/comments/
 * 2. Open your browser's developer console:
 *    - Chrome/Firefox: Press Ctrl+Shift+J (Windows/Linux) or Cmd+Option+J (Mac)
 *    - Safari: Enable the Develop menu in Safari's Advanced preferences, then press Cmd+Option+C
 * 3. Copy and paste this entire script into the console and press Enter to run it.
 *
 * HOW TO NAVIGATE TO THE COMMENTS PAGE ON INSTAGRAM.COM:
 * 1. Log in to Instagram on a desktop browser.
 * 2. Go to your profile by clicking on the profile icon at the bottom right.
 * 3. Click on "Your Activity" in the menu.
 * 4. Select "Interactions" and then "Comments".
 * 5. Follow the usage steps above to run this script.
 *
 * RATE LIMIT HANDLING:
 * The script detects Instagram's "something went wrong" errors and automatically
 * cools down for 30 seconds before retrying. It also adds periodic pauses every
 * 50 batches. If errors persist for 3 consecutive attempts, the script stops
 * gracefully and logs how far it got.
 *
 * @license MIT
 */
;(async function () {
  // ── Config ──────────────────────────────────────────────────────────────
  const DELETION_BATCH_SIZE = 3
  const DELAY_BETWEEN_ACTIONS_MS = 1000
  const DELAY_BETWEEN_CHECKBOX_CLICKS_MS = 300
  const MAX_RETRIES = 60
  const RATE_LIMIT_COOLDOWN_MS = 30000  // Wait 30s if rate limited
  const MAX_CONSECUTIVE_ERRORS = 3       // Bail after 3 consecutive failures
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
      if (findSelectButton() || findCancelButton()) return true
      await delay(1000)
    }
    return false
  }

  // Detect Instagram error states ("something went wrong", etc.)
  const checkForErrors = () => {
    const body = document.body.innerText.toLowerCase()
    return body.includes('something went wrong') ||
           body.includes('please try again') ||
           body.includes('try again later')
  }

  // Cool down when rate limited
  const waitForRateLimit = async () => {
    console.log('Rate limit or error detected. Cooling down 30s...')
    for (let i = 0; i < 60; i++) {
      await delay(500)
      if (!checkForErrors()) {
        console.log('Error cleared. Resuming.')
        return true
      }
    }
    return false
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

  // Check if a comment item is already selected
  const isChecked = (item) => {
    const icon = item.querySelector('[aria-label="Toggle checkbox"] div[style*="mask-image"]')
    return icon && icon.style.cssText.includes('filled')
  }

  // ── Main loop ────────────────────────────────────────────────────────────
  let batchCount = 0
  let consecutiveErrors = 0

  try {
    while (true) {
      // Check for Instagram error state before each batch
      if (checkForErrors()) {
        const cleared = await waitForRateLimit()
        if (!cleared) {
          console.error('Rate limit did not clear. Stopped after ' + batchCount + ' batches.')
          break
        }
        consecutiveErrors = 0
      }

      const ready = await waitForReady()
      if (!ready) {
        consecutiveErrors++
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error('Too many errors. Stopped after ' + batchCount + ' batches.')
          break
        }
        await delay(5000)
        continue
      }

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
        console.log('No more items. Total batches: ' + batchCount)
        break
      }

      await delay(DELAY_BETWEEN_ACTIONS_MS)

      // Click Delete (the clickable one)
      const deleteBtn = findClickableDelete()
      if (!deleteBtn) {
        consecutiveErrors++
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error('Delete button missing 3 times. Stopped after ' + batchCount + ' batches.')
          break
        }
        await delay(3000)
        continue
      }
      deleteBtn.click()

      // Wait for the confirmation dialog, then click Delete again
      let confirmBtn = null
      for (let i = 0; i < 10; i++) {
        await delay(300)
        confirmBtn = findConfirmDelete()
        if (confirmBtn) break
      }
      if (!confirmBtn) {
        consecutiveErrors++
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error('Confirm button missing 3 times. Stopped after ' + batchCount + ' batches.')
          break
        }
        await delay(3000)
        continue
      }
      confirmBtn.click()

      batchCount++
      consecutiveErrors = 0

      // Log every 10 batches
      if (batchCount % 10 === 0) {
        console.log(
          'Batch ' + batchCount + ' (~' + batchCount * DELETION_BATCH_SIZE + ' comments deleted)'
        )
      }

      // Every 50 batches, add an extra pause to reduce rate limit risk
      let batchDelay = DELAY_BETWEEN_ACTIONS_MS
      if (batchCount % 50 === 0 && batchCount > 0) {
        console.log('Pausing to avoid rate limiting...')
        batchDelay = 3000
      }

      await delay(batchDelay)
      await waitForReady()
      await delay(batchDelay)
    }

    console.log('Done! Total: ~' + batchCount * DELETION_BATCH_SIZE + ' comments in ' + batchCount + ' batches')
  } catch (error) {
    console.error('Stopped: ' + error.message)
    console.log('Deleted ~' + batchCount * DELETION_BATCH_SIZE + ' comments in ' + batchCount + ' batches before stopping.')
  }
})()
