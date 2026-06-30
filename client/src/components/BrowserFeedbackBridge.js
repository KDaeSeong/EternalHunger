'use client';

import { useEffect } from 'react';
import { useToast } from './ToastProvider';

function toneFromMessage(message) {
  const text = String(message || '').toLowerCase();
  if (text.includes('실패') || text.includes('오류') || text.includes('error') || text.includes('failed')) return 'danger';
  if (text.includes('필요') || text.includes('확인') || text.includes('warning')) return 'warning';
  if (text.includes('완료') || text.includes('성공') || text.includes('saved')) return 'success';
  return 'info';
}

export default function BrowserFeedbackBridge() {
  const { showToast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const originalAlert = window.alert;
    window.alert = (message) => {
      const text = String(message ?? '').trim();
      if (!text) return;
      showToast({ tone: toneFromMessage(text), message: text, durationMs: 4200 });
    };
    return () => {
      window.alert = originalAlert;
    };
  }, [showToast]);

  return null;
}
