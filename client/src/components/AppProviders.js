'use client';

import ClientErrorBoundary from './ClientErrorBoundary';
import { ToastProvider } from './ToastProvider';
import BrowserFeedbackBridge from './BrowserFeedbackBridge';
import SessionSync from './SessionSync';
import GameBgmProvider from '../app/games/_components/GameBgmProvider';

export default function AppProviders({ children }) {
  return (
    <ToastProvider>
      <GameBgmProvider>
        <BrowserFeedbackBridge />
        <SessionSync />
        <ClientErrorBoundary>{children}</ClientErrorBoundary>
      </GameBgmProvider>
    </ToastProvider>
  );
}
