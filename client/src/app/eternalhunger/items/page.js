'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import ItemEditorModal from '../../admin/items/_components/ItemEditorModal';
import { loadGuestSimulationItemCatalog } from '../../simulation/_lib/guestSimulationBootstrap.js';
import { readGuestItems, saveGuestItem, removeGuestItem } from '../../simulation/_lib/guestItemProfileRuntime.js';
import { describeConsumeEffect } from '../../../utils/consumeEffectAuthoring.js';
import { describeEquipmentEffects } from '../../../utils/equipmentEffectAuthoring.js';

export default function LocalItemsPage() {
  const [builtin, setBuiltin] = useState([]);
  const [saved, setSaved] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [editor, setEditor] = useState(null);
  useEffect(() => {
    let active = true;
    loadGuestSimulationItemCatalog({ includeLocal: false }).then(items => {
      if (!active) return;
      const local = readGuestItems(items);
      setBuiltin(items);
      if (!local.ok) { setError(local.error); return; }
      setSaved(local.items); setReady(true);
    }).catch(() => { if (active) setError('아이템 목록을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'); });
    return () => { active = false; };
  }, []);
  const items = useMemo(() => [...new Map([...builtin, ...saved].map(item => [item._id, item])).values()], [builtin, saved]);
  const matches = useMemo(() => query.trim() ? items.filter(item => item.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 40) : [], [items, query]);
  const button = { padding: '8px 12px', color: '#edf7ff', background: '#183c54', border: '1px solid #53748d', borderRadius: 7, cursor: 'pointer' };
  const edit = item => { setError(''); setEditor({ mode: 'edit', item }); };
  const remove = item => {
    const isDefault = builtin.some(row => row._id === item._id);
    if (!window.confirm(isDefault ? `${item.name}의 이 기기 수정을 취소하고 내장 원본으로 되돌릴까요?` : `${item.name}을 이 기기 목록에서 삭제할까요? 보관된 경기는 바뀌지 않습니다.`)) return;
    const result = removeGuestItem(item._id, builtin);
    if (!result.ok) { setError(result.error); return; }
    setSaved(result.items); setNotice(isDefault ? '내장 원본으로 되돌렸습니다.' : '이 기기의 아이템 목록에서 삭제했습니다.');
  };
  const save = async (payload, id) => {
    const result = saveGuestItem({ ...payload, _id: id || `guest-item-${crypto.randomUUID()}` }, builtin);
    if (!result.ok) throw new Error(result.error);
    setSaved(result.items);
    setNotice('이 기기에 저장했습니다. 돌아가서 시작하는 로그인 없는 새 경기에 적용됩니다.');
  };
  return <main style={{ maxWidth: 1080, margin: '24px auto', padding: 24, background: '#091d2b', color: '#edf7ff', borderRadius: 14 }}>
    <Link href="/eternalhunger" style={{ color: '#89d6ff' }}>← 새 경기 준비로 돌아가기</Link>
    <h1 style={{ fontSize: 28, fontWeight: 800, margin: '18px 0 12px' }}>내 아이템 편집</h1>
    <p style={{ lineHeight: 1.7, marginBottom: 10 }}>내장 아이템을 바꾸거나 새 아이템을 만들어 로그인 없이 관전할 수 있습니다. 이 브라우저에만 저장하며, 계정 아이템·내장 원본·이미 보관한 경기는 바꾸지 않습니다.</p>
    <p style={{ lineHeight: 1.7, marginBottom: 18 }}>새 아이템은 재료와 조합식을 지정해 실제 제작으로 얻습니다. 경기 중 무료 지급은 하지 않으며, 기준 평가 경기는 항상 내장 원본을 사용합니다.</p>
    <button style={button} disabled={!ready} onClick={() => setEditor({ mode: 'create', item: { type: '소모품' } })}>새 아이템 만들기</button>
    {error && <p role="alert" style={{ color: '#ffc7bb' }}>{error}</p>}
    {notice && <p role="status" style={{ color: '#b6eccd' }}>{notice}</p>}
    <h2 style={{ fontSize: 20, fontWeight: 700, margin: '24px 0 12px' }}>이 기기의 아이템 · {saved.length}개</h2>
    {!saved.length && <p>아직 저장한 아이템이 없습니다. 새로 만들거나 아래에서 내장 아이템을 찾아 편집해 보세요.</p>}
    <div style={{ display: 'grid', gap: 10 }}>
      {saved.map(item => <article key={item._id} style={{ padding: 14, background: '#132f42', borderRadius: 8 }}>
        <strong>{item.name}</strong> <span>· {item.type}</span>
        <p>{['무기', 'weapon', '방어구', 'armor'].includes(item.type)
          ? describeEquipmentEffects(item.equipmentEffects) : describeConsumeEffect(item.consumeEffect)}</p>
        <button style={button} onClick={() => edit(item)}>{item.name} 편집</button>{' '}
        <button style={button} onClick={() => remove(item)}>{builtin.some(row => row._id === item._id) ? '내장 원본으로 복원' : '삭제'}</button>
      </article>)}
    </div>
    <h2 style={{ fontSize: 20, fontWeight: 700, margin: '24px 0 12px' }}>내장 아이템에서 시작하기</h2>
    <label>아이템 이름 검색
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="예: 사과, 스테이크"
        style={{ display: 'block', width: '100%', padding: 12, marginTop: 8, borderRadius: 8, background: '#142f42', color: '#edf7ff', border: '1px solid #53748d' }} />
    </label>
    <ul style={{ display: 'grid', gap: 8, paddingLeft: 20 }}>
      {matches.map(item => <li key={item._id}><button style={button} disabled={!ready} onClick={() => edit(item)}>{item.name} · {item.type} 편집</button></li>)}
    </ul>
    {query && <p>최대 40개까지 표시합니다. 원하는 이름으로 좁혀 검색해 주세요.</p>}
    <ItemEditorModal open={Boolean(editor)} mode={editor?.mode} item={editor?.item} allItems={items}
      onClose={() => setEditor(null)} onSave={save} localMode />
  </main>;
}
