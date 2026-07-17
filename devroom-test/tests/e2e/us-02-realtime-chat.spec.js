/**
 * E2E tests for US-02 — Real-Time Chat with Cool Effects
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const SCREENSHOTS = path.resolve(__dirname, '../../../03-test/us-02-realtime-chat/screenshots');

/**
 * Wait for #send-btn to become enabled (not disabled attribute).
 * Playwright's locator.waitFor only supports visibility states, so we poll.
 */
async function waitForSendEnabled(page, timeout = 8000) {
  await expect(page.locator('#send-btn')).toBeEnabled({ timeout });
}

/**
 * Helper: create a session + join a participant, inject sessionStorage, navigate to room.
 * Returns { session, identity, code }
 */
async function setupRoom(page, request, opts = {}) {
  // 1. Create session
  const sRes = await request.post('/api/sessions', { data: { name: 'Test Session' } });
  const session = await sRes.json();
  const code = session.code;

  // 2. Join (instructor or participant)
  let joinUrl;
  let role = 'participant';
  if (opts.instructor) {
    const instructorToken = new URL(session.instructorUrl, 'http://localhost:3000').searchParams.get('token');
    joinUrl = `/api/sessions/${code}/join?role=instructor&token=${instructorToken}`;
    role = 'instructor';
  } else {
    joinUrl = `/api/sessions/${code}/join`;
  }

  const jRes = await request.post(joinUrl);
  const identity = await jRes.json();
  // Inject role if the server didn't return it (older server version)
  if (!identity.role) identity.role = role;

  // 3. Inject sessionStorage before page load
  await page.addInitScript(({ id, code: c }) => {
    sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: c }));
  }, { id: identity, code });

  // 4. Navigate and wait for socket to connect (send button enabled)
  await page.goto(`/room.html?code=${code}`);
  await waitForSendEnabled(page, 8000);

  return { session, identity, code };
}

// ── QA-02-1 — Message latency < 200 ms ──────────────────────────────────────
test('QA-02-1 — message latency < 200 ms between two contexts', async ({ browser, request }) => {
  // Create session and join two participants
  const sRes = await request.post('/api/sessions', { data: { name: 'Latency Test' } });
  const session = await sRes.json();
  const code = session.code;

  const j1Res = await request.post(`/api/sessions/${code}/join`);
  const identity1 = await j1Res.json();
  if (!identity1.role) identity1.role = 'participant';

  const j2Res = await request.post(`/api/sessions/${code}/join`);
  const identity2 = await j2Res.json();
  if (!identity2.role) identity2.role = 'participant';

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  // Inject identities
  await page1.addInitScript(({ id, c }) => {
    sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: c }));
  }, { id: identity1, c: code });

  await page2.addInitScript(({ id, c }) => {
    sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: c }));
  }, { id: identity2, c: code });

  await page1.goto(`/room.html?code=${code}`);
  await page2.goto(`/room.html?code=${code}`);

  await waitForSendEnabled(page1, 8000);
  await waitForSendEnabled(page2, 8000);

  // Record T1 just before sending
  const t1 = await page1.evaluate(() => Date.now());

  // Send message from page1
  await page1.locator('#chat-input').fill('latency-test-message');
  await page1.locator('#send-btn').click();

  // Wait for message to appear in page2
  await page2.locator('#messages .message').first().waitFor({ state: 'visible', timeout: 5000 });

  // Record T2 after message appears
  const t2 = await page2.evaluate(() => Date.now());

  const latency = t2 - t1;
  console.log(`Message latency: ${latency}ms`);
  expect(latency).toBeLessThan(200);

  await ctx1.close();
  await ctx2.close();
});

// ── QA-02-2 — Code block rendered with syntax highlight ──────────────────────
test('QA-02-2 — code block rendered with syntax highlight', async ({ page, request }) => {
  await setupRoom(page, request);

  // Send a message with a code fence
  const codeMsg = "```js\nconsole.log('hi')\n```";
  await page.locator('#chat-input').fill(codeMsg);
  await page.locator('#send-btn').click();

  // Wait for a message to appear
  await page.locator('#messages .message').first().waitFor({ state: 'visible', timeout: 5000 });

  // Assert <pre><code> element exists (not raw backticks)
  const preCode = page.locator('#messages .message pre code');
  await expect(preCode).toHaveCount(1, { timeout: 5000 });

  // Assert the code element has a class starting with "language-" or an hljs class
  const codeClass = await preCode.getAttribute('class');
  const hasLanguageClass = /language-/.test(codeClass || '') || /hljs/.test(codeClass || '');
  expect(hasLanguageClass).toBe(true);

  // Screenshot
  await page.screenshot({
    path: path.join(SCREENSHOTS, 'qa-02-2-code-block.png'),
    fullPage: true,
  });
});

