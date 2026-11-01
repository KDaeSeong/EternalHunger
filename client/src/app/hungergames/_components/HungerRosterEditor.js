'use client';

import Image from 'next/image';
import { useLayoutEffect, useRef } from 'react';
import HungerTraitFields from '../../../components/HungerTraitFields';
import { readCompressedPreviewImage } from '../../../utils/previewImage';
import { HUNGER_LIMITS } from '../_lib/hungerGameContract.js';
import { createHungerRosterImageRequests, parseHungerItemDraft } from '../_lib/hungerGameRosterEditor.js';
import styles from '../HungerGames.module.css';

export default function HungerRosterEditor({ roster, matchMode, onChange, onLoadAccount, busy, ready = false,
  rosterRevision = 0, itemDrafts, onItemDraftsChange, onNotice }) {
  const locked = !ready || Boolean(busy);
  const requests = useRef(null);
  if (!requests.current) requests.current = createHungerRosterImageRequests();
  useLayoutEffect(() => {
    requests.current.reset();
    if (locked) requests.current.deactivate(); else requests.current.activate();
    const current = requests.current;
    return () => current.deactivate();
  }, [rosterRevision, locked]);
  useLayoutEffect(() => { requests.current.retain(new Set(roster.map((actor) => actor.id))); }, [roster]);
  const drafts = itemDrafts?.revision === rosterRevision ? itemDrafts.byId : {};
  const update = (id, patch) => {
    if (locked) return;
    onChange((previous) => previous.map((actor) => actor.id === id ? { ...actor, ...patch } : actor));
  };
  const clearItemDraft = (id) => onItemDraftsChange?.((previous) => {
    if (previous?.revision !== rosterRevision || !Object.hasOwn(previous.byId, id)) return previous;
    const byId = { ...previous.byId }; delete byId[id];
    return { revision: rosterRevision, byId };
  });
  const editItems = (id, text, blur = false) => {
    if (locked) return;
    const parsed = parseHungerItemDraft(text);
    if (blur && !parsed.error) clearItemDraft(id);
    else onItemDraftsChange?.((previous) => ({ revision: rosterRevision,
      byId: { ...(previous?.revision === rosterRevision ? previous.byId : {}), [id]: { text, error: parsed.error } } }));
    if (!parsed.error) update(id, { items: parsed.items });
  };
  const upload = async (id, file) => {
    if (!file || locked) return;
    const token = requests.current.begin(id);
    if (!token) return;
    try {
      const previewImage = await readCompressedPreviewImage(file);
      if (!requests.current.isCurrent(id, token)) return;
      if (!previewImage) throw new Error('이미지 용량을 줄여 다시 선택해 주세요.');
      // Pass a functional update so a slow image decode cannot overwrite other edits.
      onChange((previous) => previous.map((actor) => actor.id === id ? { ...actor, previewImage } : actor));
    } catch (error) {
      if (requests.current.isCurrent(id, token)) onNotice(error.message);
    } finally {
      if (requests.current.isCurrent(id, token)) requests.current.invalidate(id);
    }
  };
  return (
    <section>
      <div className={styles.toolbar}>
        <div><h2>참가자 {roster.length}명</h2><p>이름·사진·출신 구역·팀과 사건에 적용할 특성을 설정합니다.</p></div>
        <div className={styles.actions}>
          <button type="button" disabled={locked || roster.length >= HUNGER_LIMITS.actors} onClick={() => {
            if (locked) return;
            onChange((previous) => previous.length >= HUNGER_LIMITS.actors ? previous : [...previous,
              { id: 'actor-' + crypto.randomUUID(), name: '새 참가자', previewImage: '', teamId: '', hungerTraits: [], items: [] }]);
          }}>참가자 추가</button>
          <button type="button" onClick={() => { if (!locked) onLoadAccount(); }} disabled={locked}>내 캐릭터 불러오기</button>
        </div>
      </div>
      <p className={styles.note}>출신 구역은 소속 표시이며 전투를 막지 않습니다. 팀은 경기 탭에서 팀전을 선택했을 때 적용됩니다. 특성을 비워 두면 일반 참가자로 진행하고, 번개 조종만으로 면역을 얻지는 않습니다.</p>
      <div className={styles.rosterGrid}>
        {roster.map((actor) => (
          <article className={styles.panel} key={actor.id}>
            <div className={styles.actorHead}>
              {actor.previewImage ? <Image unoptimized src={actor.previewImage} alt={actor.name} width={64} height={64} /> : <span className={styles.avatar}>{actor.name.slice(0, 1) || '?'}</span>}
              <label className={styles.field}>이름<input disabled={locked} maxLength={120} value={actor.name} onChange={(event) => update(actor.id, { name: event.target.value })} /></label>
              <button type="button" disabled={locked} aria-label={actor.name + ' 삭제'} onClick={() => {
                if (locked) return;
                requests.current.invalidate(actor.id); clearItemDraft(actor.id);
                onChange((previous) => previous.filter((row) => row.id !== actor.id));
              }}>삭제</button>
            </div>
            <div className={styles.fields}>
              <label className={styles.field}>출신 구역<input disabled={locked} value={actor.districtId || ''} maxLength={40} placeholder="예: 12구역" onChange={(event) => update(actor.id, { districtId: event.target.value })} /></label>
              <label className={styles.field}>팀<input value={actor.teamId || ''} disabled={locked || matchMode === 'solo'} maxLength={40} placeholder="팀전에서 적용 · 비워 두면 개인 팀" onChange={(event) => { if (matchMode !== 'solo') update(actor.id, { teamId: event.target.value }); }} /></label>
              <label className={styles.field}>시작 아이템<input disabled={locked} value={drafts[actor.id]?.text ?? actor.items.join(', ')}
                aria-invalid={Boolean(drafts[actor.id]?.error)} aria-describedby={drafts[actor.id]?.error ? `hg-items-${encodeURIComponent(actor.id)}` : undefined}
                placeholder="예: 칼, 식량" onChange={(event) => editItems(actor.id, event.target.value)} onBlur={(event) => editItems(actor.id, event.target.value, true)} />
                {drafts[actor.id]?.error ? <small id={`hg-items-${encodeURIComponent(actor.id)}`} role="alert">미적용: {drafts[actor.id].error} 마지막 유효 아이템만 저장됩니다. 입력 초안은 새로고침 전에 수정해 주세요.</small> : null}
              </label>
              <label className={styles.field}>사진<input disabled={locked} type="file" accept="image/*" onChange={(event) => {
                const file = event.target.files?.[0]; event.target.value = ''; void upload(actor.id, file);
              }} /></label>
              {actor.previewImage ? <button type="button" disabled={locked} onClick={() => {
                if (locked) return;
                requests.current.invalidate(actor.id); update(actor.id, { previewImage: '' });
              }}>사진 제거</button> : null}
            </div>
            <HungerTraitFields disabled={locked} value={actor.hungerTraits} onChange={(hungerTraits) => update(actor.id, { hungerTraits })} />
          </article>
        ))}
      </div>
    </section>
  );
}
