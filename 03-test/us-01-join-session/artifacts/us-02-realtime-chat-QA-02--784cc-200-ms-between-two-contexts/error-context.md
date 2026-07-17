# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: us-02-realtime-chat.spec.js >> QA-02-1 — message latency < 200 ms between two contexts
- Location: tests/e2e/us-02-realtime-chat.spec.js:56:1

# Error details

```
Error: expect(locator).toBeEnabled() failed

Locator:  locator('#send-btn')
Expected: enabled
Received: disabled
Timeout:  8000ms

Call log:
  - Expect "toBeEnabled" with timeout 8000ms
  - waiting for locator('#send-btn')
    20 × locator resolved to <button disabled id="send-btn" type="submit">Send</button>
       - unexpected value "disabled"

```

```yaml
- button "Send" [disabled]
```

# Test source

```ts
  1   | /**
  2   |  * E2E tests for US-02 — Real-Time Chat with Cool Effects
  3   |  */
  4   | const { test, expect } = require('@playwright/test');
  5   | const path = require('path');
  6   | 
  7   | const SCREENSHOTS = path.resolve(__dirname, '../../../03-test/us-02-realtime-chat/screenshots');
  8   | 
  9   | /**
  10  |  * Wait for #send-btn to become enabled (not disabled attribute).
  11  |  * Playwright's locator.waitFor only supports visibility states, so we poll.
  12  |  */
  13  | async function waitForSendEnabled(page, timeout = 8000) {
> 14  |   await expect(page.locator('#send-btn')).toBeEnabled({ timeout });
      |                                           ^ Error: expect(locator).toBeEnabled() failed
  15  | }
  16  | 
  17  | /**
  18  |  * Helper: create a session + join a participant, inject sessionStorage, navigate to room.
  19  |  * Returns { session, identity, code }
  20  |  */
  21  | async function setupRoom(page, request, opts = {}) {
  22  |   // 1. Create session
  23  |   const sRes = await request.post('/api/sessions', { data: { name: 'Test Session' } });
  24  |   const session = await sRes.json();
  25  |   const code = session.code;
  26  | 
  27  |   // 2. Join (instructor or participant)
  28  |   let joinUrl;
  29  |   let role = 'participant';
  30  |   if (opts.instructor) {
  31  |     const instructorToken = new URL(session.instructorUrl, 'http://localhost:3000').searchParams.get('token');
  32  |     joinUrl = `/api/sessions/${code}/join?role=instructor&token=${instructorToken}`;
  33  |     role = 'instructor';
  34  |   } else {
  35  |     joinUrl = `/api/sessions/${code}/join`;
  36  |   }
  37  | 
  38  |   const jRes = await request.post(joinUrl);
  39  |   const identity = await jRes.json();
  40  |   // Inject role if the server didn't return it (older server version)
  41  |   if (!identity.role) identity.role = role;
  42  | 
  43  |   // 3. Inject sessionStorage before page load
  44  |   await page.addInitScript(({ id, code: c }) => {
  45  |     sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: c }));
  46  |   }, { id: identity, code });
  47  | 
  48  |   // 4. Navigate and wait for socket to connect (send button enabled)
  49  |   await page.goto(`/room.html?code=${code}`);
  50  |   await waitForSendEnabled(page, 8000);
  51  | 
  52  |   return { session, identity, code };
  53  | }
  54  | 
  55  | // ── QA-02-1 — Message latency < 200 ms ──────────────────────────────────────
  56  | test('QA-02-1 — message latency < 200 ms between two contexts', async ({ browser, request }) => {
  57  |   // Create session and join two participants
  58  |   const sRes = await request.post('/api/sessions', { data: { name: 'Latency Test' } });
  59  |   const session = await sRes.json();
  60  |   const code = session.code;
  61  | 
  62  |   const j1Res = await request.post(`/api/sessions/${code}/join`);
  63  |   const identity1 = await j1Res.json();
  64  |   if (!identity1.role) identity1.role = 'participant';
  65  | 
  66  |   const j2Res = await request.post(`/api/sessions/${code}/join`);
  67  |   const identity2 = await j2Res.json();
  68  |   if (!identity2.role) identity2.role = 'participant';
  69  | 
  70  |   const ctx1 = await browser.newContext();
  71  |   const ctx2 = await browser.newContext();
  72  |   const page1 = await ctx1.newPage();
  73  |   const page2 = await ctx2.newPage();
  74  | 
  75  |   // Inject identities
  76  |   await page1.addInitScript(({ id, c }) => {
  77  |     sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: c }));
  78  |   }, { id: identity1, c: code });
  79  | 
  80  |   await page2.addInitScript(({ id, c }) => {
  81  |     sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: c }));
  82  |   }, { id: identity2, c: code });
  83  | 
  84  |   await page1.goto(`/room.html?code=${code}`);
  85  |   await page2.goto(`/room.html?code=${code}`);
  86  | 
  87  |   await waitForSendEnabled(page1, 8000);
  88  |   await waitForSendEnabled(page2, 8000);
  89  | 
  90  |   // Record T1 just before sending
  91  |   const t1 = await page1.evaluate(() => Date.now());
  92  | 
  93  |   // Send message from page1
  94  |   await page1.locator('#chat-input').fill('latency-test-message');
  95  |   await page1.locator('#send-btn').click();
  96  | 
  97  |   // Wait for message to appear in page2
  98  |   await page2.locator('#messages .message').first().waitFor({ state: 'visible', timeout: 5000 });
  99  | 
  100 |   // Record T2 after message appears
  101 |   const t2 = await page2.evaluate(() => Date.now());
  102 | 
  103 |   const latency = t2 - t1;
  104 |   console.log(`Message latency: ${latency}ms`);
  105 |   expect(latency).toBeLessThan(200);
  106 | 
  107 |   await ctx1.close();
  108 |   await ctx2.close();
  109 | });
  110 | 
  111 | // ── QA-02-2 — Code block rendered with syntax highlight ──────────────────────
  112 | test('QA-02-2 — code block rendered with syntax highlight', async ({ page, request }) => {
  113 |   await setupRoom(page, request);
  114 | 
```