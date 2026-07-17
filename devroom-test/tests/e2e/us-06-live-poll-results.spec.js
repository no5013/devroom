/**
 * E2E tests for US-06 — View Live Poll Results
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const SCREENSHOTS = path.resolve(__dirname, '../../../03-test/us-06-live-poll-results/screenshots');
const BASE_URL = 'http://localhost:3005';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createSession(request, name = 'Live Poll Results Test') {
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

async function startPoll(request, sessionId, token, question = 'Ready?', options = ['Yes', 'No']) {
  const res = await request.post(`/api/sessions/${sessionId}/polls?token=${token}`, {
    data: { question, options }
  });
  return await res.json();
}

// ── QA-06-7 — Percentage calculation (simplest, instructor-only) ─────────────
test('QA-06-7 — percentage calculation: 75 Alpha, 25 Beta', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-06-7 Percentage Test');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const instructorPage = await ctx.newPage();

  try {
    await setupRoom(instructorPage, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });

    // Start a poll with 2 options
    const poll = await startPoll(request, session.sessionId, instructorToken, 'Alpha or Beta?', ['Alpha', 'Beta']);

    // Wait for results panel to be visible
    await instructorPage.waitForFunction(() => {
      const panel = document.getElementById('results-panel');
      return panel && panel.style.display === 'block';
    }, { timeout: 5000 });

    // Vote 75 times on Alpha, 25 times on Beta via page.evaluate
    await instructorPage.evaluate(({ alphaOptionId, betaOptionId, pollId }) => {
      const btns = document.querySelectorAll('.poll-vote-btn');
      let alphaBtn = null;
      let betaBtn = null;
      btns.forEach(btn => {
        if (btn.dataset.optionId === alphaOptionId) alphaBtn = btn;
        if (btn.dataset.optionId === betaOptionId) betaBtn = btn;
      });
      // Fallback: use index if data-option-id not matching
      if (!alphaBtn) alphaBtn = btns[0];
      if (!betaBtn) betaBtn = btns[1];
      for (let i = 0; i < 75; i++) { if (alphaBtn) alphaBtn.click(); }
      for (let i = 0; i < 25; i++) { if (betaBtn) betaBtn.click(); }
    }, {
      alphaOptionId: poll.options ? poll.options[0].id : '',
      betaOptionId: poll.options ? poll.options[1].id : '',
      pollId: poll.id
    });

    // Wait for poll:results to settle
    await instructorPage.waitForTimeout(1000);

    // Read .bar-stat text for each .bar-row
    const barRows = instructorPage.locator('#results-bars .bar-row');
    const barCount = await barRows.count();
    expect(barCount).toBeGreaterThanOrEqual(2);

    // Collect stats
    const stats = [];
    for (let i = 0; i < barCount; i++) {
      const statText = await barRows.nth(i).locator('.bar-stat').textContent();
      stats.push(statText.trim());
    }

    // Alpha (first option) should show 75%, Beta (second) should show 25%
    expect(stats[0]).toContain('75%');
    expect(stats[1]).toContain('25%');

    await instructorPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-06-7-percentage-calc.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-06-1 — Bars update within 800 ms of votes ─────────────────────────────
test('QA-06-1 — bars update within 800ms of 3 participant votes', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-06-1 Bars Update Test');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const ctx3 = await browser.newContext();
  const ctx4 = await browser.newContext();

  const instructorPage = await ctx1.newPage();
  const participant1Page = await ctx2.newPage();
  const participant2Page = await ctx3.newPage();
  const participant3Page = await ctx4.newPage();

  try {
    await setupRoom(instructorPage, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });
    await setupRoom(participant1Page, request, { code: session.code });
    await setupRoom(participant2Page, request, { code: session.code });
    await setupRoom(participant3Page, request, { code: session.code });

    // Instructor starts poll
    await startPoll(request, session.sessionId, instructorToken, 'Quick vote?', ['Yes', 'No']);

    // Wait for results panel on instructor
    await instructorPage.waitForFunction(() => {
      const panel = document.getElementById('results-panel');
      return panel && panel.style.display === 'block';
    }, { timeout: 5000 });

    // Wait for poll overlay on participants
    for (const pPage of [participant1Page, participant2Page, participant3Page]) {
      await pPage.waitForFunction(() => {
        const overlay = document.getElementById('active-poll-overlay');
        return overlay && overlay.style.display === 'block';
      }, { timeout: 5000 });
    }

    // Each participant clicks their vote button once
    for (const pPage of [participant1Page, participant2Page, participant3Page]) {
      await pPage.evaluate(() => {
        const btn = document.querySelector('.poll-vote-btn');
        if (btn) btn.click();
      });
    }

    // Wait for bar fill to update on instructor page (within 800ms)
    await instructorPage.waitForFunction(
      () => {
        const fill = document.querySelector('#results-bars .bar-fill');
        return fill && fill.style.width !== '' && fill.style.width !== '0%';
      },
      { timeout: 800 }
    );

    // Assert at least one .bar-fill has width > "0%"
    const fills = instructorPage.locator('#results-bars .bar-fill');
    const fillCount = await fills.count();
    let anyNonZero = false;
    for (let i = 0; i < fillCount; i++) {
      const width = await fills.nth(i).evaluate(el => el.style.width);
      if (width && width !== '0%') {
        anyNonZero = true;
        break;
      }
    }
    expect(anyNonZero).toBe(true);

    await instructorPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-06-1-bars-update.png'),
      fullPage: true,
    });
  } finally {
    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
    await ctx4.close();
  }
});

// ── QA-06-2 — Show results to room toggle ────────────────────────────────────
test('QA-06-2 — show results to room toggle', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-06-2 Show Results Toggle');
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

    // Instructor starts poll
    await startPoll(request, session.sessionId, instructorToken, 'Show me?', ['Yes', 'No']);

    // Wait for results panel on instructor
    await instructorPage.waitForFunction(() => {
      const panel = document.getElementById('results-panel');
      return panel && panel.style.display === 'block';
    }, { timeout: 5000 });

    // Assert participant results panel is NOT visible initially
    const initialDisplay = await participantPage.evaluate(() => {
      const panel = document.getElementById('participant-results-panel');
      return panel ? panel.style.display : 'none';
    });
    expect(initialDisplay).toBe('none');

    // Instructor clicks #show-results-btn (OFF → ON)
    await instructorPage.locator('#show-results-btn').click();

    // Wait for participant results panel to become visible
    await participantPage.waitForFunction(() => {
      const panel = document.getElementById('participant-results-panel');
      return panel && panel.style.display === 'block';
    }, { timeout: 2000 });

    // Assert participant panel is visible
    const visibleDisplay = await participantPage.evaluate(() => {
      const panel = document.getElementById('participant-results-panel');
      return panel ? panel.style.display : '';
    });
    expect(visibleDisplay).toBe('block');

    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-06-2-results-visible.png'),
      fullPage: true,
    });

    // Instructor clicks again (ON → OFF)
    await instructorPage.locator('#show-results-btn').click();

    // Wait 1s; assert panel is hidden
    await participantPage.waitForTimeout(1000);

    const hiddenDisplay = await participantPage.evaluate(() => {
      const panel = document.getElementById('participant-results-panel');
      return panel ? panel.style.display : '';
    });
    expect(hiddenDisplay).toBe('none');

    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-06-2-results-hidden.png'),
      fullPage: true,
    });
  } finally {
    await ctx1.close();
    await ctx2.close();
  }
});

// ── QA-06-3 — Voter count: 3 distinct voters, 4th non-voter excluded ─────────
test('QA-06-3 — voter count shows 3, not 4', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-06-3 Voter Count Test');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const ctx3 = await browser.newContext();
  const ctx4 = await browser.newContext();
  const ctx5 = await browser.newContext();

  const instructorPage = await ctx1.newPage();
  const participant1Page = await ctx2.newPage();
  const participant2Page = await ctx3.newPage();
  const participant3Page = await ctx4.newPage();
  const participant4Page = await ctx5.newPage();

  try {
    await setupRoom(instructorPage, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });
    await setupRoom(participant1Page, request, { code: session.code });
    await setupRoom(participant2Page, request, { code: session.code });
    await setupRoom(participant3Page, request, { code: session.code });
    await setupRoom(participant4Page, request, { code: session.code });

    // Instructor starts poll
    await startPoll(request, session.sessionId, instructorToken, 'Voter count?', ['Yes', 'No']);

    // Wait for poll overlay on participants 1-3
    for (const pPage of [participant1Page, participant2Page, participant3Page]) {
      await pPage.waitForFunction(() => {
        const overlay = document.getElementById('active-poll-overlay');
        return overlay && overlay.style.display === 'block';
      }, { timeout: 5000 });
    }

    // Participants 1, 2, 3 each vote once
    for (const pPage of [participant1Page, participant2Page, participant3Page]) {
      await pPage.evaluate(() => {
        const btn = document.querySelector('.poll-vote-btn');
        if (btn) btn.click();
      });
    }
    // Participant 4 does NOT vote

    // Wait for results to propagate
    await instructorPage.waitForTimeout(500);

    // Wait for results panel on instructor
    await instructorPage.waitForFunction(() => {
      const panel = document.getElementById('results-panel');
      return panel && panel.style.display === 'block';
    }, { timeout: 5000 });

    // Read voter count text
    const voterCountText = await instructorPage.locator('#results-voter-count').textContent();

    // Assert contains "3" and not "4"
    expect(voterCountText).toContain('3');
    expect(voterCountText).not.toContain('4');

    await instructorPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-06-3-voter-count.png'),
      fullPage: true,
    });
  } finally {
    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
    await ctx4.close();
    await ctx5.close();
  }
});

// ── QA-06-4 — Freeze on close: "Final Results" heading, show-results disabled ─
test('QA-06-4 — freeze on close: Final Results heading, show-results disabled', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-06-4 Freeze On Close Test');
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

    // Start poll
    await startPoll(request, session.sessionId, instructorToken, 'Freeze me?', ['Yes', 'No']);

    // Wait for results panel on instructor
    await instructorPage.waitForFunction(() => {
      const panel = document.getElementById('results-panel');
      return panel && panel.style.display === 'block';
    }, { timeout: 5000 });

    // Wait for poll overlay on participant
    await participantPage.waitForFunction(() => {
      const overlay = document.getElementById('active-poll-overlay');
      return overlay && overlay.style.display === 'block';
    }, { timeout: 5000 });

    // Both vote a few times
    await instructorPage.evaluate(() => {
      const btn = document.querySelector('.poll-vote-btn');
      if (btn) { btn.click(); btn.click(); }
    });
    await participantPage.evaluate(() => {
      const btn = document.querySelector('.poll-vote-btn');
      if (btn) { btn.click(); btn.click(); btn.click(); }
    });

    // Wait for close-poll-btn to be visible on instructor
    await instructorPage.waitForFunction(() => {
      const btn = document.getElementById('close-poll-btn');
      return btn && btn.style.display !== 'none' && btn.style.display !== '';
    }, { timeout: 5000 });

    // Instructor closes the poll
    await instructorPage.locator('#close-poll-btn').click();

    // Wait for "Final Results" heading (up to 3s)
    await instructorPage.waitForFunction(() => {
      const heading = document.getElementById('results-heading');
      return heading && heading.textContent === 'Final Results';
    }, { timeout: 3000 });

    // Assert heading is "Final Results"
    const headingText = await instructorPage.locator('#results-heading').textContent();
    expect(headingText).toContain('Final Results');

    // Assert show-results-btn is disabled
    const isDisabled = await instructorPage.locator('#show-results-btn').evaluate(el => el.disabled);
    expect(isDisabled).toBe(true);

    await instructorPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-06-4-freeze-on-close.png'),
      fullPage: true,
    });
  } finally {
    await ctx1.close();
    await ctx2.close();
  }
});

// ── QA-06-5 — History snapshot accuracy ──────────────────────────────────────
test('QA-06-5 — history snapshot: 40 Yes, 10 No', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-06-5 History Snapshot Test');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const ctx = await browser.newContext();
  const instructorPage = await ctx.newPage();

  try {
    await setupRoom(instructorPage, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });

    // Start a poll
    const poll = await startPoll(request, session.sessionId, instructorToken, 'History test?', ['Yes', 'No']);

    // Wait for results panel and poll overlay
    await instructorPage.waitForFunction(() => {
      const panel = document.getElementById('results-panel');
      return panel && panel.style.display === 'block';
    }, { timeout: 5000 });

    // Vote 40 times on Yes, 10 times on No via page.evaluate
    await instructorPage.evaluate(({ yesId, noId }) => {
      const btns = document.querySelectorAll('.poll-vote-btn');
      let yesBtn = null, noBtn = null;
      btns.forEach(btn => {
        if (btn.dataset.optionId === yesId) yesBtn = btn;
        if (btn.dataset.optionId === noId) noBtn = btn;
      });
      if (!yesBtn) yesBtn = btns[0];
      if (!noBtn) noBtn = btns[1];
      for (let i = 0; i < 40; i++) { if (yesBtn) yesBtn.click(); }
      for (let i = 0; i < 10; i++) { if (noBtn) noBtn.click(); }
    }, {
      yesId: poll.options ? poll.options[0].id : '',
      noId: poll.options ? poll.options[1].id : ''
    });

    // Wait for votes to settle
    await instructorPage.waitForTimeout(1000);

    // Wait for close-poll-btn visible
    await instructorPage.waitForFunction(() => {
      const btn = document.getElementById('close-poll-btn');
      return btn && btn.style.display !== 'none' && btn.style.display !== '';
    }, { timeout: 5000 });

    // Close the poll
    await instructorPage.locator('#close-poll-btn').click();

    // Wait for poll history to become visible (up to 3s)
    await instructorPage.waitForFunction(() => {
      const histEl = document.getElementById('poll-history');
      return histEl && histEl.style.display !== 'none' && histEl.style.display !== '';
    }, { timeout: 3000 });

    // Open the <details> element so that list items become visible
    await instructorPage.evaluate(() => {
      const details = document.querySelector('#poll-history details');
      if (details) details.open = true;
    });

    // Wait for at least one history list item to appear (now visible after opening details)
    await instructorPage.waitForSelector('#poll-history-list li', { timeout: 3000 });

    // Read the first history entry text
    const firstEntryText = await instructorPage.locator('#poll-history-list li').first().textContent();

    // Assert "40" and "10" appear in the history entry
    expect(firstEntryText).toContain('40');
    expect(firstEntryText).toContain('10');

    await instructorPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-06-5-history-snapshot.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});

// ── QA-06-6 — Projector mode: font enlarges at 1920×1080 ─────────────────────
test('QA-06-6 — projector mode enlarges font at 1920x1080', async ({ browser, request }) => {
  const session = await createSession(request, 'QA-06-6 Projector Mode Test');
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  // Create context with 1920×1080 viewport
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const instructorPage = await ctx.newPage();

  try {
    await setupRoom(instructorPage, request, {
      code: session.code,
      instructorToken,
      asInstructor: true,
    });

    // Start poll so results panel is visible
    await startPoll(request, session.sessionId, instructorToken, 'Projector test?', ['Yes', 'No']);

    // Wait for results panel
    await instructorPage.waitForFunction(() => {
      const panel = document.getElementById('results-panel');
      return panel && panel.style.display === 'block';
    }, { timeout: 5000 });

    // Measure base font-size before projector mode
    const baseFontSize = await instructorPage.evaluate(() =>
      parseFloat(getComputedStyle(document.body).fontSize)
    );

    // Click projector mode button
    await instructorPage.locator('#projector-mode-btn').click();

    // Measure font-size after projector mode
    const projectorFontSize = await instructorPage.evaluate(() =>
      parseFloat(getComputedStyle(document.body).fontSize)
    );

    // Assert projector font-size > base font-size
    expect(projectorFontSize).toBeGreaterThan(baseFontSize);
    // Projector sets font-size to 1.5rem which is typically 24px
    expect(projectorFontSize).toBeGreaterThan(20);

    // Assert body has projector-mode class
    const hasClass = await instructorPage.evaluate(() =>
      document.body.classList.contains('projector-mode')
    );
    expect(hasClass).toBe(true);

    await instructorPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-06-6-projector-mode.png'),
      fullPage: true,
    });
  } finally {
    await ctx.close();
  }
});
