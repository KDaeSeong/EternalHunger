export function achievementProgressPercent(value) {
  return Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100);
}

export function createAchievementRequests({ preview, catalogVersion, getSession, isCurrentSession,
  read, post, onChange, onWallet, onClaim }) {
  let revision = 0;
  let owner = null;
  let state = { ownerKey: null, payload: preview, loading: false, claiming: false, error: '' };
  let claimingTicket = null;
  const emit = (patch) => { state = { ...state, ...patch }; onChange(state); };
  const current = (ticket, session) => ticket === revision && isCurrentSession(session);
  const accept = (data) => {
    if (data?.catalogVersion !== catalogVersion || !Array.isArray(data.achievements)
      || !data.user?._id || !data.season || !data.unclaimedRewards) {
      throw new Error('업적 서버의 업데이트를 확인하는 중입니다. 잠시 후 새로고침해주세요.');
    }
    if (owner?.userId && String(data.user?._id || '') !== owner.userId) {
      throw new Error('계정이 변경되었습니다. 업적을 다시 불러와주세요.');
    }
    return data;
  };
  async function load() {
    if (!owner || claimingTicket !== null) return false;
    const ticket = ++revision;
    const session = getSession();
    emit({ loading: true, error: '' });
    try {
      const data = await read();
      if (!current(ticket, session)) return false;
      emit({ payload: accept(data) });
      return true;
    } catch (error) {
      if (current(ticket, session)) emit({ error: error?.message || '업적을 불러오지 못했습니다.' });
      return false;
    } finally {
      if (ticket === revision) {
        emit({ loading: false, ...(!isCurrentSession(session) ? { error: '로그인 상태가 바뀌었습니다. 새로고침 후 다시 확인해주세요.' } : {}) });
      }
    }
  }
  async function claim(selection) {
    if (!owner || claimingTicket !== null) return false;
    const ticket = ++revision;
    claimingTicket = ticket;
    const session = getSession();
    emit({ claiming: true, loading: false, error: '' });
    try {
      const data = await post(selection);
      if (!current(ticket, session)) return false;
      const payload = accept(data);
      emit({ payload });
      onWallet?.(payload.userProgress, session);
      onClaim?.(payload);
      return true;
    } catch (error) {
      if (current(ticket, session)) emit({ error: error?.message || '보상을 받지 못했습니다. 다시 시도해주세요.' });
      return false;
    } finally {
      if (claimingTicket === ticket) claimingTicket = null;
      if (ticket === revision) {
        emit({ claiming: false, ...(!isCurrentSession(session) ? { error: '로그인 상태가 바뀌었습니다. 새로고침 후 수령 내역을 확인해주세요.' } : {}) });
      }
    }
  }
  return {
    load, claim,
    reset(nextOwner) {
      revision += 1;
      owner = nextOwner;
      claimingTicket = null;
      emit({ ownerKey: owner?.key || null, payload: preview, loading: false, claiming: false, error: '' });
    },
    invalidate() { revision += 1; owner = null; claimingTicket = null; },
    getSnapshot() { return state; },
  };
}

export function filterAchievements(rows, { section = 'all', status = 'all', search = '' } = {}) {
  const query = String(search).trim().toLocaleLowerCase('ko-KR');
  return rows.filter((row) => (section === 'all' || row.section === section)
    && (status === 'all' || (status === 'progress' && !row.completed)
      || (status === 'claimable' && row.claimable) || (status === 'complete' && row.completed))
    && (!query || `${row.title} ${row.description} ${row.sectionLabel}`.toLocaleLowerCase('ko-KR').includes(query)));
}
