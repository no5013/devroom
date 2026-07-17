/**
 * E2E tests for US-03 — Create and Manage a Session
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const SCREENSHOTS = path.resolve(__dirname, '../../../03-test/us-03-create-session/screenshots');
const BASE_URL = 'http://localhost:3002';

/**
 * Helper: create a session via API.
 * Returns { sessionId, code, participantUrl, instructorUrl }
 */
async function createSession(request, name = 'Test Session') {
  const res = await request.post('/api/sessions', { data: { name } });
  const session = await res.json();
  return session;
}

/**
 * Helper: set up a room page (participant or instructor).
 * Returns the identity object from the join response.
 */
async function setupRoom(page, request, { sessionCode, instructorToken, asInstructor = false } = {}) {
  const joinUrl = asInstructor
    ? `/api/sessions/${sessionCode}/join?role=instructor&token=${instructorToken}`
    : `/api/sessions/${sessionCode}/join`;
  const jRes = await request.post(joinUrl);
  const identity = await jRes.json();
  if (!identity.role) identity.role = asInstructor ? 'instructor' : 'participant';

  await page.addInitScript(({ id, code }) => {
    sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: code }));
  }, { id: identity, code: sessionCode });

  await page.goto(`/room.html?code=${sessionCode}`);

  // Wait for socket info event to populate session name
  await page.waitForFunction(() => {
    const el = document.getElementById('session-name');
    return el && el.textContent && el.textContent !== 'devroom' && el.textContent.length > 3;
  }, { timeout: 6000 }).catch(() => {});

  await page.waitForTimeout(500); // let socket settle

  return identity;
}

// ── QA-03-7 — No login needed to create a session ───────────────────────────
test('QA-03-7 — no login needed to create a session', async ({ page }) => {
  // Fresh browser context — navigate to / directly
  await page.goto('/');

  // Fill the session name input and submit
  await page.locator('#session-name').fill('No Auth Required');
  await page.locator('button[type="submit"]').click();

  // Wait for confirmation screen
  await expect(page.locator('#confirm-screen')).toBeVisible({ timeout: 8000 });

  // Assert no auth prompt (no redirect to a login page, still on /)
  expect(page.url()).not.toContain('/login');
  expect(page.url()).not.toContain('/auth');

  // Confirm create-card is hidden
  await expect(page.locator('#create-card')).not.toBeVisible();

  await page.screenshot({
    path: path.join(SCREENSHOTS, 'qa-03-7-no-login-needed.png'),
    fullPage: true,
  });
});

// ── QA-03-1 — Creation returns participantUrl and instructorUrl ──────────────
test('QA-03-1 — creation returns participantUrl and instructorUrl', async ({ page, request }) => {
  // Create via the form
  await page.goto('/');
  await page.locator('#session-name').fill('URL Test Session');
  await page.locator('button[type="submit"]').click();

  // Wait for confirmation screen
  await expect(page.locator('#confirm-screen')).toBeVisible({ timeout: 8000 });

  const participantUrlText = await page.locator('#participant-url-display').textContent();
  const instructorUrlText = await page.locator('#instructor-url-display').textContent();

  // Both must contain "/join?code="
  expect(participantUrlText).toContain('/join?code=');
  expect(instructorUrlText).toContain('/join?code=');

  // They must be different (instructor URL has token param)
  expect(participantUrlText).not.toBe(instructorUrlText);
  expect(instructorUrlText).toContain('token=');
  expect(participantUrlText).not.toContain('token=');

  // QR code src contains /api/sessions/qr
  const qrSrc = await page.locator('#participant-qr').getAttribute('src');
  expect(qrSrc).toContain('/api/sessions/qr');

  await page.screenshot({
    path: path.join(SCREENSHOTS, 'qa-03-1-confirm-screen.png'),
    fullPage: true,
  });
});

// ── QA-03-2 — Participant view has no moderator controls ─────────────────────
test('QA-03-2 — participant view has no moderator controls', async ({ page, request }) => {
  const session = await createSession(request, 'Participant Controls Test');
  const sessionCode = session.code;

  await setupRoom(page, request, { sessionCode });

  // #instructor-panel should NOT be visible
  const panelVisible = await page.locator('#instructor-panel').isVisible();
  expect(panelVisible).toBe(false);

  // #end-session-btn should NOT be visible
  const endBtnVisible = await page.locator('#end-session-btn').isVisible();
  expect(endBtnVisible).toBe(false);

  await page.screenshot({
    path: path.join(SCREENSHOTS, 'qa-03-2-participant-no-controls.png'),
    fullPage: true,
  });
});

// ── QA-03-3 — Instructor view has moderator controls ─────────────────────────
test('QA-03-3 — instructor view has moderator controls', async ({ page, request }) => {
  const session = await createSession(request, 'Instructor Controls Test');
  const sessionCode = session.code;
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  await setupRoom(page, request, { sessionCode, instructorToken, asInstructor: true });

  // Wait up to 4s for #instructor-panel to become visible
  await expect(page.locator('#instructor-panel')).toBeVisible({ timeout: 4000 });

  // Assert all moderator controls are present
  await expect(page.locator('#end-session-btn')).toBeVisible();
  await expect(page.locator('#create-poll-btn')).toBeVisible();

  await page.screenshot({
    path: path.join(SCREENSHOTS, 'qa-03-3-instructor-controls.png'),
    fullPage: true,
  });
});

