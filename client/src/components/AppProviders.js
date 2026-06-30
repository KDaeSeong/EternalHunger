'use client';

import ClientErrorBoundary from './ClientErrorBoundary';
import { ToastProvider } from './ToastProvider';
import BrowserFeedbackBridge from './BrowserFeedbackBridge';

export default function AppProviders({ children }) {
  return (
    <ToastProvider>
      <BrowserFeedbackBridge />
      <ClientErrorBoundary>{children}</ClientErrorBoundary>
    </ToastProvider>
  );
}
