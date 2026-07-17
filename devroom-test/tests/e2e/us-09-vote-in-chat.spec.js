/**
 * E2E tests for US-09 — Vote and See Live Results Inside the Chat Bubble
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS = path.resolve(__dirname, '../../../03-test/us-09-vote-in-chat/screenshots');
const BASE_URL = 'http://localhost:3008';

// Ensure screenshots dir exists
fs.mkdirSync(SCREENSHOTS, { recursive: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createSession(request, name = 'US-09 Test') {
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

async function waitForPollCard(page, timeout = 3000) {
  await page.waitForFunction(
    () => !!document.querySelector('#poll-card-area .poll-card'),
    { timeout }
  );
}

// ── QA-09-1 — 100 clicks register as exactly 100 votes on server ─────────────
test('QA-09-1 — 100 clicks register as exactly 100 votes on server', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-09-1 100 Clicks');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const instructorPage = await ctx1.newPage();
  const participantPage = await ctx2.newPage();

  try {
    await setupRoom(instructorPage, request, { code: session.code, instructorToken, asInstructor: true });
    await setupRoom(participantPage, request, { code: session.code });

    await createPollViaApi(request, session.sessionId, instructorToken, 'Spam?', ['Yes', 'No', 'Maybe']);

    await waitForPollCard(participantPage);

    // Batch 100 clicks via page.evaluate for speed
    await participantPage.evaluate(() => {
      const btn = document.querySelectorAll('.poll-vote-btn')[0];
      for (let i = 0; i < 100; i++) {
        btn.click();
      }
    });

    // Wait for all socket roundtrips
    await participantPage.waitForTimeout(1000);

    const pollsRes = await request.get(`/api/sessions/${session.sessionId}/polls?token=${instructorToken}`);
    const polls = await pollsRes.json();

    const activePoll = polls.find(p => p.status === 'active');
    expect(activePoll).toBeTruthy();

    const total = Object.values(activePoll.results).reduce((sum, v) => sum + v, 0);
    expect(total).toBe(100);

    // Verify personal counter shows "You: 100"
    const personalText = await participantPage.locator('.poll-vote-btn').first().locator('[data-role="personal"]').textContent();
    expect(personalText).toBe('You: 100');

    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-09-1-100-clicks.png'),
      fullPage: true,
    });
  } finally {
    await ctx1.close();
    await ctx2.close();
  }
});

// ── QA-09-2 — Bounce animation fires on each click ───────────────────────────
test('QA-09-2 — bounce animation fires on each click', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-09-2 Bounce Test');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const participantPage = await ctx.newPage();

  try {
    await setupRoom(participantPage, request, { code: session.code });
    await createPollViaApi(request, session.sessionId, instructorToken, 'Bounce?', ['Yes', 'No']);
    await waitForPollCard(participantPage);

    // Inject animationstart counter before clicking
    await participantPage.evaluate(() => {
      window._bounceCount = 0;
      const btn = document.querySelectorAll('.poll-vote-btn')[0];
      btn.addEventListener('animationstart', () => {
        window._bounceCount = (window._bounceCount || 0) + 1;
      });
    });

    // Click 5 times with 80ms delay so animationend (0.18s animation) fires between clicks
    const btn = participantPage.locator('.poll-vote-btn').first();
    for (let i = 0; i < 5; i++) {
      await btn.click();
      await participantPage.waitForTimeout(80);
    }

    // Wait for remaining animations to settle
    await participantPage.waitForTimeout(300);

    const bounceCount = await participantPage.evaluate(() => window._bounceCount);
    expect(bounceCount).toBeGreaterThanOrEqual(5);

    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-09-2-bounce-animation.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-09-3 — Personal counter "You: N" updates on every click ───────────────
test('QA-09-3 — personal counter "You: N" updates on every click', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-09-3 Personal Counter');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const participantPage = await ctx.newPage();

  try {
    await setupRoom(participantPage, request, { code: session.code });
    await createPollViaApi(request, session.sessionId, instructorToken, 'Count?', ['Yes', 'No', 'Maybe']);
    await waitForPollCard(participantPage);

    // Batch click "Yes" 10 times via page.evaluate
    await participantPage.evaluate(() => {
      const btn = document.querySelectorAll('.poll-vote-btn')[0];
      for (let i = 0; i < 10; i++) {
        btn.click();
      }
    });

    // Assert personal counter shows "You: 10"
    const personalEl = participantPage.locator('.poll-vote-btn').first().locator('[data-role="personal"]');
    await expect(personalEl).toHaveText('You: 10');

    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-09-3-personal-counter.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-09-4 — Aggregate "Total: N" updates across two participant contexts ────
test('QA-09-4 — aggregate totals update across two participant contexts', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-09-4 Aggregate Totals');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  try {
    await setupRoom(page1, request, { code: session.code });
    await setupRoom(page2, request, { code: session.code });

    await createPollViaApi(request, session.sessionId, instructorToken, 'Yes or No?', ['Yes', 'No', 'Maybe']);

    await waitForPollCard(page1);
    await waitForPollCard(page2);

    // ctx1 clicks "Yes" 7 times (batch)
    await page1.evaluate(() => {
      const btn = document.querySelectorAll('.poll-vote-btn')[0];
      for (let i = 0; i < 7; i++) btn.click();
    });

    // ctx2 clicks "No" 3 times (batch)
    await page2.evaluate(() => {
      const btn = document.querySelectorAll('.poll-vote-btn')[1];
      for (let i = 0; i < 3; i++) btn.click();
    });

    // Wait for poll:results to propagate
    await page1.waitForTimeout(800);

    // On ctx1 page: check "Yes" total >= 7 and "No" total >= 3
    const yesTotalText = await page1.locator('.poll-vote-btn').nth(0).locator('[data-role="total"]').textContent();
    const noTotalText = await page1.locator('.poll-vote-btn').nth(1).locator('[data-role="total"]').textContent();

    const yesTotal = parseInt(yesTotalText.replace('Total: ', ''), 10);
    const noTotal = parseInt(noTotalText.replace('Total: ', ''), 10);

    expect(yesTotal).toBeGreaterThanOrEqual(7);
    expect(noTotal).toBeGreaterThanOrEqual(3);

    await page1.screenshot({
      path: path.join(SCREENSHOTS, 'qa-09-4-aggregate-totals.png'),
      fullPage: true,
    });
  } finally {
    await ctx1.close();
    await ctx2.close();
  }
});

// ── QA-09-5 — Percentage bar width changes after votes ───────────────────────
test('QA-09-5 — percentage bar width changes after votes', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-09-5 Bar Width');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const instructorPage = await ctx1.newPage();
  const participantPage = await ctx2.newPage();

  try {
    await setupRoom(instructorPage, request, { code: session.code, instructorToken, asInstructor: true });
    await setupRoom(participantPage, request, { code: session.code });

    await createPollViaApi(request, session.sessionId, instructorToken, 'Bar test?', ['Yes', 'No', 'Maybe']);

    await waitForPollCard(instructorPage);
    await waitForPollCard(participantPage);

    // Participant votes: 3× Yes, 1× No (batch)
    await participantPage.evaluate(() => {
      const yesBtn = document.querySelectorAll('.poll-vote-btn')[0];
      const noBtn = document.querySelectorAll('.poll-vote-btn')[1];
      for (let i = 0; i < 3; i++) yesBtn.click();
      noBtn.click();
    });

    await instructorPage.waitForTimeout(500);

    // Instructor always sees bars — read computed width of first .poll-bar-fill
    const barWidth = await instructorPage.evaluate(() => {
      const fill = document.querySelector('#poll-card-area .poll-bar-fill');
      if (!fill) return '0%';
      return getComputedStyle(fill).width;
    });

    // Width should be something meaningful (not 0px or 0%)
    expect(barWidth).not.toBe('0%');
    expect(barWidth).not.toBe('0px');

    await instructorPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-09-5-bar-width.png'),
      fullPage: true,
    });
  } finally {
    await ctx1.close();
    await ctx2.close();
  }
});

// ── QA-09-6 — Voter count increments correctly (3 distinct voters) ────────────
test('QA-09-6 — voter count increments correctly for 3 distinct voters', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-09-6 Voter Count');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const instructorCtx = await browser.newContext();
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const ctx3 = await browser.newContext();

  const instructorPage = await instructorCtx.newPage();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();
  const p3 = await ctx3.newPage();

  try {
    await setupRoom(instructorPage, request, { code: session.code, instructorToken, asInstructor: true });
    await setupRoom(p1, request, { code: session.code });
    await setupRoom(p2, request, { code: session.code });
    await setupRoom(p3, request, { code: session.code });

    await createPollViaApi(request, session.sessionId, instructorToken, 'Voter count?', ['Yes', 'No', 'Maybe']);

    await waitForPollCard(instructorPage);
    await waitForPollCard(p1);
    await waitForPollCard(p2);
    await waitForPollCard(p3);

    // Each participant votes once
    await p1.evaluate(() => document.querySelectorAll('.poll-vote-btn')[0].click());
    await p2.evaluate(() => document.querySelectorAll('.poll-vote-btn')[1].click());
    await p3.evaluate(() => document.querySelectorAll('.poll-vote-btn')[2].click());

    // Use waitForFunction with 3s timeout since 3 socket roundtrips are needed
    await instructorPage.waitForFunction(
      () => {
        const vcEl = document.querySelector('#poll-card-area .poll-voter-count');
        if (!vcEl) return false;
        const text = vcEl.textContent || '';
        const match = text.match(/(\d+)/);
        return match && parseInt(match[1], 10) >= 3;
      },
      { timeout: 3000 }
    );

    const voterCountText = await instructorPage.locator('#poll-card-area .poll-voter-count').textContent();
    expect(voterCountText).toMatch(/3/);

    await instructorPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-09-6-voter-count.png'),
      fullPage: true,
    });
  } finally {
    await instructorCtx.close();
    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  }
});

// ── QA-09-7 — "Show results" toggle controls participant bar visibility ────────
test('QA-09-7 — show results toggle controls participant bar visibility', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-09-7 Show Results Toggle');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const instructorCtx = await browser.newContext();
  const participantCtx = await browser.newContext();
  const instructorPage = await instructorCtx.newPage();
  const participantPage = await participantCtx.newPage();

  try {
    await setupRoom(instructorPage, request, { code: session.code, instructorToken, asInstructor: true });
    await setupRoom(participantPage, request, { code: session.code });

    await createPollViaApi(request, session.sessionId, instructorToken, 'Show toggle?', ['Yes', 'No', 'Maybe']);

    await waitForPollCard(instructorPage);
    await waitForPollCard(participantPage);

    // Default: participant .poll-bar-track should be hidden (display === 'none')
    const initialDisplay = await participantPage.evaluate(() => {
      const track = document.querySelector('#poll-card-area .poll-bar-track');
      return track ? getComputedStyle(track).display : 'none';
    });
    expect(initialDisplay).toBe('none');

    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-09-7-before-show-results.png'),
      fullPage: true,
    });

    // Instructor clicks .poll-show-toggle ("Show results: OFF" → "Show results: ON")
    await instructorPage.locator('.poll-show-toggle').click();

    // Wait for poll:results-visibility to propagate to participant
    await participantPage.waitForFunction(
      () => {
        const track = document.querySelector('#poll-card-area .poll-bar-track');
        return track && getComputedStyle(track).display !== 'none';
      },
      { timeout: 3000 }
    );

    const afterShowDisplay = await participantPage.evaluate(() => {
      const track = document.querySelector('#poll-card-area .poll-bar-track');
      return track ? getComputedStyle(track).display : 'none';
    });
    expect(afterShowDisplay).not.toBe('none');

    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-09-7-after-show-results-on.png'),
      fullPage: true,
    });

    // Instructor clicks toggle again ("Show results: ON" → "Show results: OFF")
    await instructorPage.locator('.poll-show-toggle').click();

    // Wait for bars to be hidden again
    await participantPage.waitForFunction(
      () => {
        const track = document.querySelector('#poll-card-area .poll-bar-track');
        return track && getComputedStyle(track).display === 'none';
      },
      { timeout: 3000 }
    );

    const afterHideDisplay = await participantPage.evaluate(() => {
      const track = document.querySelector('#poll-card-area .poll-bar-track');
      return track ? getComputedStyle(track).display : 'none';
    });
    expect(afterHideDisplay).toBe('none');

    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-09-7-after-show-results-off.png'),
      fullPage: true,
    });
  } finally {
    await instructorCtx.close();
    await participantCtx.close();
  }
});

// ── QA-09-8 — Old #results-panel and #show-results-btn absent from DOM ────────
test('QA-09-8 — #results-panel and #show-results-btn absent from DOM', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-09-8 Old Elements Absent');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const instructorPage = await ctx.newPage();

  try {
    await setupRoom(instructorPage, request, { code: session.code, instructorToken, asInstructor: true });

    // Create a poll so all UI is rendered
    await createPollViaApi(request, session.sessionId, instructorToken, 'DOM check?', ['Yes', 'No']);
    await waitForPollCard(instructorPage);

    // Assert old elements are absent
    const resultsPanelCount = await instructorPage.locator('#results-panel').count();
    expect(resultsPanelCount).toBe(0);

    const showResultsBtnCount = await instructorPage.locator('#show-results-btn').count();
    expect(showResultsBtnCount).toBe(0);

    // Also check participant-results-panel is absent
    const participantResultsPanelCount = await instructorPage.locator('#participant-results-panel').count();
    expect(participantResultsPanelCount).toBe(0);

    await instructorPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-09-8-old-elements-absent.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});
