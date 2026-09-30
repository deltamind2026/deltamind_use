'use client';
import React, { useEffect, useState } from 'react';
import { API_URL } from '../lib/useChartData';

type AiMetric = {
  name: string;
  value: string;
  explanation: string;
  evaluation: string;
  evaluationExplanation: string;
};

type AiExplanation = {
  metrics: AiMetric[];
  current?: string;
  future?: string;
  risks?: string;
  fallbackText?: string;
};

function parseAiExplanation(raw?: string): AiExplanation {
  if (!raw || typeof raw !== 'string') {
    return { metrics: [], fallbackText: 'AI analysis is unavailable right now.' };
  }

  const metricRegex = /\{"metric":\s*\[(.*?)\]\}/g;
  const sectionRegex = /\{"(current|future|risks)":\s*(.+?)\}/g;

  const cleanToken = (token: string) =>
    token.trim().replace(/^['"]|['"]$/g, '').replace(/\\"/g, '"');

  const splitMetricParts = (content: string) => {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i += 1) {
      const char = content[i];
      const prev = i > 0 ? content[i - 1] : '';

      if (char === '"' && prev !== '\\') {
        inQuotes = !inQuotes;
      }

      if (char === ',' && !inQuotes) {
        parts.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    if (current) parts.push(current);
    return parts.map(cleanToken);
  };

  const metrics: AiMetric[] = [];
  let metricMatch: RegExpExecArray | null;

  while ((metricMatch = metricRegex.exec(raw)) !== null) {
    const [name, value, explanation, evaluation, evaluationExplanation] = splitMetricParts(metricMatch[1]);
    if (!name) continue;

    metrics.push({
      name,
      value: value || '',
      explanation: explanation || '',
      evaluation: evaluation || 'N/A',
      evaluationExplanation: evaluationExplanation || '',
    });
  }

  const sections: Partial<Record<'current' | 'future' | 'risks', string>> = {};
  let sectionMatch: RegExpExecArray | null;

  while ((sectionMatch = sectionRegex.exec(raw)) !== null) {
    sections[sectionMatch[1] as 'current' | 'future' | 'risks'] = cleanToken(sectionMatch[2]);
  }

  if (!metrics.length && !sections.current && !sections.future && !sections.risks) {
    return { metrics: [], fallbackText: raw };
  }

  return { metrics, current: sections.current, future: sections.future, risks: sections.risks };
}

const EVAL_STYLE: Record<string, { border: string; background: string; accent: string }> = {
  positive: { border: '#22c55e', background: 'rgba(34,197,94,0.08)', accent: '#86efac' },
  neutral: { border: '#eab308', background: 'rgba(234,179,8,0.08)', accent: '#fde047' },
  negative: { border: '#ef4444', background: 'rgba(239,68,68,0.08)', accent: '#fca5a5' },
};
const EVAL_FALLBACK = { border: '#475569', background: 'rgba(71,85,105,0.18)', accent: '#cbd5e1' };

export default function AiInsight({ symbol, tf, candles, marketState }: { symbol: string; tf: string; candles: any[]; marketState: any }) {
  const [state, setState] = useState<{ loading: boolean; data: AiExplanation | null }>({ loading: true, data: null });

  useEffect(() => {
    if (!candles.length) return;
    let cancelled = false;
    // Aborting on cleanup means a superseded run (a quick symbol/timeframe switch,
    // or React Strict Mode's mount-unmount-mount in dev) never reaches /ai/explain.
    const ctrl = new AbortController();
    const { signal } = ctrl;
    setState({ loading: true, data: null });
    (async () => {
      try {
        const [multi, options] = await Promise.all([
          fetch(`${API_URL}/market/multi?symbol=${encodeURIComponent(symbol)}`, { signal }).then(r => r.json()).catch(() => ({})),
          fetch(`${API_URL}/options/chain?symbol=${encodeURIComponent(symbol)}`, { signal }).then(r => r.json()).catch(() => ({})),
        ]);
        if (cancelled) return;
        const ai = await fetch(`${API_URL}/ai/explain`, {
          signal,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset: symbol,
            timeframe: tf,
            candles,
            market_state: marketState,
            multi_timeframe: multi.combined || {},
            options: options.rows || [],
          }),
        }).then(r => r.json());
        if (!cancelled) setState({ loading: false, data: parseAiExplanation(ai?.explanation) });
      } catch (err) {
        if (cancelled) return;
        console.error('AI error:', err);
        if (!cancelled) setState({ loading: false, data: { metrics: [], fallbackText: 'AI analysis is unavailable right now.' } });
      }
    })();
    return () => { cancelled = true; ctrl.abort(); };
  }, [symbol, tf, candles, marketState]);

  const d = state.data;

  return (
    <div style={{ background: '#0b1226', border: '1px solid #1f2a44', borderRadius: 16, padding: 16, color: '#e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>DeltaMind's take on {symbol}</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>AI summary · not financial advice</div>
      </div>

      {state.loading && <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 14 }}>Reading the chart…</div>}

      {d && (d.current || d.future || d.risks) && (
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {d.current && <Section title="What's happening" text={d.current} />}
          {d.future && <Section title="What could come next" text={d.future} />}
          {d.risks && <Section title="What to watch out for" text={d.risks} />}
        </div>
      )}

      {d && d.metrics.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>
            See the {d.metrics.length} signals behind this
          </summary>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {d.metrics.map((m, i) => {
              const ev = m.evaluation.toLowerCase();
              const c = EVAL_STYLE[ev] || EVAL_FALLBACK;
              return (
                <div key={`${m.name}-${i}`} style={{ border: `1px solid ${c.border}55`, background: c.background, borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: c.accent, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800 }}>{ev}</div>
                  <div style={{ marginTop: 4, fontWeight: 700, color: '#f8fafc' }}>{m.name}</div>
                  {m.value && <div style={{ marginTop: 2, fontSize: 16 }}>{m.value}</div>}
                  {m.explanation && <div style={{ marginTop: 6, fontSize: 13, color: '#cbd5e1', lineHeight: 1.45 }}>{m.explanation}</div>}
                  {m.evaluationExplanation && <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8', lineHeight: 1.45 }}>{m.evaluationExplanation}</div>}
                </div>
              );
            })}
          </div>
        </details>
      )}

      {d && !d.metrics.length && !d.current && !d.future && !d.risks && (
        <div style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 14, color: '#cbd5e1' }}>{d.fallbackText}</div>
      )}
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      <div style={{ marginTop: 4, fontSize: 14, lineHeight: 1.55, color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  );
}
