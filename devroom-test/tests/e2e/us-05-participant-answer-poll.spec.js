/**
 * E2E tests for US-05 — Participant Spams the Answer Button
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const SCREENSHOTS = path.resolve(__dirname, '../../../03-test/us-05-participant-answer-poll/screenshots');
const BASE_URL = 'http://localhost:3004';

/**
 * Helper: create a session via API.
 */
async function createSession(request, name = 'Answer Poll Test Session') {
  const res = await request.post('/api/sessions', { data: { name } });
  const session = await res.json();
  return session;
}

/**
 * Helper: set up a room page (participant or instructor).
 */
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
  await page.waitForTimeout(800); // let socket connect and session:info fire

  return identity;
}

/**
 * Helper: activate a poll via API.
 * Returns the created poll object.
 */
async function startPoll(request, sessionId, token, question = 'Ready?', options = ['Yes', 'No', 'Maybe']) {
  const res = await request.post(`/api/sessions/${sessionId}/polls?token=${token}`, {
    data: { question, options }
  });
  return await res.json();
}

/**
 * Helper: wait for participant overlay to appear.
 */
async function waitForOverlay(page, timeout = 3000) {
  await page.waitForFunction(() => {
    const overlay = document.getElementById('active-poll-overlay');
    return overlay && overlay.style.display === 'block';
  }, { timeout });
}

// ── QA-05-1 — 100 clicks register as exactly 100 on server ──────────────────
test('QA-05-1 — 100 clicks register as exactly 100 on server', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-05-1 Spam Test');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const instructorPage = await ctx1.newPage();
  const participantPage = await ctx2.newPage();

  try {
    // Set up instructor (needed to close poll later if needed)
    await setupRoom(instructorPage, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });

    // Set up participant
    await setupRoom(participantPage, request, { code: session.code });

    // Start a poll via API
    await startPoll(request, session.sessionId, instructorToken, 'Spam test?', ['Yes', 'No', 'Maybe']);

    // Wait for overlay on participant page
    await waitForOverlay(participantPage);

    // Click the first .poll-vote-btn exactly 100 times using page.evaluate for speed
    // (100 sequential Playwright .click() calls are too slow and hit 30s timeout)
    await participantPage.evaluate(() => {
      const btn = document.querySelectorAll('.poll-vote-btn')[0];
      for (let i = 0; i < 100; i++) {
        btn.click();
      }
    });

    // Wait 1s for all socket roundtrips to complete
    await participantPage.waitForTimeout(1000);

    // Fetch GET /api/sessions/:sessionId/polls?token=X
    const pollsRes = await request.get(`/api/sessions/${session.sessionId}/polls?token=${instructorToken}`);
    const polls = await pollsRes.json();

    // Find the active poll and sum all results values
    const activePoll = polls.find(p => p.status === 'active');
    expect(activePoll).toBeTruthy();

    const total = Object.values(activePoll.results).reduce((sum, v) => sum + v, 0);
    expect(total).toBe(100);

    // Screenshot showing "You: 100"
    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-05-1-100-clicks.png'),
      fullPage: true,
    });
  } finally {
    await ctx1.close();
    await ctx2.close();
  }
});

// ── QA-05-2 — Bounce animation fires on each click ──────────────────────────
test('QA-05-2 — bounce animation fires on each click', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-05-2 Bounce Test');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx1 = await browser.newContext();
  const participantPage = await ctx1.newPage();

  try {
    await setupRoom(participantPage, request, { code: session.code });

    // Start a poll via API
    await startPoll(request, session.sessionId, instructorToken, 'Bounce?', ['Yes', 'No']);

    // Wait for overlay on participant page
    await waitForOverlay(participantPage);

    // Inject animationstart counter BEFORE first click, after overlay appears
    await participantPage.evaluate(() => {
      window._bounceCount = 0;
      const btn = document.querySelectorAll('.poll-vote-btn')[0];
      btn.addEventListener('animationstart', () => {
        window._bounceCount = (window._bounceCount || 0) + 1;
      });
    });

    // Click the button 5 times with a gap to let animationend fire and class be removed
    const btn = participantPage.locator('.poll-vote-btn').first();
    for (let i = 0; i < 5; i++) {
      await btn.click();
      await participantPage.waitForTimeout(50); // let animationend fire and class be removed
    }

    // Wait a bit extra for all animations to settle
    await participantPage.waitForTimeout(300);

    // Assert window._bounceCount >= 5
    const bounceCount = await participantPage.evaluate(() => window._bounceCount);
    expect(bounceCount).toBeGreaterThanOrEqual(5);

    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-05-2-bounce-animation.png'),
      fullPage: true,
    });
  } finally {
    await ctx1.close();
  }
});