// ── QA-02-3 — Auto-scroll "↓ New messages" button ───────────────────────────
test('QA-02-3 — auto-scroll button appears when scrolled up', async ({ browser, request }) => {
  const sRes = await request.post('/api/sessions', { data: { name: 'Scroll Test' } });
  const session = await sRes.json();
  const code = session.code;

  const j1Res = await request.post(`/api/sessions/${code}/join`);
  const identity1 = await j1Res.json();
  if (!identity1.role) identity1.role = 'participant';

  const j2Res = await request.post(`/api/sessions/${code}/join`);
  const identity2 = await j2Res.json();
  if (!identity2.role) identity2.role = 'participant';

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  await page1.addInitScript(({ id, c }) => {
    sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: c }));
  }, { id: identity1, c: code });

  await page2.addInitScript(({ id, c }) => {
    sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: c }));
  }, { id: identity2, c: code });

  await page1.goto(`/room.html?code=${code}`);
  await page2.goto(`/room.html?code=${code}`);

  await waitForSendEnabled(page1, 8000);
  await waitForSendEnabled(page2, 8000);

  // Send 20 messages quickly to overflow
  for (let i = 0; i < 20; i++) {
    await page1.locator('#chat-input').fill(`Message ${i + 1} — padding the chat to overflow the container`);
    await page1.locator('#send-btn').click();
    await page1.waitForTimeout(50);
  }

  // Wait for all 20 messages in page1
  await page1.waitForFunction(() => {
    return document.querySelectorAll('#messages .message').length >= 20;
  }, { timeout: 10000 });

  // Scroll page1 to top
  await page1.evaluate(() => {
    document.getElementById('messages').scrollTop = 0;
  });

  // Send one more message from page2
  await page2.locator('#chat-input').fill('New message after scroll up');
  await page2.locator('#send-btn').click();

  // Wait for scroll button to become visible in page1
  await page1.waitForFunction(() => {
    const btn = document.getElementById('scroll-bottom-btn');
    return btn && !btn.hidden;
  }, { timeout: 8000 });

  // Click the button
  await page1.locator('#scroll-bottom-btn').click();

  // Assert near bottom
  const nearBottom = await page1.evaluate(() => {
    const el = document.getElementById('messages');
    return (el.scrollHeight - el.scrollTop - el.clientHeight) < 80;
  });
  expect(nearBottom).toBe(true);

  await page1.screenshot({
    path: path.join(SCREENSHOTS, 'qa-02-3-scroll-bottom.png'),
    fullPage: true,
  });

  await ctx1.close();
  await ctx2.close();
});

// ── QA-02-4 — Shift+Enter inserts newline, does NOT send ─────────────────────
test('QA-02-4 — Shift+Enter inserts newline without sending', async ({ page, request }) => {
  await setupRoom(page, request);

  const input = page.locator('#chat-input');
  await input.click();

  // Press Shift+Enter
  await page.keyboard.press('Shift+Enter');

  // Assert no message appeared
  await expect(page.locator('#messages .message')).toHaveCount(0);

  // Assert input contains a newline
  const value = await input.inputValue();
  expect(value).toContain('\n');

  await page.screenshot({
    path: path.join(SCREENSHOTS, 'qa-02-4-shift-enter.png'),
    fullPage: true,
  });
});

// ── QA-02-5 — Confetti fires when message contains 🎉 ────────────────────────
test('QA-02-5 — confetti fires when message contains 🎉', async ({ page, request }) => {
  // Inject confetti spy BEFORE page load
  await page.addInitScript(() => {
    Object.defineProperty(window, '_confettiCallCount', { value: 0, writable: true });
  });

  await setupRoom(page, request);

  // After page load, monkey-patch confetti (CDN script already loaded)
  await page.waitForFunction(() => typeof window.confetti === 'function', { timeout: 5000 });
  await page.evaluate(() => {
    const orig = window.confetti;
    window.confetti = function (...args) {
      window._confettiCallCount++;
      return orig ? orig(...args) : undefined;
    };
  });

  // Type and submit 🎉 message
  await page.locator('#chat-input').fill('🎉 hello!');
  await page.locator('#send-btn').click();

  // Wait for message to appear
  await page.locator('#messages .message').first().waitFor({ state: 'visible', timeout: 5000 });

  // Assert confetti was called
  const callCount = await page.evaluate(() => window._confettiCallCount);
  expect(callCount).toBeGreaterThan(0);

  await page.screenshot({
    path: path.join(SCREENSHOTS, 'qa-02-5-confetti.png'),
    fullPage: true,
  });
});

