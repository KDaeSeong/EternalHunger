'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost, clearApiGetCache } from '../../../../utils/api';
import { useToast } from '../../../../components/ToastProvider';
import { GAME_ADAPTER_PRESETS, findGameAdapterPreset } from '../../../games/_lib/gameCatalog';

const DEFAULT_FORM = {
  slug: '',
  title: '',
  subtitle: '',
  priority: '후보',
  stage: 'planned',
  stageLabel: '이식 후보',
  adapter: 'discussion',
  roomSystem: 'none',
  resultMode: 'manual',
  scope: '',
  summary: '',
  nextStep: '',
  supportsRooms: false,
  supportsStateSync: false,
  supportsRecords: true,
  supportsSaves: true,
  visible: true,
  sortOrder: 1000,
};

function cleanSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const styles = {
  panel: {
    display: 'grid',
    gap: 14,
    border: '1px solid rgba(56, 189, 248, 0.18)',
    borderRadius: 8,
    background: 'rgba(8, 47, 73, 0.20)',
    padding: 16,
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'start',
  },
  title: {
    margin: 0,
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 950,
  },
  sub: {
    margin: '6px 0 0',
    color: '#b6c2d6',
    lineHeight: 1.5,
    fontWeight: 700,
  },
  hint: {
    margin: 0,
    color: '#bfdbfe',
    lineHeight: 1.45,
    fontSize: 13,
    fontWeight: 850,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 10,
  },
  label: {
    minWidth: 0,
    display: 'grid',
    gap: 6,
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: 950,
  },
  input: {
    width: '100%',
    minHeight: 38,
    border: '1px solid rgba(148, 163, 184, 0.30)',
    borderRadius: 8,
    background: 'rgba(15, 23, 42, 0.82)',
    color: '#f8fafc',
    padding: '8px 10px',
    font: 'inherit',
    fontWeight: 800,
  },
  textarea: {
    width: '100%',
    minHeight: 82,
    border: '1px solid rgba(148, 163, 184, 0.30)',
    borderRadius: 8,
    background: 'rgba(15, 23, 42, 0.82)',
    color: '#f8fafc',
    padding: '9px 10px',
    font: 'inherit',
    fontWeight: 800,
    lineHeight: 1.45,
    resize: 'vertical',
  },
  checks: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  check: {
    minHeight: 34,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    border: '1px solid rgba(148, 163, 184, 0.22)',
    borderRadius: 999,
    color: '#e5e7eb',
    padding: '0 10px',
    fontSize: 13,
    fontWeight: 900,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  button: {
    minHeight: 38,
    border: '1px solid rgba(56, 189, 248, 0.28)',
    borderRadius: 8,
    background: '#0369a1',
    color: '#ffffff',
    cursor: 'pointer',
    padding: '0 13px',
    fontWeight: 950,
  },
  ghost: {
    minHeight: 38,
    border: '1px solid rgba(148, 163, 184, 0.24)',
    borderRadius: 8,
    background: 'rgba(15, 23, 42, 0.50)',
    color: '#e5e7eb',
    cursor: 'pointer',
    padding: '0 13px',
    fontWeight: 950,
  },
  danger: {
    minHeight: 34,
    border: '1px solid rgba(248, 113, 113, 0.35)',
    borderRadius: 8,
    background: 'rgba(127, 29, 29, 0.28)',
    color: '#fecaca',
    cursor: 'pointer',
    padding: '0 10px',
    fontWeight: 950,
  },
  list: {
    display: 'grid',
    gap: 10,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 12,
    alignItems: 'center',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    borderRadius: 8,
    background: 'rgba(15, 23, 42, 0.62)',
    padding: 12,
  },
  rowTitle: {
    margin: 0,
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 950,
  },
  rowMeta: {
    margin: '5px 0 0',
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 850,
  },
  rowSummary: {
    margin: '7px 0 0',
    color: '#cbd5e1',
    lineHeight: 1.45,
    fontSize: 13,
    fontWeight: 700,
  },
  rowActions: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
};

export default function GameCandidateManager() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const selectedAdapterPreset = findGameAdapterPreset(form.adapter);

  const sortedEntries = useMemo(() => (
    [...entries].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
  ), [entries]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await apiGet('/admin/games/catalog', { timeoutMs: 15000 });
      setEntries(safeList(data?.entries));
    } catch (err) {
      const nextMessage = err?.message || '게임 후보 목록을 불러오지 못했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const updateForm = (key, value) => {
    if (key === 'slug') {
      setForm((current) => ({ ...current, slug: cleanSlug(value) }));
      return;
    }
    if (key === 'adapter') {
      const preset = findGameAdapterPreset(value);
      setForm((current) => ({
        ...current,
        adapter: value,
        ...(preset ? {
          roomSystem: preset.roomSystem,
          resultMode: preset.resultMode,
          supportsRooms: preset.roomSystem !== 'none',
          supportsStateSync: Boolean(preset.supportsStateSync),
          supportsRecords: Boolean(preset.supportsRecords),
          supportsSaves: Boolean(preset.supportsSaves),
        } : {}),
      }));
      return;
    }
    if (key === 'roomSystem') {
      setForm((current) => ({ ...current, roomSystem: value, supportsRooms: value !== 'none' }));
      return;
    }
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setMessage('');
  };

  const editEntry = (entry) => {
    setForm({
      ...DEFAULT_FORM,
      ...entry,
      sortOrder: Number(entry.sortOrder || 1000),
    });
    setMessage('선택한 후보를 편집 폼으로 불러왔습니다.');
  };

  const saveEntry = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.slug || !form.title) {
      const nextMessage = '게임 키와 이름을 입력해주세요.';
      setMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const res = await apiPost('/admin/games/catalog', form, { timeoutMs: 20000 });
      clearApiGetCache('/admin/games/catalog');
      const nextMessage = res?.message || '게임 후보를 저장했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      await loadEntries();
    } catch (err) {
      const nextMessage = err?.message || '게임 후보 저장에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (entry) => {
    if (!entry?.id || saving) return;
    const ok = window.confirm(`"${entry.title || entry.slug}" 후보를 삭제하시겠습니까?`);
    if (!ok) return;

    setSaving(true);
    setMessage('');
    try {
      const res = await apiDelete(`/admin/games/catalog/${entry.id}`, { timeoutMs: 15000 });
      const nextMessage = res?.message || '게임 후보를 삭제했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      await loadEntries();
      if (form.slug === entry.slug) resetForm();
    } catch (err) {
      const nextMessage = err?.message || '게임 후보 삭제에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={styles.panel}>
      <div style={styles.head}>
        <div>
          <h2 style={styles.title}>관리 후보 저장소</h2>
          <p style={styles.sub}>아직 코드 카탈로그에 넣기 전인 게임 후보를 관리자 데이터로 저장합니다.</p>
        </div>
        <div style={styles.actions}>
          <button type="button" style={styles.ghost} onClick={() => void loadEntries()} disabled={loading || saving}>
            {loading ? '조회 중...' : '새로고침'}
          </button>
          <button type="button" style={styles.ghost} onClick={resetForm} disabled={saving}>새 후보</button>
        </div>
      </div>

      <form onSubmit={saveEntry} style={{ display: 'grid', gap: 12 }}>
        <div style={styles.formGrid}>
          <label style={styles.label}>
            게임 키
            <input style={styles.input} value={form.slug} disabled={saving} onChange={(event) => updateForm('slug', event.target.value)} placeholder="my-new-game" />
          </label>
          <label style={styles.label}>
            이름
            <input style={styles.input} value={form.title} disabled={saving} onChange={(event) => updateForm('title', event.target.value)} />
          </label>
          <label style={styles.label}>
            장르/부제
            <input style={styles.input} value={form.subtitle} disabled={saving} onChange={(event) => updateForm('subtitle', event.target.value)} />
          </label>
          <label style={styles.label}>
            우선순위
            <input style={styles.input} value={form.priority} disabled={saving} onChange={(event) => updateForm('priority', event.target.value)} />
          </label>
          <label style={styles.label}>
            단계
            <select style={styles.input} value={form.stage} disabled={saving} onChange={(event) => updateForm('stage', event.target.value)}>
              <option value="planned">기획</option>
              <option value="prototype">프로토타입</option>
              <option value="live">운영</option>
              <option value="archived">보류</option>
            </select>
          </label>
          <label style={styles.label}>
            단계 표시
            <input style={styles.input} value={form.stageLabel} disabled={saving} onChange={(event) => updateForm('stageLabel', event.target.value)} />
          </label>
          <label style={styles.label}>
            어댑터
            <select style={styles.input} value={form.adapter} disabled={saving} onChange={(event) => updateForm('adapter', event.target.value)}>
              {form.adapter && !findGameAdapterPreset(form.adapter) ? <option value={form.adapter}>{form.adapter}</option> : null}
              {GAME_ADAPTER_PRESETS.map((preset) => (
                <option value={preset.adapter} key={preset.adapter}>{preset.label} · {preset.adapter}</option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            방 시스템
            <select style={styles.input} value={form.roomSystem} disabled={saving} onChange={(event) => updateForm('roomSystem', event.target.value)}>
              <option value="none">없음</option>
              <option value="game-room">공용 게임방</option>
              <option value="twenty-questions">스무고개 전용</option>
            </select>
          </label>
          <label style={styles.label}>
            결과 처리
            <input style={styles.input} value={form.resultMode} disabled={saving} onChange={(event) => updateForm('resultMode', event.target.value)} />
          </label>
          <label style={styles.label}>
            정렬
            <input style={styles.input} type="number" value={form.sortOrder} disabled={saving} onChange={(event) => updateForm('sortOrder', Number(event.target.value || 0))} />
          </label>
        </div>

        {selectedAdapterPreset ? <p style={styles.hint}>{selectedAdapterPreset.description}</p> : null}

        <div style={styles.formGrid}>
          <label style={styles.label}>
            범위
            <textarea style={styles.textarea} value={form.scope} disabled={saving} onChange={(event) => updateForm('scope', event.target.value)} />
          </label>
          <label style={styles.label}>
            요약
            <textarea style={styles.textarea} value={form.summary} disabled={saving} onChange={(event) => updateForm('summary', event.target.value)} />
          </label>
          <label style={styles.label}>
            다음 작업
            <textarea style={styles.textarea} value={form.nextStep} disabled={saving} onChange={(event) => updateForm('nextStep', event.target.value)} />
          </label>
        </div>

        <div style={styles.checks}>
          {[
            ['supportsRooms', '게임방'],
            ['supportsStateSync', '상태 동기화'],
            ['supportsRecords', '전적'],
            ['supportsSaves', '저장 슬롯'],
            ['visible', '표시'],
          ].map(([key, label]) => (
            <label style={styles.check} key={key}>
              <input
                type="checkbox"
                checked={Boolean(form[key])}
                disabled={saving}
                onChange={(event) => updateForm(key, event.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>

        {message ? <div style={{ color: '#bfdbfe', fontWeight: 850 }}>{message}</div> : null}

        <div style={styles.actions}>
          <button type="submit" style={styles.button} disabled={saving}>{saving ? '저장 중...' : '후보 저장'}</button>
        </div>
      </form>

      <div style={styles.list}>
        {loading ? (
          <div style={{ color: '#cbd5e1', fontWeight: 850 }}>게임 후보를 불러오는 중입니다.</div>
        ) : sortedEntries.length ? sortedEntries.map((entry) => (
          <article style={styles.row} key={entry.id || entry.slug}>
            <div>
              <h3 style={styles.rowTitle}>{entry.title || entry.slug}</h3>
              <p style={styles.rowMeta}>
                {entry.slug} · {entry.stageLabel || entry.stage} · {entry.adapter} · {formatDate(entry.updatedAt)}
              </p>
              <p style={styles.rowSummary}>{entry.summary || entry.nextStep || '요약 없음'}</p>
            </div>
            <div style={styles.rowActions}>
              <button type="button" style={styles.ghost} onClick={() => editEntry(entry)} disabled={saving}>수정</button>
              <button type="button" style={styles.danger} onClick={() => void deleteEntry(entry)} disabled={saving}>삭제</button>
            </div>
          </article>
        )) : (
          <div style={{ color: '#cbd5e1', fontWeight: 850 }}>저장된 관리 후보가 없습니다.</div>
        )}
      </div>
    </section>
  );
}