// ── QA-05-3 — Personal counter updates correctly ─────────────────────────────
test('QA-05-3 — personal counter updates correctly', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-05-3 Personal Counter Test');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx1 = await browser.newContext();
  const participantPage = await ctx1.newPage();

  try {
    await setupRoom(participantPage, request, { code: session.code });

    // Start a poll via API with Alpha and Beta options
    await startPoll(request, session.sessionId, instructorToken, 'Pick one?', ['Alpha', 'Beta']);

    // Wait for overlay on participant page
    await waitForOverlay(participantPage);

    const firstBtn = participantPage.locator('.poll-vote-btn').nth(0);
    const secondBtn = participantPage.locator('.poll-vote-btn').nth(1);

    // Click "Alpha" button 10 times (fast loop, no delay)
    for (let i = 0; i < 10; i++) {
      await firstBtn.click();
    }

    // Assert first .poll-vote-btn [data-role="personal"] textContent === "You: 10"
    const firstPersonal = firstBtn.locator('[data-role="personal"]');
    await expect(firstPersonal).toHaveText('You: 10');

    // Click "Beta" button 5 times
    for (let i = 0; i < 5; i++) {
      await secondBtn.click();
    }

    // Assert second .poll-vote-btn [data-role="personal"] textContent === "You: 5"
    const secondPersonal = secondBtn.locator('[data-role="personal"]');
    await expect(secondPersonal).toHaveText('You: 5');

    // Assert first is still "You: 10"
    await expect(firstPersonal).toHaveText('You: 10');

    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-05-3-personal-counter.png'),
      fullPage: true,
    });
  } finally {
    await ctx1.close();
  }
});

// ── QA-05-4 — Option switch: aggregate totals split correctly on observer ────
test('QA-05-4 — aggregate totals split correctly between participants', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-05-4 Aggregate Test');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const participant1Page = await ctx1.newPage();
  const participant2Page = await ctx2.newPage();

  try {
    // Set up participant 1
    await setupRoom(participant1Page, request, { code: session.code });
    // Set up participant 2
    await setupRoom(participant2Page, request, { code: session.code });

    // Start a poll via API
    await startPoll(request, session.sessionId, instructorToken, 'Yes or No?', ['Yes', 'No', 'Maybe']);

    // Wait for overlay on both participant pages
    await waitForOverlay(participant1Page);
    await waitForOverlay(participant2Page);

    // participant1 clicks "Yes" (first button) 7 times
    const p1FirstBtn = participant1Page.locator('.poll-vote-btn').nth(0);
    for (let i = 0; i < 7; i++) {
      await p1FirstBtn.click();
    }

    // participant2 clicks "No" (second button) 3 times
    const p2SecondBtn = participant2Page.locator('.poll-vote-btn').nth(1);
    for (let i = 0; i < 3; i++) {
      await p2SecondBtn.click();
    }

    // Wait 500ms for poll:results to propagate
    await participant1Page.waitForTimeout(500);

    // On participant1 page: read "Yes" [data-role="total"] and "No" [data-role="total"]
    const yesTotalText = await participant1Page.locator('.poll-vote-btn').nth(0).locator('[data-role="total"]').textContent();
    const noTotalText = await participant1Page.locator('.poll-vote-btn').nth(1).locator('[data-role="total"]').textContent();

    // Parse the numbers from "Total: N"
    const yesTotal = parseInt(yesTotalText.replace('Total: ', ''), 10);
    const noTotal = parseInt(noTotalText.replace('Total: ', ''), 10);

    // Assert Yes total >= 7 and No total >= 3
    expect(yesTotal).toBeGreaterThanOrEqual(7);
    expect(noTotal).toBeGreaterThanOrEqual(3);

    await participant1Page.screenshot({
      path: path.join(SCREENSHOTS, 'qa-05-4-aggregate-totals.png'),
      fullPage: true,
    });
  } finally {
    await ctx1.close();
    await ctx2.close();
  }
});

