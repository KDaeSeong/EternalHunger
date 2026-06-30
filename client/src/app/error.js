'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('App route error', error);
  }, [error]);

  return (
    <main className="app-error-boundary">
      <section className="app-error-card">
        <p className="app-error-eyebrow">ETERNAL HUNGER</p>
        <h1>화면을 불러오지 못했습니다</h1>
        <p>
          페이지를 여는 중 클라이언트 오류가 발생했습니다. 다시 시도하거나 메인 화면으로 돌아가주세요.
        </p>
        {error?.message ? (
          <pre className="app-error-detail">{String(error.message)}</pre>
        ) : null}
        <div className="app-error-actions">
          <button type="button" onClick={() => reset()}>
            다시 시도
          </button>
          <Link href="/">메인으로</Link>
        </div>
      </section>
    </main>
  );
}