// ── QA-03-6 — Session name appears in room header ─────────────────────────────
test('QA-03-6 — session name appears in room header', async ({ page, request }) => {
  const session = await createSession(request, 'E2E Test Room');
  const sessionCode = session.code;

  await setupRoom(page, request, { sessionCode });

  // Wait for #session-name to contain "E2E Test Room" (timeout 5s)
  await page.waitForFunction(() => {
    const el = document.getElementById('session-name');
    return el && el.textContent.includes('E2E Test Room');
  }, { timeout: 5000 });

  const sessionNameText = await page.locator('#session-name').textContent();
  expect(sessionNameText).toContain('E2E Test Room');

  await page.screenshot({
    path: path.join(SCREENSHOTS, 'qa-03-6-session-name.png'),
    fullPage: true,
  });
});

// ── QA-03-4 — End session modal appears for all participants ──────────────────
test('QA-03-4 — end session modal appears for all participants', async ({ browser, request }) => {
  const session = await createSession(request, 'End Session Test');
  const sessionCode = session.code;
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  // Create two contexts
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const instructorPage = await ctx1.newPage();
  const participantPage = await ctx2.newPage();

  try {
    // Join as instructor
    const instrJoinRes = await request.post(
      `/api/sessions/${sessionCode}/join?role=instructor&token=${instructorToken}`
    );
    const instrIdentity = await instrJoinRes.json();
    if (!instrIdentity.role) instrIdentity.role = 'instructor';

    // Join as participant
    const partJoinRes = await request.post(`/api/sessions/${sessionCode}/join`);
    const partIdentity = await partJoinRes.json();
    if (!partIdentity.role) partIdentity.role = 'participant';

    // Set up instructor page
    await instructorPage.addInitScript(({ id, code }) => {
      sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: code }));
    }, { id: instrIdentity, code: sessionCode });
    await instructorPage.goto(`/room.html?code=${sessionCode}`);

    // Set up participant page
    await participantPage.addInitScript(({ id, code }) => {
      sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: code }));
    }, { id: partIdentity, code: sessionCode });
    await participantPage.goto(`/room.html?code=${sessionCode}`);

    // Wait for instructor panel to show (confirms socket info received)
    await instructorPage.waitForFunction(() => {
      const el = document.getElementById('instructor-panel');
      return el && el.style.display !== 'none' && el.style.display !== '';
    }, { timeout: 6000 });

    // Wait for participant page socket to settle
    await participantPage.waitForFunction(() => {
      const el = document.getElementById('session-name');
      return el && el.textContent !== 'devroom';
    }, { timeout: 6000 }).catch(() => {});
    await participantPage.waitForTimeout(500);

    // Set up dialog handler to accept confirm() before clicking end-session
    instructorPage.on('dialog', dialog => dialog.accept());

    // Click end session
    await instructorPage.locator('#end-session-btn').click();

    // Participant: wait for session-ended-modal to become visible (display:flex)
    await participantPage.waitForFunction(() => {
      const modal = document.getElementById('session-ended-modal');
      return modal && modal.style.display === 'flex';
    }, { timeout: 5000 });

    // Assert modal is visible on participant page
    const modalDisplay = await participantPage.locator('#session-ended-modal').evaluate(el => el.style.display);
    expect(modalDisplay).toBe('flex');

    // Assert send-btn is disabled for participant
    const sendBtnDisabled = await participantPage.locator('#send-btn').isDisabled();
    expect(sendBtnDisabled).toBe(true);

    // Screenshots
    await instructorPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-03-4-instructor-ended.png'),
      fullPage: true,
    });
    await participantPage.screenshot({
      path: path.join(SCREENSHOTS, 'qa-03-4-participant-modal.png'),
      fullPage: true,
    });
  } finally {
    await ctx1.close();
    await ctx2.close();
  }
});

// ── QA-03-5 — Instructor reconnect restores moderator controls ────────────────
test('QA-03-5 — instructor reconnect restores moderator controls', async ({ browser, request }) => {
  const session = await createSession(request, 'Reconnect Test');
  const sessionCode = session.code;
  const instructorToken = new URL(session.instructorUrl, BASE_URL).searchParams.get('token');

  const instrCtx = await browser.newContext();
  const instrPage1 = await instrCtx.newPage();

  try {
    // Join as instructor
    const joinRes = await request.post(
      `/api/sessions/${sessionCode}/join?role=instructor&token=${instructorToken}`
    );
    const instrIdentity = await joinRes.json();
    if (!instrIdentity.role) instrIdentity.role = 'instructor';

    // Set up first instructor page
    await instrPage1.addInitScript(({ id, code }) => {
      sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: code }));
    }, { id: instrIdentity, code: sessionCode });
    await instrPage1.goto(`/room.html?code=${sessionCode}`);

    // Verify instructor panel is visible on first page
    await expect(instrPage1.locator('#instructor-panel')).toBeVisible({ timeout: 6000 });

    // Close page1 (simulate navigation away / reconnect)
    await instrPage1.close();

    // Open a new page in the same instructor context
    const instrPage2 = await instrCtx.newPage();

    // Inject the same instructor identity into sessionStorage
    await instrPage2.addInitScript(({ id, code }) => {
      sessionStorage.setItem('devroom_identity', JSON.stringify({ ...id, sessionCode: code }));
    }, { id: instrIdentity, code: sessionCode });

    // Navigate to the room again
    await instrPage2.goto(`/room.html?code=${sessionCode}`);

    // Wait for instructor panel to become visible again (timeout 5s)
    await expect(instrPage2.locator('#instructor-panel')).toBeVisible({ timeout: 5000 });

    // Assert instructor panel is visible on reconnected page
    await expect(instrPage2.locator('#instructor-panel')).toBeVisible();

    await instrPage2.screenshot({
      path: path.join(SCREENSHOTS, 'qa-03-5-instructor-reconnect.png'),
      fullPage: true,
    });
  } finally {
    await instrCtx.close();
  }
});