// ── QA-05-5 — Poll closed state: buttons disabled, label shown ───────────────
test('QA-05-5 — poll closed state: buttons disabled, label shown', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-05-5 Close State Test');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const instructorPage = await ctx1.newPage();
  const participantPage = await ctx2.newPage();

  try {
    // Set up instructor
    await setupRoom(instructorPage, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });

    // Set up participant
    await setupRoom(participantPage, request, { code: session.code });

    // Start a poll via API
    const poll = await startPoll(request, session.sessionId, instructorToken, 'Close me?', ['Yes', 'No']);

    // Wait for overlay on participant page
    await waitForOverlay(participantPage);

    // Click "Yes" a few times to confirm buttons are enabled
    const firstBtn = participantPage.locator('.poll-vote-btn').first();
    await firstBtn.click();
    await firstBtn.click();

    // Wait for instructor #close-poll-btn to become visible (socket event fired)
    await instructorPage.waitForFunction(() => {
      const btn = document.getElementById('close-poll-btn');
      return btn && btn.style.display !== 'none' && btn.style.display !== '';
    }, { timeout: 5000 });

    // Instructor clicks #close-poll-btn
    await instructorPage.locator('#close-poll-btn').click();

    // On participant page: wait up to 3s for first .poll-vote-btn to become disabled
    await participantPage.waitForFunction(
      () => document.querySelector('.poll-vote-btn')?.disabled,
      { timeout: 3000 }
    );

    // Assert all .poll-vote-btn are disabled
    const allBtns = participantPage.locator('.poll-vote-btn');
    const btnCount = await allBtns.count();
    for (let i = 0; i < btnCount; i++) {
      await expect(allBtns.nth(i)).toBeDisabled();
    }

    // Assert #poll-closed-label is visible (display !== 'none')
    const closedLabelDisplay = await participantPage.locator('#poll-closed-label').evaluate(
      el => el.style.display
    );
    expect(closedLabelDisplay).not.toBe('none');

    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-05-5-poll-closed-state.png'),
      fullPage: true,
    });
  } finally {
    await ctx1.close();
    await ctx2.close();
  }
});

// ── QA-05-6 — No poll:vote emitted after close ───────────────────────────────
test('QA-05-6 — no poll:vote emitted after poll closes', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-05-6 No Vote After Close');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const instructorPage = await ctx1.newPage();
  const participantPage = await ctx2.newPage();

  try {
    // Set up instructor
    await setupRoom(instructorPage, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });

    // Set up participant
    await setupRoom(participantPage, request, { code: session.code });

    // Start a poll via API
    await startPoll(request, session.sessionId, instructorToken, 'Vote then close?', ['Yes', 'No']);

    // Wait for overlay on participant page
    await waitForOverlay(participantPage);

    // Intercept outgoing WebSocket frames to capture poll:vote events BEFORE closing
    const votes = [];
    participantPage.on('websocket', ws => ws.on('framesent', f => {
      if (f.payload && f.payload.includes && f.payload.includes('poll:vote')) votes.push(f.payload);
    }));

    // Wait for instructor #close-poll-btn to become visible
    await instructorPage.waitForFunction(() => {
      const btn = document.getElementById('close-poll-btn');
      return btn && btn.style.display !== 'none' && btn.style.display !== '';
    }, { timeout: 5000 });

    // Instructor closes the poll
    await instructorPage.locator('#close-poll-btn').click();

    // Wait for buttons to be disabled on participant page
    await participantPage.waitForFunction(
      () => document.querySelector('.poll-vote-btn')?.disabled,
      { timeout: 3000 }
    );

    // Reset votes array (clear any votes from before close)
    votes.length = 0;

    // Try to click a disabled button using page.evaluate to bypass Playwright actionability checks
    await participantPage.evaluate(() => {
      const btn = document.querySelectorAll('.poll-vote-btn')[0];
      if (btn) btn.click();
    });

    // Wait 300ms for any socket events to arrive
    await participantPage.waitForTimeout(300);

    // Assert no poll:vote events were emitted after close
    expect(votes.length).toBe(0);

    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-05-6-no-vote-after-close.png'),
      fullPage: true,
    });
  } finally {
    await ctx1.close();
    await ctx2.close();
  }
});

// ── QA-05-7 — Mobile viewport: buttons at least 80px tall ───────────────────
test('QA-05-7 — mobile viewport: buttons at least 80px tall', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-05-7 Mobile Viewport Test');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  // Create context with mobile viewport BEFORE goto
  const mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 667 },
  });
  const participantPage = await mobileCtx.newPage();

  try {
    // Set up participant with mobile viewport
    await setupRoom(participantPage, request, { code: session.code });

    // Start a poll via API with 3 options
    await startPoll(request, session.sessionId, instructorToken, 'Mobile test?', ['Yes', 'No', 'Maybe']);

    // Wait for overlay to appear
    await waitForOverlay(participantPage);

    // For each .poll-vote-btn: measure boundingBox().height
    const allBtns = participantPage.locator('.poll-vote-btn');
    const btnCount = await allBtns.count();
    expect(btnCount).toBeGreaterThan(0);

    for (let i = 0; i < btnCount; i++) {
      const box = await allBtns.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThanOrEqual(80);
    }

    // Screenshot at 375px width
    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-05-7-mobile-viewport.png'),
      fullPage: true,
    });
  } finally {
    await mobileCtx.close();
  }
});
