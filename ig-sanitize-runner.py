#!/usr/bin/env python3
"""
IG Sanitize — CDP Runner

Drives the comment deletion loop from Python via the Chrome DevTools Protocol.
More reliable than the console script for large deletions because Python controls
timing, handles page reloads, and reconnects if the WebSocket drops.

Requires Chrome running with --remote-debugging-port=9222 and the `websockets` package.

Usage:
    pip install websockets
    python ig-sanitize-runner.py

Chrome must be running with remote debugging:
    Start-Process chrome -ArgumentList '--remote-debugging-port=9222', \
        'https://www.instagram.com/your_activity/interactions/comments/'

Progress is saved to localStorage so you can resume across runs.
"""

import asyncio
import json
import time
import urllib.request

COMMENTS_URL = "https://www.instagram.com/your_activity/interactions/comments/"


def cdp_eval(js, timeout=15):
    """Evaluate JS on the Instagram tab via CDP."""
    import websockets

    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
    ig_tab = [t for t in tabs if t["type"] == "page" and "instagram" in t.get("url", "").lower()]
    if not ig_tab:
        return {"error": "no_ig_tab"}
    ws_url = ig_tab[0]["webSocketDebuggerUrl"]

    async def run():
        async with websockets.connect(ws_url) as ws:
            msg = {
                "id": 1,
                "method": "Runtime.evaluate",
                "params": {"expression": js, "returnByValue": True, "awaitPromise": True},
            }
            await ws.send(json.dumps(msg))
            while True:
                resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=timeout))
                if resp.get("id") == 1:
                    raw = resp.get("result", {}).get("result", {}).get("value")
                    if isinstance(raw, dict):
                        return raw
                    if isinstance(raw, str):
                        try:
                            return json.loads(raw)
                        except Exception:
                            return {"_raw": raw}
                    return {"_value": raw}

    try:
        return asyncio.run(run())
    except Exception as e:
        return {"error": str(e)}


def cdp_navigate(url, wait=10):
    """Navigate the IG tab to a URL and wait."""
    import websockets

    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
    ig_tab = [t for t in tabs if t["type"] == "page" and "instagram" in t.get("url", "").lower()]
    if not ig_tab:
        return False
    ws_url = ig_tab[0]["webSocketDebuggerUrl"]

    async def run():
        async with websockets.connect(ws_url) as ws:
            msg = {"id": 1, "method": "Page.navigate", "params": {"url": url}}
            await ws.send(json.dumps(msg))
            while True:
                resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
                if resp.get("id") == 1:
                    break

    try:
        asyncio.run(run())
        time.sleep(wait)
        return True
    except Exception:
        return False


def get_batch_count():
    """Read the batch count from localStorage."""
    r = cdp_eval("localStorage.getItem('ig_sanitize_batches')")
    try:
        return int(r.get("_raw", r.get("_value", 0)) or 0)
    except Exception:
        return 0


def main():
    # Reload fresh to start
    print("Loading comments page...")
    cdp_navigate(COMMENTS_URL, wait=10)

    total = get_batch_count()
    errors = 0
    MAX_ERRORS = 5
    start = time.time()
    print(f"Starting (previous batches: {total}, ~{total * 3} comments deleted)")
    print("Press Ctrl+C to stop. Progress is saved.\n")

    try:
        while True:
            # --- Click Select ---
            r = cdp_eval(r"""JSON.stringify((function() {
                var sel = Array.from(document.querySelectorAll('div, span, button')).find(function(e) {
                    return e.innerText && e.innerText.trim() === 'Select' && e.offsetParent !== null;
                });
                if (sel) { sel.click(); return 'ok'; }
                var cancel = Array.from(document.querySelectorAll('div, span, button')).find(function(e) {
                    return e.innerText && e.innerText.trim() === 'Cancel' && e.offsetParent !== null;
                });
                if (cancel) return 'already';
                return 'none';
            })())""")

            if not isinstance(r, dict):
                r = {"_raw": str(r)}
            sel = r.get("_raw", r.get("error", "none"))
            if sel == "none" or "error" in str(sel):
                errors += 1
                print(f"  No select ({errors})")
                if errors >= MAX_ERRORS:
                    print(f"  Max errors. Stopping at {total} batches.")
                    break
                cdp_navigate(COMMENTS_URL, wait=10)
                continue

            time.sleep(3)

            # --- Check items ---
            r = cdp_eval(r"""JSON.stringify({
                items: document.querySelectorAll('[role="button"][aria-label="Image with button"]').length
            })""")
            items = r.get("items", 0)
            if items == 0:
                errors += 1
                print(f"  No items ({errors})")
                if errors >= MAX_ERRORS:
                    print(f"  Max errors. Stopping at {total} batches.")
                    break
                cdp_navigate(COMMENTS_URL, wait=10)
                continue

            # --- Select 3 items ---
            r = cdp_eval(r"""(async function() {
                var items = document.querySelectorAll('[role="button"][aria-label="Image with button"]');
                var n = 0;
                for (var i = 0; i < items.length && n < 3; i++) {
                    var ic = items[i].querySelector('[aria-label="Toggle checkbox"] div[style*="mask-image"]');
                    if (!(ic && ic.style.cssText.includes('filled'))) {
                        items[i].click(); n++;
                        await new Promise(function(r){setTimeout(r,400);});
                    }
                }
                return JSON.stringify({selected: n});
            })()""")
            n = r.get("selected", 0)
            if n == 0:
                print(f"\nALL DONE! {total} batches. Total: ~{total * 3} comments deleted.")
                cdp_eval("localStorage.removeItem('ig_sanitize_batches')")
                return

            time.sleep(1)

            # --- Click Delete ---
            r = cdp_eval(r"""JSON.stringify((function() {
                var d = Array.from(document.querySelectorAll('[aria-label="Delete"]')).find(function(b) {
                    return getComputedStyle(b).pointerEvents === 'auto' && b.offsetParent !== null;
                });
                if (!d) return {e: 1};
                d.click();
                return {e: 0};
            })())""")
            if r.get("e") == 1:
                errors += 1
                print(f"  No delete ({errors})")
                if errors >= MAX_ERRORS:
                    break
                time.sleep(2)
                continue

            time.sleep(2)

            # --- Confirm ---
            r = cdp_eval(r"""JSON.stringify((function() {
                var dialogs = document.querySelectorAll('[role="dialog"]');
                for (var i = 0; i < dialogs.length; i++) {
                    var btns = dialogs[i].querySelectorAll('button');
                    for (var j = 0; j < btns.length; j++) {
                        if (btns[j].innerText && btns[j].innerText.trim().toLowerCase() === 'delete'
                            && btns[j].offsetParent !== null) {
                            btns[j].click();
                            return {e: 0};
                        }
                    }
                }
                return {e: 1};
            })())""")
            if r.get("e") == 1:
                errors += 1
                print(f"  No confirm ({errors})")
                if errors >= MAX_ERRORS:
                    break
                time.sleep(2)
                continue

            total += 1
            errors = 0
            print(f"  Batch {total} | ~{total * 3} comments deleted")
            if total % 10 == 0:
                cdp_eval("localStorage.setItem('ig_sanitize_batches','" + str(total) + "')")
            time.sleep(3)

    except KeyboardInterrupt:
        print(f"\nStopped. {total} batches, ~{total * 3} comments. Progress saved.")

    cdp_eval("localStorage.setItem('ig_sanitize_batches','" + str(total) + "')")
    elapsed = time.time() - start
    print(f"\nDone: {total} batches | ~{total * 3} comments | {elapsed:.0f}s")


if __name__ == "__main__":
    main()
