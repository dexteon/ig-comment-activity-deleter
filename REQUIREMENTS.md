## Dependencies

The main script (`instagram-comment-activity-deleter.js`) has zero dependencies. It's a single JavaScript file meant to be pasted into a browser console. No npm install, no build step, no framework.

## Node version

Not applicable. The script runs in the browser, not Node.js.

## Headless / CDP requirements

If you're using the headless approach described in [`headless.md`](headless.md), you need:

- Python 3.8+
- `websockets` Python package (`pip install websockets`)
- Chrome/Chromium 90+ with `--remote-debugging-port` enabled

## Browser compatibility

Tested on Chrome 151. Should work on any modern Chromium-based browser (Edge, Brave, Vivaldi). Firefox and Safari may work but are untested — the DOM selectors may differ.

## Instagram session

You need an active Instagram session (logged in). The script doesn't handle authentication — it assumes you're already on the comments activity page with your comments loaded.
