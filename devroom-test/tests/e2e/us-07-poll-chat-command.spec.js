/**
 * E2E tests for US-07 — Create Poll via `/poll` Chat Command
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const SCREENSHOTS = path.resolve(__dirname, '../../../03-test/us-07-poll-chat-command/screenshots');
const BASE_URL = 'http://localhost:3006';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createSession(request, name = 'Poll Chat Command Test') {
  const res = await request.post('/api/sessions', { data: { name } });
  const session = await res.json();
  return session;
}

async function setupRoom(page, request, { code, instructorToken, asInstructor = false } = {}) {
  const joinUrl = asInstructor
    ? `/api/sessions/${code}/join?role=instructor&token=${instructorToken}`
    : `/api/sessions/${code}/join`;
  const jRes = await request.post(joinUrl);
  const identity = await jRes.json();
  if (!identity.role) identity.role = asInstructor ? 'instructor' : 'participant';

  await page.addInitScript(({ id, sessionCode }) => {
    sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode }));
  }, { id: identity, sessionCode: code });

  await page.goto(`/room.html?code=${code}`);
  await page.waitForTimeout(800);

  return identity;
}

async function startPollViaApi(request, sessionId, token, question = 'Ready?', options = ['Yes', 'No']) {
  const res = await request.post(`/api/sessions/${sessionId}/polls?token=${token}`, {
    data: { question, options }
  });
  return await res.json();
}

// ── QA-07-1 — Valid command creates poll and clears input ─────────────────────
test('QA-07-1 — valid /poll command creates poll and clears input', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-07-1 Valid Poll Command');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });

    // Type the slash command into chat input
    await page.locator('#chat-input').fill('/poll Is everyone ready? | Yes | No | Maybe');
    // Submit via Enter key
    await page.locator('#chat-input').press('Enter');

    // Wait for #active-poll-overlay to become visible (poll:started fires)
    await page.waitForFunction(
      () => document.getElementById('active-poll-overlay')?.style.display !== 'none'
        && document.getElementById('active-poll-overlay')?.style.display !== '',
      { timeout: 5000 }
    );

    // Assert input is cleared
    const inputValue = await page.locator('#chat-input').inputValue();
    expect(inputValue).toBe('');

    // Assert poll overlay is visible
    const overlayDisplay = await page.evaluate(
      () => document.getElementById('active-poll-overlay')?.style.display
    );
    expect(overlayDisplay).toBe('block');

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-07-1-valid-poll-command.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-07-2 — Bare `/poll` shows usage hint ────────────────────────────────────
test('QA-07-2 — bare /poll shows usage hint', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-07-2 Bare Poll Command');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });

    await page.locator('#chat-input').fill('/poll');
    await page.locator('#chat-input').press('Enter');

    // Wait for a .chat-system-msg to appear
    await page.waitForSelector('.chat-system-msg', { timeout: 3000 });

    // Assert it contains 'Usage'
    const msgText = await page.locator('.chat-system-msg').first().textContent();
    expect(msgText).toContain('Usage');

    // Assert no poll overlay appeared
    const overlayDisplay = await page.evaluate(
      () => document.getElementById('active-poll-overlay')?.style.display || 'none'
    );
    expect(overlayDisplay).toBe('none');

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-07-2-bare-poll-hint.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-07-3 — Only 1 option shows error ───────────────────────────────────────
test('QA-07-3 — only 1 option shows error', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-07-3 Only 1 Option');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });

    await page.locator('#chat-input').fill('/poll Ready? | Yes');
    await page.locator('#chat-input').press('Enter');

    // Wait for error message
    await page.waitForSelector('.chat-error', { timeout: 3000 });

    const errText = await page.locator('.chat-error').first().textContent();
    // Should mention '2' or 'options'
    expect(errText.toLowerCase()).toMatch(/2|options/);

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-07-3-one-option-error.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-07-4 — Empty question shows error ──────────────────────────────────────
test('QA-07-4 — empty question shows error', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-07-4 Empty Question');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });

    await page.locator('#chat-input').fill('/poll | Yes | No');
    await page.locator('#chat-input').press('Enter');

    // Wait for error message
    await page.waitForSelector('.chat-error', { timeout: 3000 });

    const errText = await page.locator('.chat-error').first().textContent();
    // Should mention 'question' or 'empty'
    expect(errText.toLowerCase()).toMatch(/question|empty/);

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-07-4-empty-question-error.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-07-5 — Option > 30 chars shows error ────────────────────────────────────
test('QA-07-5 — option exceeding 30 chars shows error', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-07-5 Long Option');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });

    await page.locator('#chat-input').fill('/poll Ready? | Yes | This option is way too long and exceeds thirty characters');
    await page.locator('#chat-input').press('Enter');

    // Wait for error message
    await page.waitForSelector('.chat-error', { timeout: 3000 });

    const errText = await page.locator('.chat-error').first().textContent();
    // Should mention '30' or 'exceeds' or 'characters'
    expect(errText.toLowerCase()).toMatch(/30|exceeds|characters/);

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-07-5-long-option-error.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-07-6 — Already active poll shows error ─────────────────────────────────
test('QA-07-6 — already active poll shows error', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-07-6 Already Active Poll');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });

    // Create a poll via API so there's already an active one
    await startPollViaApi(request, session.sessionId, instructorToken, 'Active poll?', ['A', 'B']);

    // Wait for poll:started to fire and overlay to appear
    await page.waitForFunction(
      () => document.getElementById('active-poll-overlay')?.style.display === 'block',
      { timeout: 5000 }
    );

    // Now try to create another one via chat command
    await page.locator('#chat-input').fill('/poll Another question? | Yes | No');
    await page.locator('#chat-input').press('Enter');

    // Wait for error message
    await page.waitForSelector('.chat-error', { timeout: 5000 });

    const errText = await page.locator('.chat-error').first().textContent();
    // Should mention 'already active' or 'close'
    expect(errText.toLowerCase()).toMatch(/already active|close/);

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-07-6-already-active-error.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-07-7 — `/poll close` closes active poll ────────────────────────────────
test('QA-07-7 — /poll close closes active poll for participants', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-07-7 Poll Close Command');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const instructorPage = await ctx1.newPage();
  const participantPage = await ctx2.newPage();

  try {
    await setupRoom(instructorPage, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });
    await setupRoom(participantPage, request, { code: session.code });

    // Create active poll via API
    await startPollViaApi(request, session.sessionId, instructorToken, 'Close me?', ['Yes', 'No']);

    // Wait for participant to see poll overlay
    await participantPage.waitForFunction(
      () => document.getElementById('active-poll-overlay')?.style.display === 'block',
      { timeout: 5000 }
    );

    // Instructor uses /poll close command
    await instructorPage.locator('#chat-input').fill('/poll close');
    await instructorPage.locator('#chat-input').press('Enter');

    // Wait for participant's overlay to become hidden (poll:closed fires)
    // poll:closed hides the overlay after a 2s delay, so allow up to 6s
    await participantPage.waitForFunction(
      () => {
        const overlay = document.getElementById('active-poll-overlay');
        return !overlay || overlay.style.display === 'none' || overlay.style.display === '';
      },
      { timeout: 6000 }
    );

    // Assert participant overlay is hidden
    const participantOverlayDisplay = await participantPage.evaluate(
      () => document.getElementById('active-poll-overlay')?.style.display || 'none'
    );
    expect(participantOverlayDisplay).toBe('none');

    await instructorPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-07-7-poll-close-instructor.png'),
      fullPage: true,
    });
    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-07-7-poll-close-participant.png'),
      fullPage: true,
    });
  } finally {
    await ctx1.close();
    await ctx2.close();
  }
});

// ── QA-07-8 — `/poll close` with no active poll shows error ───────────────────
test('QA-07-8 — /poll close with no active poll shows error', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-07-8 No Active Poll Close');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });

    // No poll is active — type /poll close
    await page.locator('#chat-input').fill('/poll close');
    await page.locator('#chat-input').press('Enter');

    // Wait for error message
    await page.waitForSelector('.chat-error', { timeout: 3000 });

    const errText = await page.locator('.chat-error').first().textContent();
    // Should mention 'No active poll'
    expect(errText.toLowerCase()).toMatch(/no active poll/);

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-07-8-no-active-poll-error.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-07-9 — Participant using `/poll` is silently ignored ───────────────────
test('QA-07-9 — participant /poll command is silently ignored', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-07-9 Participant Poll Ignored');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    // Join as participant (non-instructor)
    await setupRoom(page, request, { code: session.code });

    await page.locator('#chat-input').fill('/poll Question? | Yes | No');
    await page.locator('#chat-input').press('Enter');

    // Wait 1.5s — no system message should appear
    await page.waitForTimeout(1500);

    // Assert no .chat-system-msg appeared
    const sysMsgCount = await page.locator('.chat-system-msg').count();
    expect(sysMsgCount).toBe(0);

    // Also verify no poll was created via API — use instructor join to get token
    const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');
    const pollsRes = await page.request.get(
      `/api/sessions/${session.sessionId}/polls?token=${instructorToken}`
    );
    const polls = await pollsRes.json();
    expect(Array.isArray(polls)).toBe(true);
    expect(polls.length).toBe(0);

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-07-9-participant-ignored.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});
