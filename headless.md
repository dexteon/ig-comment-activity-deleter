# Running headless (no browser window needed)

The console script requires a live browser tab. If you want to run it on a server or just don't want to keep a browser window open, you can use Chrome Remote Debugging and the Chrome DevTools Protocol (CDP) to inject the script programmatically.

## Quick start

### 1. Launch Chrome with remote debugging

Close all Chrome windows first, then:

```bash
# macOS/Linux
google-chrome --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.config/google-chrome" \
  "https://www.instagram.com/your_activity/interactions/comments/"

# Windows (PowerShell)
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  -ArgumentList '--remote-debugging-port=9222',
    '--user-data-dir=C:\Users\<you>\AppData\Local\Google\Chrome\User Data',
    'https://www.instagram.com/your_activity/interactions/comments/'
```

Chrome opens with a debugging endpoint on port 9222. Log into Instagram if needed.

### 2. Inject the script

Use any CDP client. Here's a minimal Python example using `websockets`:

```python
import asyncio, json, urllib.request

async def inject():
    import websockets

    # Find the Instagram tab
    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
    ig = [t for t in tabs if "instagram" in t.get("url", "").lower() and t["type"] == "page"][0]

    async with websockets.connect(ig["webSocketDebuggerUrl"]) as ws:
        # Read the script from file
        with open("instagram-comment-activity-deleter.js") as f:
            script = f.read()

        await ws.send(json.dumps({
            "id": 1,
            "method": "Runtime.evaluate",
            "params": {"expression": script, "returnByValue": True}
        }))

        resp = json.loads(await ws.recv())
        print("Injected:", resp.get("result", {}))

asyncio.run(inject())
```

### 3. Monitor progress

```python
async def check():
    import websockets

    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
    ig = [t for t in tabs if "instagram" in t.get("url", "").lower() and t["type"] == "page"][0]

    async with websockets.connect(ig["webSocketDebuggerUrl"]) as ws:
        await ws.send(json.dumps({
            "id": 1,
            "method": "Runtime.evaluate",
            "params": {
                "expression": "JSON.stringify({done: window.__igDone, batches: window.__igBatches})",
                "returnByValue": True
            }
        }))
        resp = json.loads(await ws.recv())
        print(resp["result"]["result"]["value"])

asyncio.run(check())
```

Note: the console-paste version of the script uses `console.log` for progress. If you want to poll status via CDP like the example above, add `window.__igDone` and `window.__igBatches` globals to the script (the headless version we used internally does this — see the repo's commit history for reference).

### 4. Optional: Docker

You can run Chrome headless in a container:

```dockerfile
FROM browser/chromium:latest

EXPOSE 9222
CMD ["chromium", "--headless", "--no-sandbox", \
     "--remote-debugging-port=9222", "--remote-debugging-address=0.0.0.0"]
```

Then connect from the host and inject the script. You'll need to handle Instagram authentication (session cookies) separately since there's no GUI for login.

### Tips

- Chrome must be fully closed before relaunching with `--remote-debugging-port`. If an existing Chrome process is running, the new instance just opens a tab in the old one (without debugging).
- The `--user-data-dir` flag must point to your actual Chrome profile if you want to reuse your Instagram session. Otherwise you'll need to log in again.
- On Windows, `netstat -an | grep 9222` confirms the port is listening.
