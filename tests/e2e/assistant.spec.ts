import type { Page, Request } from '@playwright/test';
import { FLAG, expect, openReleaseConsole, releaseConsole, test, waitForStreaming } from './fixtures';

/**
 * The trail guide (AgentControl shopping assistant). The model call happens on the
 * server, so these tests stand in for /api/assistant with page.route and check what
 * the browser sends and shows. The server logic is unit tested in server/*.test.ts.
 * This works the same against the dev server and the production preview.
 */

const guide = (page: Page) => page.getByRole('complementary', { name: 'Trail guide' });

const ANSWER = {
  reply: 'For a cold night, pack the [Ember Down Puffer](/products/ember-puffer) and the [Bivouac 2 Tent](/products/bivouac-2).',
  products: ['ember-puffer', 'bivouac-2'],
  source: 'claude',
  model: 'claude-haiku-5-5',
  variation: 'control',
  feedbackToken: 'signed.token',
};

async function stubAssistant(page: Page, body: unknown = ANSWER, status = 200) {
  const requests: Request[] = [];
  await page.route('**/api/assistant', async (route) => {
    requests.push(route.request());
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return requests;
}

async function openGuide(page: Page) {
  await page.getByRole('button', { name: /Ask the trail guide/ }).click();
  await expect(guide(page)).toBeVisible();
}

test.describe('Trail guide (AI shopping assistant)', () => {
  test.beforeEach(async ({ ld, page }) => {
    await ld.reset({ [FLAG]: false });
    await page.goto('/');
    await waitForStreaming(page);
  });

  test('answers with linked product cards and names the model and variation @smoke', async ({ page }) => {
    await stubAssistant(page);
    await openGuide(page);
    await guide(page).getByRole('button', { name: /Two nights in Colorado/ }).click();
    const cards = guide(page).getByRole('list', { name: 'Recommended gear' });
    await expect(cards.getByRole('link')).toHaveCount(2);
    await expect(guide(page).getByText('variation control')).toBeVisible();

    await cards.getByRole('link', { name: /Ember Down Puffer/ }).click();
    await expect(page).toHaveURL(/\/products\/ember-puffer$/);
    await expect(guide(page)).toBeHidden();
  });

  test('sends the current shopper in the body, and nothing personal in the URL', async ({ page }) => {
    const requests = await stubAssistant(page);
    await openReleaseConsole(page);
    await releaseConsole(page).getByLabel('Persona').selectOption('employee');
    await openGuide(page);
    await guide(page).getByLabel('Ask the trail guide').fill('Warm jacket?');
    await guide(page).getByRole('button', { name: 'Ask' }).click();
    await expect(guide(page).getByText('variation control')).toBeVisible();

    const request = requests[0];
    expect(request.method()).toBe('POST');
    expect(request.url()).not.toContain('switchbacksupply.test');
    const body = request.postDataJSON();
    expect(body.message).toBe('Warm jacket?');
    expect(body.shopper).toMatchObject({ key: 'employee-001', email: 'merch@switchbacksupply.test' });
  });

  test('shows the fallback reply when the config is off', async ({ page }) => {
    await stubAssistant(page, { reply: 'The trail guide is off the clock right now.', products: [], source: 'off' }, 503);
    await openGuide(page);
    await guide(page).getByLabel('Ask the trail guide').fill('Anyone there?');
    await guide(page).getByRole('button', { name: 'Ask' }).click();
    await expect(guide(page).getByText('The trail guide is off the clock right now.')).toBeVisible();
    await expect(guide(page).getByText(/config off or unreachable/)).toBeVisible();
  });

  test('sends thumbs feedback with the answer token', async ({ page }) => {
    await stubAssistant(page);
    const feedback: Request[] = [];
    await page.route('**/api/assistant-feedback', async (route) => {
      feedback.push(route.request());
      await route.fulfill({ status: 204 });
    });
    await openGuide(page);
    await guide(page).getByRole('button', { name: /headlamp/ }).click();
    await guide(page).getByRole('button', { name: 'Helpful answer' }).click();
    await expect(guide(page).getByText('Thanks for the feedback')).toBeVisible();
    expect(feedback[0].postDataJSON()).toMatchObject({ feedbackToken: 'signed.token', kind: 'positive' });
  });
});
