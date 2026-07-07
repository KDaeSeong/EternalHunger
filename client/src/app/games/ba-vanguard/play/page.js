'use client';

import { Suspense } from 'react';
import BaVanguardPlayContent from '../_components/BaVanguardPlayContent';

export default function BaVanguardPlayPage() {
  return (
    <Suspense fallback={(
      <main className="games-page-shell">
        <section className="games-page">
          <div className="games-empty">BA Vanguard 플레이테스트를 불러오는 중입니다.</div>
        </section>
      </main>
    )}>
      <BaVanguardPlayContent />
    </Suspense>
  );
}
