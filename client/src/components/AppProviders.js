'use client';

import ClientErrorBoundary from './ClientErrorBoundary';
import { ToastProvider } from './ToastProvider';

export default function AppProviders({ children }) {
  return (
    <ToastProvider>
      <ClientErrorBoundary>{children}</ClientErrorBoundary>
    </ToastProvider>
  );
}
