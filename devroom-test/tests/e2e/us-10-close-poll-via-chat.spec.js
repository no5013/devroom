/**
 * E2E tests for US-10 — Close Poll via Chat Command or In-Card Button
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS = path.resolve(__dirname, '../../../03-test/us-10-close-poll-via-chat/screenshots');
const BASE_URL = 'http://localhost:3009';

// Ensure screenshots dir exists
fs.mkdirSync(SCREENSHOTS, { recursive: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createSession(request, name = 'US-10 Test') {
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

async function createPollViaApi(request, sessionId, token, question = 'Ready?', options = ['Yes', 'No']) {
  const res = await request.post(`/api/sessions/${sessionId}/polls?token=${token}`, {
    data: { question, options }
  });
  return await res.json();
}

async function closePollViaApi(request, sessionId, token, pollId) {
  return await request.patch(`/api/sessions/${sessionId}/polls/${pollId}?token=${token}`, {
    data: { status: 'closed' }
  });
}

async function waitForPollCard(page, timeout = 3000) {
  await page.waitForFunction(
    () => !!document.querySelector('#poll-card-area .poll-card'),
    { timeout }
  );
}

async function waitForPollCardArea(page, timeout = 3000) {
  await page.waitForFunction(
    () => document.getElementById('poll-card-area').querySelectorAll('.poll-card').length === 0,
    { timeout }
  );
}

// ── QA-10-1 — `/poll close` removes card from #poll-card-area ─────────────────
test('QA-10-1 — /poll close removes card from #poll-card-area', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-10-1 Poll Close Command');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, { code: session.code, instructorToken, asInstructor: true });

    // Create a poll so there's an active one
    await createPollViaApi(request, session.sessionId, instructorToken, 'Close me?', ['Yes', 'No']);
    await waitForPollCard(page);

    // Type /poll close in chat input
    await page.locator('#chat-input').fill('/poll close');
    await page.locator('#chat-input').press('Enter');

    // Wait for #poll-card-area to be empty
    await waitForPollCardArea(page, 3000);

    // Assert #poll-card-area has no .poll-card
    const cardCount = await page.locator('#poll-card-area .poll-card').count();
    expect(cardCount).toBe(0);

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-10-1-poll-close-command.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-10-2 — "Close Poll" button in card closes the poll ────────────────────
test('QA-10-2 — Close Poll button in card closes the poll', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-10-2 Close Poll Button');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, { code: session.code, instructorToken, asInstructor: true });

    // Create a poll
    await createPollViaApi(request, session.sessionId, instructorToken, 'Button close?', ['Yes', 'No']);
    await waitForPollCard(page);

    // Click #close-poll-btn-card
    await page.locator('#close-poll-btn-card').click();

    // Wait for #poll-card-area to be empty
    await waitForPollCardArea(page, 3000);

    // Assert #poll-card-area empty
    const cardCount = await page.locator('#poll-card-area .poll-card').count();
    expect(cardCount).toBe(0);

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-10-2-close-poll-button.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-10-3 — Frozen card shows "Poll closed" label ──────────────────────────
test('QA-10-3 — frozen card shows "Poll closed" label', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-10-3 Frozen Card Label');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    // Join as participant
    await setupRoom(page, request, { code: session.code });

    // Create poll via API
    const poll = await createPollViaApi(request, session.sessionId, instructorToken, 'Frozen label?', ['Yes', 'No']);
    await waitForPollCard(page);

    // Close poll via API PATCH
    await closePollViaApi(request, session.sessionId, instructorToken, poll.id);

    // Wait 2s for socket propagation
    await page.waitForTimeout(2000);

    // Assert #messages contains .poll-card-frozen
    const frozenCount = await page.locator('#messages .poll-card-frozen').count();
    expect(frozenCount).toBeGreaterThanOrEqual(1);

    // Assert .poll-closed-label inside it has textContent "Poll closed"
    const closedLabel = await page.locator('#messages .poll-card-frozen .poll-closed-label').first();
    await expect(closedLabel).toHaveText('Poll closed');

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-10-3-frozen-card-label.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-10-4 — Frozen card heading reads "Poll — Final Results" ───────────────
test('QA-10-4 — frozen card heading reads "Poll — Final Results"', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-10-4 Frozen Card Heading');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    // Join as participant
    await setupRoom(page, request, { code: session.code });

    // Create poll via API
    const poll = await createPollViaApi(request, session.sessionId, instructorToken, 'Final results?', ['Yes', 'No']);
    await waitForPollCard(page);

    // Close poll via API
    await closePollViaApi(request, session.sessionId, instructorToken, poll.id);

    // Wait 2s for socket propagation
    await page.waitForTimeout(2000);

    // Assert .poll-card-frozen .poll-badge textContent contains "Final Results"
    const badge = await page.locator('#messages .poll-card-frozen .poll-badge').first();
    const badgeText = await badge.textContent();
    expect(badgeText).toContain('Final Results');

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-10-4-frozen-card-heading.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-10-5 — Frozen card buttons are disabled ───────────────────────────────
test('QA-10-5 — frozen card buttons are disabled', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-10-5 Frozen Buttons Disabled');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    // Join as participant
    await setupRoom(page, request, { code: session.code });

    // Create poll via API
    const poll = await createPollViaApi(request, session.sessionId, instructorToken, 'Disabled buttons?', ['Yes', 'No', 'Maybe']);
    await waitForPollCard(page);

    // Close poll via API
    await closePollViaApi(request, session.sessionId, instructorToken, poll.id);

    // Wait 2s for socket propagation
    await page.waitForTimeout(2000);

    // Assert all .poll-vote-btn inside .poll-card-frozen are disabled
    const frozenCard = page.locator('#messages .poll-card-frozen').first();
    await expect(frozenCard).toBeVisible();

    const buttons = frozenCard.locator('.poll-vote-btn');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await expect(buttons.nth(i)).toBeDisabled();
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-10-5-frozen-buttons-disabled.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-10-6 — Final vote totals visible in frozen card ───────────────────────
test('QA-10-6 — final vote totals visible in frozen card', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-10-6 Final Vote Totals');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const instructorCtx = await browser.newContext();
  const participantCtx = await browser.newContext();
  const instructorPage = await instructorCtx.newPage();
  const participantPage = await participantCtx.newPage();

  try {
    await setupRoom(instructorPage, request, { code: session.code, instructorToken, asInstructor: true });
    await setupRoom(participantPage, request, { code: session.code });

    // Create poll
    const poll = await createPollViaApi(request, session.sessionId, instructorToken, 'Vote totals?', ['Yes', 'No']);

    await waitForPollCard(instructorPage);
    await waitForPollCard(participantPage);

    // Participant votes 3× Yes, 1× No
    await participantPage.evaluate(() => {
      const yesBtn = document.querySelectorAll('.poll-vote-btn')[0];
      const noBtn = document.querySelectorAll('.poll-vote-btn')[1];
      for (let i = 0; i < 3; i++) yesBtn.click();
      noBtn.click();
    });

    // Wait 500ms for vote socket roundtrips
    await participantPage.waitForTimeout(500);

    // Close poll via API
    await closePollViaApi(request, session.sessionId, instructorToken, poll.id);

    // Wait 2s for frozen card to appear
    await participantPage.waitForTimeout(2000);

    // Assert .poll-card-frozen contains "Total: 3" somewhere
    const frozenCard = participantPage.locator('#messages .poll-card-frozen').first();
    await expect(frozenCard).toBeVisible();

    const frozenText = await frozenCard.textContent();
    expect(frozenText).toContain('Total: 3');

    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-10-6-final-vote-totals.png'),
      fullPage: true,
    });
  } finally {
    await instructorCtx.close();
    await participantCtx.close();
  }
});

// ── QA-10-7 — `/poll close` with no active poll shows error ──────────────────
test('QA-10-7 — /poll close with no active poll shows error', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-10-7 No Active Poll Error');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, { code: session.code, instructorToken, asInstructor: true });

    // No poll created — type /poll close
    await page.locator('#chat-input').fill('/poll close');
    await page.locator('#chat-input').press('Enter');

    // Wait for .chat-error to appear
    await page.waitForSelector('.chat-error', { timeout: 3000 });

    // Assert textContent mentions "No active poll"
    const errText = await page.locator('.chat-error').first().textContent();
    expect(errText.toLowerCase()).toContain('no active poll');

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-10-7-no-active-poll-error.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-10-8 — Participant `/poll close` is silently ignored ──────────────────
test('QA-10-8 — participant /poll close is silently ignored', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-10-8 Participant Close Ignored');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    // Join as participant
    await setupRoom(page, request, { code: session.code });

    // Create poll via API (instructor token)
    const poll = await createPollViaApi(request, session.sessionId, instructorToken, 'Participant close?', ['Yes', 'No']);
    await waitForPollCard(page);

    // Participant types /poll close
    await page.locator('#chat-input').fill('/poll close');
    await page.locator('#chat-input').press('Enter');

    // Wait 1.5s
    await page.waitForTimeout(1500);

    // Assert poll card still in #poll-card-area (poll not closed)
    const cardCount = await page.locator('#poll-card-area .poll-card').count();
    expect(cardCount).toBe(1);

    // Assert no .chat-error (silently ignored)
    const errorCount = await page.locator('.chat-error').count();
    expect(errorCount).toBe(0);

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-10-8-participant-close-ignored.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-10-9 — After close, new `/poll` works immediately ─────────────────────
test('QA-10-9 — after close, new /poll works immediately', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-10-9 New Poll After Close');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, { code: session.code, instructorToken, asInstructor: true });

    // Create + close poll via API (no timing issues)
    const poll = await createPollViaApi(request, session.sessionId, instructorToken, 'Old poll?', ['Yes', 'No']);
    await waitForPollCard(page);
    await closePollViaApi(request, session.sessionId, instructorToken, poll.id);

    // Wait 2s for cleanup
    await page.waitForTimeout(2000);

    // Assert poll-card-area is empty before proceeding
    await waitForPollCardArea(page, 3000);

    // Type new /poll command
    await page.locator('#chat-input').fill('/poll New question? | Alpha | Beta');
    await page.locator('#chat-input').press('Enter');

    // Wait for #poll-card-area .poll-card to appear
    await waitForPollCard(page, 3000);

    // Assert card shows "New question?"
    const questionText = await page.locator('#poll-card-area .poll-card-question').textContent();
    expect(questionText).toContain('New question?');

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-10-9-new-poll-after-close.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});
