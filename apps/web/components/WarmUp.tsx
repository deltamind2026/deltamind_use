'use client';
import { useEffect } from 'react';
import { API_URL } from '@/lib/useChartData';

// Pings the backend as soon as any page loads. Hosted services sleep when idle,
// and this starts them early so the AI summary is ready by the time it is needed.
export default function WarmUp() {
  useEffect(() => {
    fetch(`${API_URL}/ai/warmup`).catch(() => {});
  }, []);
  return null;
}
