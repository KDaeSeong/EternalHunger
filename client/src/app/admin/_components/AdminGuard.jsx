'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useIsAdminSnapshot } from '../../../utils/client-auth';

export default function AdminGuard({ children }) {
  const router = useRouter();
  const ready = useIsAdminSnapshot();

  useEffect(() => {
    if (!ready) {
      alert('접근 권한이 없습니다.');
      router.push('/');
    }
  }, [ready, router]);

  if (!ready) return <div style={{ padding: 24 }}>접근 확인 중...</div>;
  return children;
}
