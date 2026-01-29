'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAdmin } from '../../../utils/api';

export default function AdminGuard({ children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAdmin()) {
      alert('접근 권한이 없습니다.');
      router.push('/');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return <div style={{ padding: 24 }}>접근 확인 중...</div>;
  return children;
}
