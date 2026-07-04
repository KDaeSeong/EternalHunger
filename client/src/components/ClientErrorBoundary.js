'use client';

import React from 'react';
import Link from 'next/link';

export default class ClientErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Client render error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="app-error-boundary">
        <section className="app-error-card">
          <p className="app-error-eyebrow">케이의 게임개발소</p>
          <h1>화면을 불러오지 못했습니다.</h1>
          <p>
            클라이언트 렌더링 중 문제가 발생했습니다. 잠시 후 다시 시도하거나 메인 화면으로
            돌아가 주세요.
          </p>
          <div className="app-error-actions">
            <button type="button" onClick={() => window.location.reload()}>
              새로고침
            </button>
            <Link href="/">메인으로</Link>
          </div>
        </section>
      </main>
    );
  }
}
