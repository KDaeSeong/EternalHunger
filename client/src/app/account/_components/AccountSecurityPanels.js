import Link from 'next/link';
import { formatDate } from '../_lib/accountUtils';

export default function AccountSecurityPanels(props) {
  const {
    deactivateAccount,
    deactivateForm,
    deactivateMessage,
    deactivateSaving,
    message,
    passwordForm,
    passwordMessage,
    passwordSaving,
    recoveryCode,
    recoveryForm,
    recoveryMessage,
    recoverySaving,
    savePassword,
    setDeactivateForm,
    setPasswordForm,
    setRecoveryForm,
    user,
  } = props;

  return (
    <>
            <form className="account-panel account-security-panel" onSubmit={savePassword}>
              <div className="account-panel-title">
                <h2>보안</h2>
              </div>
              <div className="account-security-grid">
                <label className="account-field">
                  <span>현재 비밀번호</span>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                    autoComplete="current-password"
                    disabled={passwordSaving}
                  />
                </label>
                <label className="account-field">
                  <span>새 비밀번호</span>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                    autoComplete="new-password"
                    minLength={6}
                    maxLength={72}
                    disabled={passwordSaving}
                  />
                </label>
                <label className="account-field">
                  <span>새 비밀번호 확인</span>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                    autoComplete="new-password"
                    minLength={6}
                    maxLength={72}
                    disabled={passwordSaving}
                  />
                </label>
              </div>
              {passwordMessage ? <div className="account-message">{passwordMessage}</div> : null}
              <div className="account-actions">
                <button type="submit" disabled={passwordSaving}>
                  {passwordSaving ? '변경 중...' : '비밀번호 변경'}
                </button>
              </div>
            </form>

            <form className="account-panel account-recovery-panel" onSubmit={issueRecoveryCode}>
              <div className="account-panel-title">
                <h2>비밀번호 복구 코드</h2>
                <Link href="/reset-password">재설정 화면</Link>
              </div>
              <p>
                이메일 없이 비밀번호를 재설정할 때 쓰는 1회용 코드입니다. 새 코드를 발급하면 이전 코드는 무효화됩니다.
              </p>
              {user?.recoveryCodeCreatedAt ? (
                <div className="account-recovery-status">
                  활성 복구 코드 발급일: {formatDate(user.recoveryCodeCreatedAt) || '날짜 없음'}
                </div>
              ) : (
                <div className="account-recovery-status">아직 활성 복구 코드가 없습니다.</div>
              )}
              <div className="account-security-grid compact">
                <label className="account-field">
                  <span>현재 비밀번호</span>
                  <input
                    type="password"
                    value={recoveryForm.currentPassword}
                    onChange={(event) => setRecoveryForm({ currentPassword: event.target.value })}
                    autoComplete="current-password"
                    disabled={recoverySaving}
                  />
                </label>
              </div>
              {recoveryCode ? (
                <div className="account-recovery-code" aria-live="polite">
                  <span>새 복구 코드</span>
                  <strong>{recoveryCode}</strong>
                  <small>이 코드는 다시 표시되지 않습니다. 지금 안전한 곳에 보관해주세요.</small>
                </div>
              ) : null}
              {recoveryMessage ? <div className="account-message">{recoveryMessage}</div> : null}
              <div className="account-actions">
                <button type="submit" disabled={recoverySaving}>
                  {recoverySaving ? '발급 중...' : '복구 코드 발급'}
                </button>
              </div>
            </form>

            <form className="account-panel account-danger-panel" onSubmit={deactivateAccount}>
              <div className="account-panel-title">
                <h2>계정 탈퇴</h2>
              </div>
              <p>
                탈퇴하면 현재 계정으로 다시 로그인할 수 없습니다. 작성한 게시글과 기록은 서비스 흐름 보존을 위해
                남지만, 계정명과 프로필 정보는 탈퇴 계정으로 정리됩니다.
              </p>
              <div className="account-security-grid">
                <label className="account-field">
                  <span>현재 비밀번호</span>
                  <input
                    type="password"
                    value={deactivateForm.currentPassword}
                    onChange={(event) => setDeactivateForm({ ...deactivateForm, currentPassword: event.target.value })}
                    autoComplete="current-password"
                    disabled={deactivateSaving}
                  />
                </label>
                <label className="account-field">
                  <span>확인 문구</span>
                  <input
                    value={deactivateForm.confirmText}
                    onChange={(event) => setDeactivateForm({ ...deactivateForm, confirmText: event.target.value })}
                    placeholder="탈퇴"
                    disabled={deactivateSaving}
                  />
                </label>
              </div>
              {deactivateMessage ? <div className="account-message danger">{deactivateMessage}</div> : null}
              <div className="account-actions">
                <button type="submit" className="danger" disabled={deactivateSaving}>
                  {deactivateSaving ? '처리 중...' : '계정 탈퇴'}
                </button>
              </div>
            </form>

    </>
  );
}
