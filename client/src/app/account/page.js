'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import AccountActivityPanels from './_components/AccountActivityPanels';
import AccountProfileDashboard from './_components/AccountProfileDashboard';
import AccountSecurityPanels from './_components/AccountSecurityPanels';
import { useToast } from '../../components/ToastProvider';
import { apiGetCached, apiPost, apiPut, clearApiGetCache, clearAuth, updateStoredUser } from '../../utils/api';
import { useAuthUser, useHydrated } from '../../utils/client-auth';
import {
  cleanNickname,
  getUserId,
  normalizeActivity,
  normalizeList,
  safeText,
} from './_lib/accountUtils';

export default function AccountPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const user = useAuthUser();
  const { showToast } = useToast();
  const [draftNickname, setDraftNickname] = useState(null);
  const [draftBio, setDraftBio] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [recoveryForm, setRecoveryForm] = useState({ currentPassword: '' });
  const [recoverySaving, setRecoverySaving] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [deactivateForm, setDeactivateForm] = useState({ currentPassword: '', confirmText: '' });
  const [deactivateSaving, setDeactivateSaving] = useState(false);
  const [deactivateMessage, setDeactivateMessage] = useState('');
  const [activity, setActivity] = useState(() => normalizeActivity(null));
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');

  const currentNickname = cleanNickname(user?.nickname);
  const nicknameValue = draftNickname === null ? currentNickname : draftNickname;
  const nextNickname = cleanNickname(nicknameValue);
  const currentBio = String(user?.profileBio || '');
  const bioValue = draftBio === null ? currentBio : draftBio;
  const nextBio = String(bioValue || '').trim();
  const isDirty = nextNickname !== currentNickname || nextBio !== currentBio;
  const userId = getUserId(user);

  const loadActivity = useCallback(async (options = {}) => {
    if (!userId) {
      setActivity(normalizeActivity(null));
      setActivityError('');
      setActivityLoading(false);
      return;
    }

    setActivityLoading(true);
    setActivityError('');
    try {
      const data = await apiGetCached(`/public/users/${userId}`, {
        ttlMs: 30000,
        timeoutMs: 15000,
        storage: 'session',
        force: Boolean(options.force),
      });
      setActivity(normalizeActivity(data));
    } catch (err) {
      const nextMessage = err?.message || '내 활동 정보를 불러오지 못했습니다.';
      setActivity(normalizeActivity(null));
      setActivityError(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
    } finally {
      setActivityLoading(false);
    }
  }, [showToast, userId]);

  useEffect(() => {
    let cancelled = false;
    if (!hydrated || !userId) {
      void Promise.resolve().then(() => {
        if (!cancelled) setActivity(normalizeActivity(null));
      });
      return () => {
        cancelled = true;
      };
    }
    void Promise.resolve().then(() => {
      if (!cancelled) void loadActivity();
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, loadActivity, setActivity, userId]);

  const publicProfileHref = userId ? `/users/${userId}` : '';
  const activityUser = activity.user || user;
  const stats = activityUser?.statistics || {};
  const totalGames = Number(stats.totalGames || 0);
  const winRate = totalGames > 0 ? Number(stats.totalWins || 0) / totalGames : 0;
  const summary = activity.summary || {};
  const badges = useMemo(() => normalizeList(activityUser?.badges).filter((badge) => safeText(badge?.name)), [activityUser?.badges]);

  const saveProfile = async (event) => {
    event.preventDefault();
    if (saving || !user) return;

    if (nextNickname.length < 2 || nextNickname.length > 20) {
      const nextMessage = '닉네임은 2~20자로 입력해주세요.';
      setMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    if (nextBio.length > 240) {
      const nextMessage = '소개는 240자 이내로 입력해주세요.';
      setMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const res = await apiPut('/user/profile', { nickname: nextNickname, profileBio: nextBio });
      const nextUser = res?.user || { ...user, nickname: nextNickname, profileBio: nextBio };
      updateStoredUser((current) => ({ ...(current || {}), ...nextUser }));
      setDraftNickname(nextUser.nickname || nextNickname);
      setDraftBio(nextUser.profileBio || '');
      const nextUserId = getUserId(nextUser) || userId;
      if (nextUserId) clearApiGetCache(`/public/users/${nextUserId}`);
      clearApiGetCache('/public/home-hub');
      clearApiGetCache('/public/search');
      const nextMessage = res?.message || '프로필을 저장했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      void loadActivity({ force: true });
    } catch (err) {
      const nextMessage = err?.message || '프로필 저장에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (passwordSaving || !user) return;

    const currentPassword = String(passwordForm.currentPassword || '');
    const newPassword = String(passwordForm.newPassword || '');
    const confirmPassword = String(passwordForm.confirmPassword || '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      const nextMessage = '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.';
      setPasswordMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 72) {
      const nextMessage = '새 비밀번호는 6~72자로 입력해주세요.';
      setPasswordMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }
    if (newPassword !== confirmPassword) {
      const nextMessage = '새 비밀번호 확인이 일치하지 않습니다.';
      setPasswordMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }
    if (currentPassword === newPassword) {
      const nextMessage = '새 비밀번호는 현재 비밀번호와 달라야 합니다.';
      setPasswordMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    setPasswordSaving(true);
    setPasswordMessage('');
    try {
      const res = await apiPut('/user/password', { currentPassword, newPassword });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      const nextMessage = res?.message || '비밀번호를 변경했습니다.';
      setPasswordMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
    } catch (err) {
      const nextMessage = err?.message || '비밀번호 변경에 실패했습니다.';
      setPasswordMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setPasswordSaving(false);
    }
  };

  const issueRecoveryCode = async (event) => {
    event.preventDefault();
    if (recoverySaving || !user) return;

    const currentPassword = String(recoveryForm.currentPassword || '');
    if (!currentPassword) {
      const nextMessage = '현재 비밀번호를 입력해주세요.';
      setRecoveryMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    setRecoverySaving(true);
    setRecoveryMessage('');
    setRecoveryCode('');
    try {
      const res = await apiPost('/user/recovery-code', { currentPassword }, { timeoutMs: 20000 });
      const nextUser = res?.user || {};
      setRecoveryForm({ currentPassword: '' });
      setRecoveryCode(res?.recoveryCode || '');
      updateStoredUser((current) => ({ ...(current || {}), ...nextUser }));
      const nextMessage = res?.message || '복구 코드를 발급했습니다.';
      setRecoveryMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
    } catch (err) {
      const nextMessage = err?.message || '복구 코드 발급에 실패했습니다.';
      setRecoveryMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setRecoverySaving(false);
    }
  };

  const deactivateAccount = async (event) => {
    event.preventDefault();
    if (deactivateSaving || !user) return;

    const currentPassword = String(deactivateForm.currentPassword || '');
    const confirmText = String(deactivateForm.confirmText || '').trim();

    if (!currentPassword) {
      const nextMessage = '현재 비밀번호를 입력해주세요.';
      setDeactivateMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }
    if (confirmText !== '탈퇴') {
      const nextMessage = '확인 문구에 탈퇴를 입력해주세요.';
      setDeactivateMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    const ok = window.confirm('계정을 탈퇴 처리하면 다시 로그인할 수 없습니다. 계속하시겠습니까?');
    if (!ok) return;

    setDeactivateSaving(true);
    setDeactivateMessage('');
    try {
      const res = await apiPost('/user/deactivate', { currentPassword, confirmText }, { timeoutMs: 20000 });
      const nextMessage = res?.message || '계정이 탈퇴 처리되었습니다.';
      setDeactivateMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      clearAuth();
      router.replace('/');
    } catch (err) {
      const nextMessage = err?.message || '계정 탈퇴 처리에 실패했습니다.';
      setDeactivateMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setDeactivateSaving(false);
    }
  };

  return (
    <main className="account-page-shell">
      <SiteHeader />
      <section className="account-page">
        <div className="account-head">
          <div>
            <p className="account-kicker">Account</p>
            <h1>계정 설정</h1>
          </div>
          {hydrated && publicProfileHref ? <Link href={publicProfileHref}>내 공개 프로필</Link> : null}
        </div>

        {!hydrated ? (
          <div className="account-panel">계정 정보를 확인하는 중입니다.</div>
        ) : !user ? (
          <div className="account-panel account-login-panel">
            <p>로그인하면 닉네임을 설정할 수 있습니다.</p>
            <Link href="/login">로그인</Link>
          </div>
        ) : (
          <>
            <AccountProfileDashboard
              activityError={activityError}
              activityLoading={activityLoading}
              activityUser={activityUser}
              badges={badges}
              bioValue={bioValue}
              isDirty={isDirty}
              message={message}
              nextBio={nextBio}
              nicknameValue={nicknameValue}
              publicProfileHref={publicProfileHref}
              saveProfile={saveProfile}
              saving={saving}
              setDraftBio={setDraftBio}
              setDraftNickname={setDraftNickname}
              summary={summary}
              totalGames={totalGames}
              user={user}
              winRate={winRate}
            />

            <AccountSecurityPanels
              deactivateAccount={deactivateAccount}
              deactivateForm={deactivateForm}
              deactivateMessage={deactivateMessage}
              deactivateSaving={deactivateSaving}
              message={message}
              passwordForm={passwordForm}
              passwordMessage={passwordMessage}
              passwordSaving={passwordSaving}
              recoveryCode={recoveryCode}
              recoveryForm={recoveryForm}
              recoveryMessage={recoveryMessage}
              recoverySaving={recoverySaving}
              savePassword={savePassword}
              setDeactivateForm={setDeactivateForm}
              setPasswordForm={setPasswordForm}
              setRecoveryForm={setRecoveryForm}
              user={user}
            />

            <AccountActivityPanels
              activity={activity}
              summary={summary}
            />
          </>
        )}
      </section>
    </main>
  );
}