// ── QA-02-6 — Instructor messages have badge and highlight ───────────────────
test('QA-02-6 — instructor messages have badge and highlight', async ({ browser, request }) => {
  // Create session
  const sRes = await request.post('/api/sessions', { data: { name: 'Instructor Test' } });
  const session = await sRes.json();
  const code = session.code;

  // Extract instructor token from instructorUrl
  const instructorToken = new URL(session.instructorUrl, 'http://localhost:3000').searchParams.get('token');

  // Join as participant
  const j1Res = await request.post(`/api/sessions/${code}/join`);
  const identity1 = await j1Res.json();
  if (!identity1.role) identity1.role = 'participant';

  // Join as instructor (with token in query params)
  const j2Res = await request.post(`/api/sessions/${code}/join?role=instructor&token=${instructorToken}`);
  const identity2 = await j2Res.json();
  // Force role to instructor since old server may not return it in HTTP response
  // but the socket server uses the stored role from the session
  identity2.role = 'instructor';

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const participantPage = await ctx1.newPage();
  const instructorPage = await ctx2.newPage();

  // Set up participant page
  await participantPage.addInitScript(({ id, c }) => {
    sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: c }));
  }, { id: identity1, c: code });
  await participantPage.goto(`/room.html?code=${code}`);
  await waitForSendEnabled(participantPage, 8000);

  // Set up instructor page
  await instructorPage.addInitScript(({ id, c }) => {
    sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: c }));
  }, { id: identity2, c: code });
  await instructorPage.goto(`/room.html?code=${code}`);
  await waitForSendEnabled(instructorPage, 8000);

  // Instructor sends a message
  await instructorPage.locator('#chat-input').fill('Hello from instructor');
  await instructorPage.locator('#send-btn').click();

  // In participant page: wait for .message.instructor element
  await participantPage.locator('#messages .message.instructor').first().waitFor({ state: 'visible', timeout: 8000 });

  // Assert .instructor-badge exists with text "Instructor"
  const badge = participantPage.locator('#messages .message.instructor .instructor-badge').first();
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText('Instructor');

  // Screenshot participant view
  await participantPage.screenshot({
    path: path.join(SCREENSHOTS, 'qa-02-6-instructor-participant-view.png'),
    fullPage: true,
  });

  // Participant sends a message
  await participantPage.locator('#chat-input').fill('Hello from participant');
  await participantPage.locator('#send-btn').click();

  // Wait for participant message to appear (not instructor class)
  await participantPage.waitForFunction(() => {
    const msgs = document.querySelectorAll('#messages .message');
    return Array.from(msgs).some(m => !m.classList.contains('instructor'));
  }, { timeout: 5000 });

  // Verify participant message has class "message" but not "instructor"
  const participantMsg = participantPage.locator('#messages .message:not(.instructor)').first();
  await expect(participantMsg).toBeVisible();
  const classList = await participantMsg.getAttribute('class');
  expect(classList).toContain('message');
  expect(classList).not.toContain('instructor');

  // Screenshot instructor view
  await instructorPage.screenshot({
    path: path.join(SCREENSHOTS, 'qa-02-6-instructor-instructor-view.png'),
    fullPage: true,
  });

  await ctx1.close();
  await ctx2.close();
});

// ── QA-02-7 — Participant list updates on join/leave ─────────────────────────
test('QA-02-7 — participant list updates on join and leave', async ({ browser, request }) => {
  // Create session
  const sRes = await request.post('/api/sessions', { data: { name: 'Presence Test' } });
  const session = await sRes.json();
  const code = session.code;

  // Join three participants
  const [j1Res, j2Res, j3Res] = await Promise.all([
    request.post(`/api/sessions/${code}/join`),
    request.post(`/api/sessions/${code}/join`),
    request.post(`/api/sessions/${code}/join`),
  ]);
  const identity1 = await j1Res.json();
  const identity2 = await j2Res.json();
  const identity3 = await j3Res.json();
  if (!identity1.role) identity1.role = 'participant';
  if (!identity2.role) identity2.role = 'participant';
  if (!identity3.role) identity3.role = 'participant';

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const ctx3 = await browser.newContext();

  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();
  const page3 = await ctx3.newPage();

  // Set up all three pages
  await page1.addInitScript(({ id, c }) => {
    sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: c }));
  }, { id: identity1, c: code });

  await page2.addInitScript(({ id, c }) => {
    sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: c }));
  }, { id: identity2, c: code });

  await page3.addInitScript(({ id, c }) => {
    sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: c }));
  }, { id: identity3, c: code });

  // Navigate all three
  await page1.goto(`/room.html?code=${code}`);
  await page2.goto(`/room.html?code=${code}`);
  await page3.goto(`/room.html?code=${code}`);

  // Wait for all to be connected
  await waitForSendEnabled(page1, 8000);
  await waitForSendEnabled(page2, 8000);
  await waitForSendEnabled(page3, 8000);

  // In page1: wait for 3 participants
  await page1.waitForFunction(() => {
    return document.querySelectorAll('#participants-list .participant-item').length >= 3;
  }, { timeout: 8000 });

  const count3 = await page1.locator('#participants-list .participant-item').count();
  expect(count3).toBe(3);

  // Close context3 (participant3 leaves)
  await ctx3.close();

  // In page1: wait for participant list to drop to 2
  await page1.waitForFunction(() => {
    return document.querySelectorAll('#participants-list .participant-item').length <= 2;
  }, { timeout: 8000 });

  const count2 = await page1.locator('#participants-list .participant-item').count();
  expect(count2).toBe(2);

  await page1.screenshot({
    path: path.join(SCREENSHOTS, 'qa-02-7-participants-after-leave.png'),
    fullPage: true,
  });

  await ctx1.close();
  await ctx2.close();
});
