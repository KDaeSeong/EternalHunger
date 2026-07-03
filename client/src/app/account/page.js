'use client';

import Link from 'next/link';
import { useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiPut, updateStoredUser } from '../../utils/api';
import { useAuthUser, useHydrated } from '../../utils/client-auth';

function cleanNickname(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function getDisplayName(user) {
  return cleanNickname(user?.nickname) || cleanNickname(user?.username) || '사용자';
}

export default function AccountPage() {
  const hydrated = useHydrated();
  const user = useAuthUser();
  const { showToast } = useToast();
  const [draftNickname, setDraftNickname] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const currentNickname = cleanNickname(user?.nickname);
  const nicknameValue = draftNickname === null ? currentNickname : draftNickname;
  const nextNickname = cleanNickname(nicknameValue);
  const isDirty = nextNickname !== currentNickname;

  const saveNickname = async (event) => {
    event.preventDefault();
    if (saving || !user) return;

    if (nextNickname.length < 2 || nextNickname.length > 20) {
      const nextMessage = '닉네임은 2~20자로 입력해주세요.';
      setMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const res = await apiPut('/user/nickname', { nickname: nextNickname });
      const nextUser = res?.user || { ...user, nickname: nextNickname };
      updateStoredUser((current) => ({ ...(current || {}), ...nextUser }));
      setDraftNickname(nextUser.nickname || nextNickname);
      const nextMessage = res?.message || '닉네임을 저장했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
    } catch (err) {
      const nextMessage = err?.message || '닉네임 저장에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="account-page-shell">
      <SiteHeader />
      <section className="account-page">
        <div className="account-head">
          <p className="account-kicker">Account</p>
          <h1>계정 설정</h1>
        </div>

        {!hydrated ? (
          <div className="account-panel">계정 정보를 확인하는 중입니다.</div>
        ) : !user ? (
          <div className="account-panel account-login-panel">
            <p>로그인하면 닉네임을 설정할 수 있습니다.</p>
            <Link href="/login">로그인</Link>
          </div>
        ) : (
          <form className="account-panel account-form" onSubmit={saveNickname}>
            <div className="account-summary">
              <span>현재 표시명</span>
              <strong>{getDisplayName(user)}</strong>
              <small>아이디: {user.username || '-'}</small>
            </div>

            <label className="account-field">
              <span>닉네임</span>
              <input
                value={nicknameValue}
                onChange={(event) => setDraftNickname(event.target.value)}
                placeholder="2~20자"
                maxLength={20}
                disabled={saving}
              />
            </label>

            {message ? <div className="account-message">{message}</div> : null}

            <div className="account-actions">
              <button type="submit" disabled={saving || !isDirty}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
