'use client';
import React, { useEffect, useRef, useState } from 'react';
import { API_URL } from '../lib/useChartData';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
};

const MAX_HISTORY_SENT = 6;
const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 4000;

export default function AiChat({
  symbol,
  tf,
  snapshot,
}: {
  symbol: string;
  tf: string;
  snapshot: any;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [waking, setWaking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // Cancel any request still in flight when the chat unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const suggestions = [
    `What is ${symbol} doing right now?`,
    'What does RSI mean?',
    'What should a beginner watch for on this chart?',
  ];

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;

    const history = messages
      .filter(m => !m.error)
      .slice(-MAX_HISTORY_SENT)
      .map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setInput('');
    setSending(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let reply: string | null = null;
    try {
      // The AI service can be asleep on first use: the server answers 502/503 while
      // it starts, so retry a few times before giving up.
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const res = await fetch(`${API_URL}/ai/chat`, {
          signal: ctrl.signal,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset: symbol,
            timeframe: tf,
            message,
            history,
            snapshot,
          }),
        }).catch(() => null);
        if (ctrl.signal.aborted) return;
        if (res && res.ok) {
          const data = await res.json();
          if (typeof data?.reply === 'string' && data.reply.trim()) reply = data.reply.trim();
          break;
        }
        // A 4xx means the request itself was rejected, so retrying will not help.
        if (res && res.status >= 400 && res.status < 500) break;
        setWaking(true);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        if (ctrl.signal.aborted) return;
      }
    } catch {
      // aborted or unreadable response: fall through to the error message
    }

    if (ctrl.signal.aborted) return;
    setWaking(false);
    setSending(false);
    setMessages(prev => [
      ...prev,
      reply
        ? { role: 'assistant', content: reply }
        : { role: 'assistant', content: 'Sorry, I could not reach the AI just now. Please try again in a moment.', error: true },
    ]);
  }

  return (
    <div style={{ background: '#0b1226', border: '1px solid #1f2a44', borderRadius: 16, padding: 16, color: '#e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>Ask DeltaMind</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>Ask about {symbol} or any term on the chart · not financial advice</div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => { if (!sending) setMessages([]); }}
            disabled={sending}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 12, fontWeight: 700, cursor: sending ? 'default' : 'pointer' }}
          >
            Clear chat
          </button>
        )}
      </div>

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto', display: 'grid', gap: 10, alignContent: 'start' }}
      >
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {suggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                disabled={sending}
                style={{ padding: '8px 12px', borderRadius: 999, background: 'transparent', border: '1px solid #1f2a44', color: '#cbd5e1', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              justifySelf: m.role === 'user' ? 'end' : 'start',
              maxWidth: '85%',
              padding: '8px 12px',
              borderRadius: 12,
              fontSize: 14,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              background: m.role === 'user' ? '#155e75' : '#111b33',
              border: `1px solid ${m.error ? '#7f1d1d' : m.role === 'user' ? '#155e75' : '#1f2a44'}`,
              color: m.error ? '#fca5a5' : m.role === 'user' ? '#ecfeff' : '#cbd5e1',
            }}
          >
            {m.content}
          </div>
        ))}

        {sending && (
          <div style={{ justifySelf: 'start', color: '#94a3b8', fontSize: 14 }}>
            {waking ? 'Waking up the AI, this can take up to a minute…' : 'Thinking…'}
          </div>
        )}
      </div>

      <form
        onSubmit={e => { e.preventDefault(); send(input); }}
        style={{ marginTop: 12, display: 'flex', gap: 8 }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          maxLength={500}
          placeholder={`Ask a question about ${symbol}…`}
          aria-label="Ask DeltaMind a question"
          style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 10, background: '#060b1a', border: '1px solid #1f2a44', color: '#e5e7eb', fontSize: 14 }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            background: sending || !input.trim() ? '#1f2a44' : '#0891b2',
            border: 'none',
            color: '#f8fafc',
            fontWeight: 800,
            fontSize: 14,
            cursor: sending || !input.trim() ? 'default' : 'pointer',
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
