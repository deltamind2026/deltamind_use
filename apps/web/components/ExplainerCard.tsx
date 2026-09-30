'use client';
import React from 'react';

export type Explanation = {
  kind: 'day' | 'drawing' | 'period';
  title: string;
  body: string;
  subtitle?: string;
  loading?: boolean;
  aiText?: string;
  aiLoading?: boolean;
};

const ACCENT: Record<Explanation['kind'], string> = { day: '#60a5fa', drawing: '#f472b6', period: '#22d3ee' };
const LABEL: Record<Explanation['kind'], string> = { day: 'Selected candle', drawing: 'Your drawing', period: 'Selected period' };

export default function ExplainerCard({ e, onClose }: { e: Explanation; onClose: () => void }) {
  const accent = ACCENT[e.kind];
  return (
    <div style={{ background: '#0b1226', border: `1px solid ${accent}55`, borderLeft: `3px solid ${accent}`, borderRadius: 12, padding: '14px 16px', color: '#e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: accent }}>{LABEL[e.kind]}</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{e.title}</div>
          {e.subtitle && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{e.subtitle}</div>}
        </div>
        <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>
      <Rich text={e.body} />
      {(e.aiLoading || e.aiText) && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #1f2a44' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#22d3ee', letterSpacing: 0.6, textTransform: 'uppercase' }}>DeltaMind AI</div>
          {e.aiLoading ? <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 14 }}>Thinking…</div> : <Rich text={e.aiText || ''} />}
        </div>
      )}
    </div>
  );
}

/** Renders paragraphs and **bold** spans. That's all the formatting the explanations use. */
export function Rich({ text }: { text: string }) {
  return (
    <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, color: '#cbd5e1' }}>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} style={{ margin: i ? '8px 0 0' : 0, whiteSpace: 'pre-wrap' }}>
          {para.split(/(\*\*[^*]+\*\*)/).map((chunk, j) =>
            chunk.startsWith('**') && chunk.endsWith('**')
              ? <strong key={j} style={{ color: '#f1f5f9' }}>{chunk.slice(2, -2)}</strong>
              : <React.Fragment key={j}>{chunk}</React.Fragment>
          )}
        </p>
      ))}
    </div>
  );
}
