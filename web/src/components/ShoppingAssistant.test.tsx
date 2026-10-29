import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { modelLabel } from '../assistant/text';
import ShoppingAssistant from './ShoppingAssistant';

const shopper = { key: 'shopper-gold-001', anonymous: false, loyaltyTier: 'gold', state: 'TN', country: 'US', deviceType: 'desktop', betaTester: false };

vi.mock('../state/Shopper', () => ({ useShopper: () => ({ attributes: shopper }) }));

const fetchMock = vi.fn();

function reply(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

const claudeAnswer = {
  reply: 'For cold nights, take the [Ember Down Puffer](/products/ember-puffer). Also see [Moon Boots](/products/moon-boots).',
  products: ['ember-puffer'],
  source: 'claude',
  model: 'claude-haiku-5-5',
  variation: 'control',
  feedbackToken: 'signed-token',
};

const renderGuide = () =>
  render(
    <MemoryRouter>
      <ShoppingAssistant open onClose={() => undefined} />
    </MemoryRouter>,
  );

async function ask(question: string) {
  await userEvent.type(screen.getByLabelText('Ask the trail guide'), question);
  await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
}

describe('ShoppingAssistant', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends the question and the current shopper in the request body', async () => {
    fetchMock.mockReturnValueOnce(reply(claudeAnswer));
    renderGuide();
    await ask('Warm jacket for Colorado?');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/assistant');
    expect(JSON.parse(init.body)).toEqual({ message: 'Warm jacket for Colorado?', history: [], shopper });
  });

  it('shows the answer, a card for each real product, and which model and variation answered', async () => {
    fetchMock.mockReturnValueOnce(reply(claudeAnswer));
    renderGuide();
    await ask('Warm jacket?');
    expect(await screen.findByRole('link', { name: 'Ember Down Puffer' })).toHaveAttribute('href', '/products/ember-puffer');
    // An invented product is shown as plain text, never as a link.
    expect(screen.getByText(/Moon Boots/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Moon Boots' })).not.toBeInTheDocument();
    const cards = screen.getByRole('list', { name: 'Recommended gear' });
    expect(within(cards).getByText('Ember Down Puffer')).toBeInTheDocument();
    expect(screen.getByText(/Claude Haiku 5\.5/)).toHaveTextContent('variation control');
  });

  it('sends earlier turns as history with the next question', async () => {
    fetchMock.mockReturnValueOnce(reply(claudeAnswer)).mockReturnValueOnce(reply(claudeAnswer));
    renderGuide();
    await ask('Warm jacket?');
    await screen.findByText(/Claude Haiku/);
    await ask('And for rain?');
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.history).toEqual([
      { role: 'user', content: 'Warm jacket?' },
      { role: 'assistant', content: claudeAnswer.reply },
    ]);
  });

  it('records thumbs feedback once, with the signed token', async () => {
    fetchMock.mockReturnValueOnce(reply(claudeAnswer)).mockReturnValueOnce(Promise.resolve(new Response(null, { status: 204 })));
    renderGuide();
    await ask('Warm jacket?');
    await userEvent.click(await screen.findByRole('button', { name: 'Helpful answer' }));
    expect(fetchMock).toHaveBeenLastCalledWith('/api/assistant-feedback', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ feedbackToken: 'signed-token', kind: 'positive', shopper });
    expect(screen.getByText('Thanks for the feedback')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Not helpful' })).not.toBeInTheDocument();
  });

  it('shows the fallback reply, without feedback buttons, when the config is off', async () => {
    fetchMock.mockReturnValueOnce(reply({ reply: 'The trail guide is off the clock right now.', products: [], source: 'off' }, 503));
    renderGuide();
    await ask('Anyone there?');
    expect(await screen.findByText('The trail guide is off the clock right now.')).toBeInTheDocument();
    expect(screen.getByText(/config off or unreachable/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Helpful answer' })).not.toBeInTheDocument();
  });

  it('explains a network failure instead of breaking', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderGuide();
    await ask('Hello?');
    await waitFor(() => expect(screen.getByText(/could not be reached/)).toBeInTheDocument());
  });

  it('formats model names for people', () => {
    expect(modelLabel('claude-haiku-5-5')).toBe('Claude Haiku 5.5');
    expect(modelLabel('claude-sonnet-5')).toBe('Claude Sonnet 5');
    expect(modelLabel('gpt-x')).toBe('gpt-x');
  });
});
