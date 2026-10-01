'use client';

import Image from 'next/image';
import HungerTraitFields from '../../../components/HungerTraitFields';
import { readCompressedPreviewImage } from '../../../utils/previewImage';
import { HUNGER_LIMITS } from '../_lib/hungerGameContract.js';
import styles from '../HungerGames.module.css';

export default function HungerRosterEditor({ roster, matchMode, onChange, onLoadAccount, busy, onNotice }) {
  const update = (id, patch) => onChange(roster.map((actor) => actor.id === id ? { ...actor, ...patch } : actor));
  const upload = async (id, file) => {
    if (!file) return;
    try {
      const previewImage = await readCompressedPreviewImage(file);
      if (!previewImage) throw new Error('이미지 용량을 줄여 다시 선택해 주세요.');
      // Pass a functional update so a slow image decode cannot overwrite other edits.
      onChange((previous) => previous.map((actor) => actor.id === id ? { ...actor, previewImage } : actor));
    } catch (error) { onNotice(error.message); }
  };
  return (
    <section>
      <div className={styles.toolbar}>
        <div><h2>참가자 {roster.length}명</h2><p>이름·사진·출신 구역·팀과 사건에 적용할 특성을 설정합니다.</p></div>
        <div className={styles.actions}>
          <button type="button" disabled={roster.length >= HUNGER_LIMITS.actors} onClick={() => onChange([...roster, { id: 'actor-' + crypto.randomUUID(), name: '새 참가자', previewImage: '', teamId: '', hungerTraits: [], items: [] }])}>참가자 추가</button>
          <button type="button" onClick={onLoadAccount} disabled={busy}>내 캐릭터 불러오기</button>
        </div>
      </div>
      <p className={styles.note}>출신 구역은 소속 표시이며 전투를 막지 않습니다. 팀은 경기 탭에서 팀전을 선택했을 때 적용됩니다. 특성을 비워 두면 일반 참가자로 진행하고, 번개 조종만으로 면역을 얻지는 않습니다.</p>
      <div className={styles.rosterGrid}>
        {roster.map((actor) => (
          <article className={styles.panel} key={actor.id}>
            <div className={styles.actorHead}>
              {actor.previewImage ? <Image unoptimized src={actor.previewImage} alt={actor.name} width={64} height={64} /> : <span className={styles.avatar}>{actor.name.slice(0, 1) || '?'}</span>}
              <label className={styles.field}>이름<input maxLength={120} value={actor.name} onChange={(event) => update(actor.id, { name: event.target.value })} /></label>
              <button type="button" aria-label={actor.name + ' 삭제'} onClick={() => onChange(roster.filter((row) => row.id !== actor.id))}>삭제</button>
            </div>
            <div className={styles.fields}>
              <label className={styles.field}>출신 구역<input value={actor.districtId || ''} maxLength={40} placeholder="예: 12구역" onChange={(event) => update(actor.id, { districtId: event.target.value })} /></label>
              <label className={styles.field}>팀<input value={actor.teamId || ''} disabled={matchMode === 'solo'} maxLength={40} placeholder="팀전에서 적용 · 비워 두면 개인 팀" onChange={(event) => update(actor.id, { teamId: event.target.value })} /></label>
              <label className={styles.field}>시작 아이템<input value={actor.items.join(', ')} placeholder="예: 칼, 식량" onChange={(event) => update(actor.id, { items: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></label>
              <label className={styles.field}>사진<input type="file" accept="image/*" onChange={(event) => void upload(actor.id, event.target.files?.[0])} /></label>
              {actor.previewImage ? <button type="button" onClick={() => update(actor.id, { previewImage: '' })}>사진 제거</button> : null}
            </div>
            <HungerTraitFields value={actor.hungerTraits} onChange={(hungerTraits) => update(actor.id, { hungerTraits })} />
          </article>
        ))}
      </div>
    </section>
  );
}
