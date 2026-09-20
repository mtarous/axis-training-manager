# Training screen regression

Run a local HTTP server in the repository and execute:

```sh
python3 -m http.server 8777
# In another terminal, with Playwright installed:
node tests/training-screen.cjs
```

Optional environment variables: `AXIS_TEST_URL`, `AXIS_CHROME_PATH`,
`AXIS_TEST_FONT_CSS` (local Noto Sans JP CSS for Linux screenshots).

The test uses a fresh browser context with synthetic records, does not decrypt
production data, and blocks Service Workers. It checks input, set completion and
undo, rest ring updates across exercise navigation, draft reload, history,
375/390/430/900px overflow, saving and session-clock reset. Screenshot:
`/tmp/axis-training-mobile.png`.

Production authentication, iPhone Safari, and installed PWA/offline updates have
not been verified by this test. The change is intended for review on a branch
before production deployment.
