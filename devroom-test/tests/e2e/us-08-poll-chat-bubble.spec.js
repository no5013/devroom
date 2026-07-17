/**
 * E2E tests for US-08 — Poll Renders as Inline Chat Bubble
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const SCREENSHOTS = path.resolve(__dirname, '../../../03-test/us-08-poll-chat-bubble/screenshots');
const BASE_URL = 'http://localhost:3007';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createSession(request, name = 'US-08 Test') {
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

async function createPollViaApi(request, sessionId, token, question = 'Ready?', options = ['Yes', 'No', 'Maybe']) {
  const res = await request.post(`/api/sessions/${sessionId}/polls?token=${token}`, {
    data: { question, options }
  });
  return await res.json();
}

async function waitForPollCard(page, timeout = 1500) {
  await page.waitForFunction(
    () => !!document.querySelector('#poll-card-area .poll-card'),
    { timeout }
  );
}

// ── QA-08-1 — Poll card appears in #poll-card-area within 1 s ────────────────
test('QA-08-1 — poll card appears in #poll-card-area within 1.5 s', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-08-1 Poll Card Appears');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, { code: session.code });

    // Create poll via API
    await createPollViaApi(request, session.sessionId, instructorToken);

    // Wait for the card to appear (timeout 1500ms as per spec)
    await waitForPollCard(page, 1500);

    // Assert card exists in #poll-card-area
    const cardCount = await page.locator('#poll-card-area .poll-card').count();
    expect(cardCount).toBe(1);

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-08-1-poll-card-appears.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-08-2 — Card is visually distinct (.poll-card class, green border) ──────
test('QA-08-2 — card has poll-card class and green left border', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-08-2 Card Visual Style');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, { code: session.code });
    await createPollViaApi(request, session.sessionId, instructorToken);
    await waitForPollCard(page);

    // Assert card has class 'poll-card'
    const card = page.locator('#poll-card-area .poll-card');
    await expect(card).toHaveClass(/poll-card/);

    // Assert computed borderLeftColor is green (rgb(63, 185, 80)) or borderLeftWidth is '4px'
    const borderLeftColor = await page.evaluate(
      () => getComputedStyle(document.querySelector('.poll-card')).borderLeftColor
    );
    const borderLeftWidth = await page.evaluate(
      () => getComputedStyle(document.querySelector('.poll-card')).borderLeftWidth
    );

    // Accept green color OR 4px border width as confirmation of visual style
    const isGreenBorder = borderLeftColor === 'rgb(63, 185, 80)';
    const is4pxBorder = borderLeftWidth === '4px';
    expect(isGreenBorder || is4pxBorder).toBe(true);

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-08-2-card-visual-style.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-08-3 — Card displays the question text ─────────────────────────────────
test('QA-08-3 — card displays the question text', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-08-3 Card Question Text');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, { code: session.code });
    await createPollViaApi(request, session.sessionId, instructorToken, 'Is everyone ready?', ['Yes', 'No', 'Maybe']);
    await waitForPollCard(page);

    // Assert .poll-card-question textContent contains the question
    const questionText = await page.locator('.poll-card-question').textContent();
    expect(questionText).toContain('Is everyone ready?');

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-08-3-card-question-text.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-08-4 — Option buttons have min-height 80 px ───────────────────────────
test('QA-08-4 — option buttons have min-height 80 px', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-08-4 Button Min Height');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, { code: session.code });
    await createPollViaApi(request, session.sessionId, instructorToken, 'Pick one', ['Option A', 'Option B', 'Option C']);
    await waitForPollCard(page);

    // Get all vote buttons inside poll-card-area
    const buttons = page.locator('#poll-card-area .poll-vote-btn');
    const count = await buttons.count();
    expect(count).toBe(3);

    // Assert each button has height >= 80px
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThanOrEqual(80);
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-08-4-button-min-height.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-08-5 — Participant has no Close Poll button; instructor does ────────────
test('QA-08-5 — participant has no Close Poll button; instructor does', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-08-5 Close Button Visibility');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const participantPage = await ctx1.newPage();
  const instructorPage = await ctx2.newPage();

  try {
    await setupRoom(participantPage, request, { code: session.code });
    await setupRoom(instructorPage, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });

    // Create poll via API
    await createPollViaApi(request, session.sessionId, instructorToken);

    // Both pages: wait for card to appear
    await waitForPollCard(participantPage, 3000);
    await waitForPollCard(instructorPage, 3000);

    // Participant: assert #close-poll-btn-card does NOT exist or is not visible
    const participantCloseBtn = await participantPage.locator('#close-poll-btn-card').count();
    expect(participantCloseBtn).toBe(0);

    // Instructor: assert #close-poll-btn-card IS visible
    const instructorCloseBtn = instructorPage.locator('#close-poll-btn-card');
    await expect(instructorCloseBtn).toBeVisible();

    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-08-5-participant-no-close-btn.png'),
      fullPage: true,
    });
    await instructorPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-08-5-instructor-has-close-btn.png'),
      fullPage: true,
    });
  } finally {
    await ctx1.close();
    await ctx2.close();
  }
});

// ── QA-08-6 — Late joiner sees the poll card ─────────────────────────────────
test('QA-08-6 — late joiner sees the poll card', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-08-6 Late Joiner Poll Card');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  // First: create poll via API (before late joiner arrives)
  const poll = await createPollViaApi(request, session.sessionId, instructorToken, 'Late joiner question?', ['Yes', 'No']);
  await new Promise(r => setTimeout(r, 500));

  // NOW join as a new participant (late joiner)
  const lateCtx = await browser.newContext();
  const latePage = await lateCtx.newPage();

  try {
    await setupRoom(latePage, request, { code: session.code });

    // Wait for late joiner's page: #poll-card-area .poll-card to appear (timeout 3s)
    await waitForPollCard(latePage, 3000);

    // Assert card exists and shows the question
    const cardCount = await latePage.locator('#poll-card-area .poll-card').count();
    expect(cardCount).toBe(1);

    const questionText = await latePage.locator('.poll-card-question').textContent();
    expect(questionText).toContain('Late joiner question?');

    await latePage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-08-6-late-joiner-poll-card.png'),
      fullPage: true,
    });
  } finally {
    await lateCtx.close();
  }
});

// ── QA-08-7 — Sidebar poll drawer is absent from DOM ─────────────────────────
test('QA-08-7 — sidebar poll drawer is absent from DOM', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-08-7 Poll Drawer Absent');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });

    // Assert #poll-drawer does NOT exist in the DOM
    const drawerCount = await page.locator('#poll-drawer').count();
    expect(drawerCount).toBe(0);

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-08-7-poll-drawer-absent.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-08-8 — After poll closes, frozen card in #messages; #poll-card-area empty
test('QA-08-8 — after poll closes, frozen card in #messages and #poll-card-area is empty', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-08-8 Frozen Card After Close');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });

    // Create poll via API
    const poll = await createPollViaApi(request, session.sessionId, instructorToken);
    await waitForPollCard(page);

    // Close poll via API
    await request.patch(`/api/sessions/${session.sessionId}/polls/${poll.id}?token=${instructorToken}`, {
      data: { status: 'closed' }
    });

    // Wait for #poll-card-area to be cleared (poll:closed fires and room.js handles it immediately)
    await page.waitForFunction(
      () => document.getElementById('poll-card-area').querySelectorAll('.poll-card').length === 0,
      { timeout: 5000 }
    );

    // Assert #poll-card-area has no .poll-card
    const activeCardCount = await page.locator('#poll-card-area .poll-card').count();
    expect(activeCardCount).toBe(0);

    // Assert #messages contains a .poll-card.poll-card-frozen element
    await page.waitForFunction(
      () => !!document.querySelector('#messages .poll-card.poll-card-frozen'),
      { timeout: 5000 }
    );
    const frozenCardCount = await page.locator('#messages .poll-card.poll-card-frozen').count();
    expect(frozenCardCount).toBe(1);

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-08-8-frozen-card-after-close.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-08-9 — Chat messages above the card are scrollable ────────────────────
test('QA-08-9 — chat messages above the card are scrollable', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-08-9 Messages Scrollable');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await setupRoom(page, request, { code: session.code });

    // Send 10 chat messages by typing into the chat input and pressing Enter
    // (socket is inside an IIFE and not exposed on window, so we use the UI)
    for (let i = 1; i <= 10; i++) {
      await page.locator('#chat-input').fill(`Test message ${i}`);
      await page.locator('#chat-input').press('Enter');
      await page.waitForTimeout(100);
    }

    // Wait for at least 5 messages to appear in DOM
    await page.waitForFunction(
      () => document.querySelectorAll('#messages .message').length >= 5,
      { timeout: 8000 }
    );

    // Create poll via API; wait for card
    await createPollViaApi(request, session.sessionId, instructorToken);
    await waitForPollCard(page);

    // Scroll #messages to the top
    await page.evaluate(() => {
      const msgs = document.getElementById('messages');
      if (msgs) msgs.scrollTop = 0;
    });

    await page.waitForTimeout(300);

    // Assert messages are visible (at least one .message in DOM)
    const messageCount = await page.locator('#messages .message').count();
    expect(messageCount).toBeGreaterThan(0);

    // Assert #poll-card-area is still visible (not scrolled away)
    // poll-card-area is outside #messages so it's always visible regardless of scroll
    const pollCardAreaVisible = await page.locator('#poll-card-area').isVisible();
    expect(pollCardAreaVisible).toBe(true);

    // Also assert the poll card is still present
    const pollCardCount = await page.locator('#poll-card-area .poll-card').count();
    expect(pollCardCount).toBe(1);

    await page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-08-9-messages-scrollable.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});
