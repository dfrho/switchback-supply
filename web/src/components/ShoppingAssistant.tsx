import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { STARTER_QUESTIONS, modelLabel } from '../assistant/text';
import { formatPrice, getProduct } from '../data/catalog';
import { useShopper } from '../state/Shopper';
import ProductImage from './ProductImage';

/**
 * The AI shopping assistant ("Trail guide") panel.
 *
 * This component never talks to a model or to LaunchDarkly directly. It posts
 * the question and the current shopper to /api/assistant, where the server asks
 * LaunchDarkly AgentControl which model and prompt this shopper gets, then calls
 * Claude (server/assistant.ts). Keys stay on the server.
 */

interface Answer {
  reply: string;
  products: string[];
  source: 'claude' | 'off' | 'error';
  model?: string;
  variation?: string;
  feedbackToken?: string;
}

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  answer?: Answer;
  feedback?: 'positive' | 'negative';
}

const MAX_CHARS = 500;
const HISTORY_TURNS = 10;

const CONNECTION_ERROR = 'The trail guide could not be reached. Check your connection and try again.';

/**
 * Renders the small subset of Markdown the prompt asks for: paragraphs, "- "
 * lists, **bold**, and links. Only links into this store become links; anything
 * else is shown as plain text, so a reply can never send a shopper off-site.
 */
function renderInline(text: string, onNavigate: () => void): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const [whole, label, href, bold] = match;
    if (bold) {
      parts.push(<strong key={match.index}>{bold}</strong>);
    } else {
      const productId = /^\/products\/([a-z0-9-]+)$/.exec(href)?.[1];
      const internal = (productId && getProduct(productId)) || /^\/shop(\?category=[a-z-]+)?$/.test(href);
      parts.push(
        internal ? (
          <Link key={match.index} to={href} onClick={onNavigate}>
            {label}
          </Link>
        ) : (
          label
        ),
      );
    }
    last = match.index + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function RichText({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  return (
    <>
      {text.split(/\n{2,}/).map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((line) => /^\s*[-*] /.test(line))) {
          return (
            <ul key={i}>
              {lines.map((line, j) => (
                <li key={j}>{renderInline(line.replace(/^\s*[-*] /, ''), onNavigate)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{renderInline(block, onNavigate)}</p>;
      })}
    </>
  );
}

function ThumbIcon({ down = false }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={down ? { transform: 'scaleY(-1)' } : undefined}>
      <path
        d="M7 11v9H4v-9h3Zm0 0 4-7a2 2 0 0 1 2 2v4h5.2a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17 20H7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ShoppingAssistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { attributes } = useShopper();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    // Earlier turns give the model the conversation so far. Fallback notices are left out.
    const history = messages
      .filter((m) => m.role === 'user' || m.answer?.source === 'claude')
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { id: nextId.current++, role: 'user', content: text }]);
    setDraft('');
    setBusy(true);
    let answer: Answer;
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The shopper goes in the body, never the URL, so private attributes stay out of logs.
        body: JSON.stringify({ message: text, history, shopper: attributes }),
      });
      const data = (await res.json()) as Partial<Answer> & { error?: string };
      answer = data.reply ? (data as Answer) : { reply: data.error ?? CONNECTION_ERROR, products: [], source: 'error' };
    } catch {
      answer = { reply: CONNECTION_ERROR, products: [], source: 'error' };
    }
    setMessages((prev) => [...prev, { id: nextId.current++, role: 'assistant', content: answer.reply, answer }]);
    setBusy(false);
  }

  function sendFeedback(message: ChatMessage, kind: 'positive' | 'negative') {
    if (!message.answer?.feedbackToken || message.feedback) return;
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, feedback: kind } : m)));
    void fetch('/api/assistant-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedbackToken: message.answer.feedbackToken, kind, shopper: attributes }),
    }).catch(() => undefined);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(draft);
  }

  return (
    <>
      <div className={`scrim ${open ? 'scrim--open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`drawer assistant ${open ? 'drawer--open' : ''}`} aria-label="Trail guide" aria-hidden={!open} inert={!open}>
        <header className="drawer__head">
          <div>
            <p className="eyebrow">AI shopping assistant</p>
            <h2 className="drawer__title">Trail guide</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close trail guide">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="assistant__messages" ref={listRef} aria-live="polite">
          {messages.length === 0 && (
            <div className="assistant__intro">
              <p>Tell me about your trip and I will suggest gear from the Switchback catalog.</p>
              <div className="assistant__starters">
                {STARTER_QUESTIONS.map((q) => (
                  <button key={q} className="assistant__starter" onClick={() => void ask(q)} disabled={busy}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="bubble bubble--user">
                {m.content}
              </div>
            ) : (
              <div key={m.id} className={`bubble bubble--guide ${m.answer?.source !== 'claude' ? 'bubble--notice' : ''}`}>
                <RichText text={m.content} onNavigate={onClose} />
                {m.answer && m.answer.products.length > 0 && (
                  <ul className="assistant__products" aria-label="Recommended gear">
                    {m.answer.products.map((id) => {
                      const product = getProduct(id);
                      if (!product) return null;
                      return (
                        <li key={id}>
                          <Link to={`/products/${id}`} onClick={onClose} className="assistant__product">
                            <ProductImage product={product} />
                            <span className="assistant__product-name">{product.name}</span>
                            <span className="assistant__product-price">{formatPrice(product.price)}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="assistant__meta">
                  {m.answer?.source === 'claude' && m.answer.model ? (
                    <span>
                      {modelLabel(m.answer.model)} · variation <code>{m.answer.variation}</code>
                    </span>
                  ) : m.answer?.source === 'off' ? (
                    <span>Fallback reply: config off or unreachable</span>
                  ) : (
                    <span>Not answered</span>
                  )}
                  {m.answer?.feedbackToken &&
                    (m.feedback ? (
                      <span>Thanks for the feedback</span>
                    ) : (
                      <span className="assistant__feedback">
                        <button className="icon-btn" onClick={() => sendFeedback(m, 'positive')} aria-label="Helpful answer">
                          <ThumbIcon />
                        </button>
                        <button className="icon-btn" onClick={() => sendFeedback(m, 'negative')} aria-label="Not helpful">
                          <ThumbIcon down />
                        </button>
                      </span>
                    ))}
                </div>
              </div>
            ),
          )}

          {busy && <div className="bubble bubble--guide bubble--thinking">Checking the gear room...</div>}
        </div>

        <form className="assistant__form" onSubmit={onSubmit}>
          <label htmlFor="assistant-input" className="sr-only">
            Ask the trail guide
          </label>
          <textarea
            id="assistant-input"
            ref={inputRef}
            value={draft}
            maxLength={MAX_CHARS}
            rows={2}
            placeholder="Where are you headed?"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) onSubmit(e);
            }}
          />
          <button className="btn btn--primary" type="submit" disabled={busy || !draft.trim()}>
            Ask
          </button>
        </form>
      </aside>
    </>
  );
}
