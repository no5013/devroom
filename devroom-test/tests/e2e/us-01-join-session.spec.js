/**
 * E2E tests for US-01 — Join Session Anonymously
 * Verifies every acceptance criterion in 01-requirement/us-01-join-session.md
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const SCREENSHOTS = path.resolve(__dirname, '../../../03-test/us-01-join-session/screenshots');

// Name format: PascalCase word + PascalCase word + digits  (e.g. SilentPanda42)
const NAME_RE = /^[A-Z][a-z]+[A-Z][a-z]+\d+$/;

test.describe('US-01 — Join Session Anonymously', () => {
  let sessionCode;

  // Create a fresh session once before all tests in this suite
  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/sessions', {
      data: { name: 'Playwright E2E Session' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    sessionCode = body.code;
    expect(typeof sessionCode).toBe('string');
    expect(sessionCode.length).toBe(6);
  });

  // ── AC1 · AC2 · AC3 · AC5 · AC6 ──────────────────────────────────────────
  test('AC1+AC2+AC3+AC5+AC6 — join via link shows generated name, avatar and Enter Room', async ({ page }) => {
    // AC1: join via shareable link
    await page.goto(`/join?code=${sessionCode}`);

    // AC5 + AC6: page renders without any login prompt
    await expect(page.locator('form[action*="login"]')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    // AC2: name is auto-generated and displayed (not the placeholder)
    const usernameEl = page.locator('#username');
    await expect(usernameEl).not.toHaveText('loading...', { timeout: 5000 });
    const name = await usernameEl.textContent();
    expect(name).toMatch(NAME_RE);

    // AC3: avatar element has a src pointing to the identicon endpoint
    const avatarSrc = await page.locator('#avatar').getAttribute('src');
    expect(avatarSrc).toMatch(/^\/api\/avatar\//);

    // AC5: Enter Room button is visible and enabled before clicking
    const enterBtn = page.locator('#enter-btn');
    await expect(enterBtn).toBeVisible();
    await expect(enterBtn).toBeEnabled();

    // No error shown
    await expect(page.locator('#error')).toHaveText('');

    await page.screenshot({
      path: path.join(SCREENSHOTS, '01-ac1-ac2-ac3-ac5-ac6-join-preview.png'),
      fullPage: true,
    });
  });

  // ── AC4 ───────────────────────────────────────────────────────────────────
  test('AC4 — two participants joining the same session get different names', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await Promise.all([
      page1.goto(`/join?code=${sessionCode}`),
      page2.goto(`/join?code=${sessionCode}`),
    ]);

    await Promise.all([
      expect(page1.locator('#username')).not.toHaveText('loading...', { timeout: 5000 }),
      expect(page2.locator('#username')).not.toHaveText('loading...', { timeout: 5000 }),
    ]);

    const name1 = await page1.locator('#username').textContent();
    const name2 = await page2.locator('#username').textContent();

    expect(name1).toMatch(NAME_RE);
    expect(name2).toMatch(NAME_RE);
    expect(name1).not.toBe(name2);

    await page1.screenshot({ path: path.join(SCREENSHOTS, '02-ac4-participant-1.png'), fullPage: true });
    await page2.screenshot({ path: path.join(SCREENSHOTS, '02-ac4-participant-2.png'), fullPage: true });

    await ctx1.close();
    await ctx2.close();
  });

  // ── AC7 ───────────────────────────────────────────────────────────────────
  test('AC7 — reconnecting within the same browser session restores the same identity', async ({ page }) => {
    // First visit: get assigned an identity
    await page.goto(`/join?code=${sessionCode}`);
    await expect(page.locator('#username')).not.toHaveText('loading...', { timeout: 5000 });
    const originalName = await page.locator('#username').textContent();
    const originalAvatarSrc = await page.locator('#avatar').getAttribute('src');

    await page.screenshot({ path: path.join(SCREENSHOTS, '03-ac7-first-visit.png'), fullPage: true });

    // Navigate away (simulates disconnect / tab re-open within same session)
    await page.goto('about:blank');

    // Return to the same join URL
    await page.goto(`/join?code=${sessionCode}`);
    await expect(page.locator('#username')).not.toHaveText('loading...', { timeout: 5000 });

    const restoredName = await page.locator('#username').textContent();
    const restoredAvatarSrc = await page.locator('#avatar').getAttribute('src');

    expect(restoredName).toBe(originalName);
    expect(restoredAvatarSrc).toBe(originalAvatarSrc);

    await page.screenshot({ path: path.join(SCREENSHOTS, '03-ac7-reconnect-restored.png'), fullPage: true });
  });

  // ── AC6 extra · no login required (negative) ──────────────────────────────
  test('AC6 — join works with no cookies, no auth headers', async ({ browser }) => {
    // Fresh context = no cookies, no storage
    const freshCtx = await browser.newContext({ storageState: undefined });
    const page = await freshCtx.newPage();

    await page.goto(`/join?code=${sessionCode}`);
    await expect(page.locator('#username')).not.toHaveText('loading...', { timeout: 5000 });

    const name = await page.locator('#username').textContent();
    expect(name).toMatch(NAME_RE);

    await page.screenshot({ path: path.join(SCREENSHOTS, '04-ac6-no-auth-join.png'), fullPage: true });
    await freshCtx.close();
  });

  // ── AC1 · invalid code shows error, no crash ──────────────────────────────
  test('AC1 — invalid session code shows error message and does not crash', async ({ page }) => {
    await page.goto('/join?code=ZZZZZZ');

    // Wait briefly; name should NOT load (stays loading... or shows error)
    await page.waitForTimeout(2000);

    const errorText = await page.locator('#error').textContent();
    expect(errorText.length).toBeGreaterThan(0);

    // Page must still be functional (no blank white screen)
    await expect(page.locator('h1')).toBeVisible();

    await page.screenshot({ path: path.join(SCREENSHOTS, '05-ac1-invalid-code-error.png'), fullPage: true });
  });
});
