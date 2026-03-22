'use client';

import { useMemo, useState } from 'react';
import {
  apiGet,
  apiPost,
  getAnyToken,
  getApiBase,
  normalizeApiBase,
  saveAuth,
  stripApiSuffix,
} from '@/utils/api';

const S = {
  wrap: { maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 },
  box: { border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 14 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#e5e7eb' },
  btn: { padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: '#2563eb', color: '#e5e7eb', fontWeight: 900, cursor: 'pointer' },
};

const stripImageDataLines = (t) => String(t || '').replace(/^\s*"data"\s*:\s*"[^"]*"\s*,?\s*$/gm, '');

const parse = (t) => {
  try {
    return { ok: true, data: JSON.parse(t) };
  } catch (e) {
    return { ok: false, error: e?.message || 'JSON parse error' };
  }
};

const genderToKorean = (g) => {
  const v = String(g || '').toLowerCase();
  if (v === 'f' || v === 'female' || v === 'woman') return '여';
  if (v === 'm' || v === 'male' || v === 'man') return '남';
  return '기타';
};

const dedupeByName = (list) => {
  const seen = new Set();
  const out = [];
  for (const c of list) {
    const name = String(c?.name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...c, name });
  }
  return out;
};

const coerceCharacters = (data) => {
  if (Array.isArray(data)) return { ok: true, list: dedupeByName(data) };

  const arr = Array.isArray(data?.characters) ? data.characters : null;
  if (!arr) return { ok: false, error: '지원하지 않는 형식입니다. (최상위 배열 또는 { characters: [...] } 필요)' };

  const list = arr
    .map((c) => {
      const name = String(c?.name || '').trim();
      if (!name) return null;
      const img = String(c?.image?.data || '').trim();
      const safePreview = img.startsWith('data:image/') && img.length <= 200000 ? img : null;
      return {
        name,
        gender: genderToKorean(c?.gender_select),
        previewImage: safePreview,
      };
    })
    .filter(Boolean);

  return { ok: true, list: dedupeByName(list) };
};

const getInitialApiBase = () => {
  if (typeof window === 'undefined') return '';
  const current = getApiBase();
  if (current) return stripApiSuffix(current);

  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:5000';

  return '';
};

function stringifyLogBody(payload) {
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export default function ImportClient() {
  const [apiBase, setApiBase] = useState(() => getInitialApiBase());
  const [token, setToken] = useState(() => getAnyToken() || '');
  const [charsText, setCharsText] = useState('');
  const [log, setLog] = useState('');
  const [stripImageData, setStripImageData] = useState(true);


  const charsParsed = useMemo(() => parse(charsText), [charsText]);

  const normalizedBase = useMemo(() => normalizeApiBase(apiBase), [apiBase]);
  const trimmedToken = String(token || '').trim();
  const requestOptions = useMemo(
    () => ({
      baseOverride: normalizedBase,
      tokenOverride: trimmedToken,
    }),
    [normalizedBase, trimmedToken]
  );

  const onFile = (setter) => (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const raw = String(r.result || '');
      setter(stripImageData ? stripImageDataLines(raw) : raw);
    };
    r.readAsText(f);
  };

  const postJson = async (endpoint, body) => {
    setLog('');
    try {
      const res = await apiPost(endpoint, body, {
        ...requestOptions,
        returnFullResponse: true,
      });
      setLog(`POST ${endpoint} → ${res.status}
${stringifyLogBody(res.data)}`);
    } catch (e) {
      setLog(`요청 실패: ${e?.message || String(e)}`);
    }
  };

  const getJson = async (endpoint) => {
    return apiGet(endpoint, requestOptions);
  };

  const importCharacters = async (mode) => {
    setLog('');
    if (!trimmedToken) return setLog('token 없음: 로그인 후 다시 열거나 token 입력');
    if (!normalizedBase) return setLog('API Base 없음: 로컬/배포 API 주소를 확인');
    if (!charsParsed.ok) return setLog(`JSON 오류: ${charsParsed.error}`);

    const coerced = coerceCharacters(charsParsed.data);
    if (!coerced.ok) return setLog(`캐릭터 형식 오류: ${coerced.error}`);

    let payload = coerced.list;
    if (mode === 'merge') {
      try {
        const existing = await getJson('/characters');
        const exList = Array.isArray(existing) ? existing : [];
        const exNames = new Set(exList.map((c) => String(c?.name || '').trim().toLowerCase()).filter(Boolean));
        const newOnly = payload.filter((c) => !exNames.has(String(c?.name || '').trim().toLowerCase()));
        payload = [...exList, ...newOnly];
      } catch (e) {
        return setLog(`기존 캐릭터 불러오기 실패: ${e?.message || String(e)}`);
      }
    }

    await postJson('/characters/save', payload);
  };

  return (
    <div style={S.wrap}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px' }}>NGUH JSON 이식</div>
        <div style={{ opacity: 0.85, marginTop: 6, lineHeight: 1.6 }}>
          <b>characters.eh.json</b> (배열) 또는 <b>{`{ characters: [...] }`}</b> (NGUH 원본) 업로드를 지원합니다. 이벤트는 현재 비활성화.
        </div>
      </div>

      <div style={S.box}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 900, minWidth: 110 }}>API Base</div>
          <input
            style={S.input}
            value={apiBase}
            onChange={(e) => {
              const v = e.target.value;
              setApiBase(v);
              if (typeof window !== 'undefined') {
                window.localStorage.setItem('EH_API_BASE', v);
              }
            }}
            placeholder="예) http://localhost:5000"
          />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <div style={{ fontWeight: 900, minWidth: 110 }}>token</div>
          <input
            style={S.input}
            value={token}
            onChange={(e) => {
              const next = e.target.value;
              setToken(next);
              saveAuth(next || null, undefined);
            }}
            placeholder="LocalStorage token"
          />
        </div>
      </div>

      <div style={S.box}>
        <div style={{ fontWeight: 900 }}>캐릭터</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <input type="file" accept=".json,application/json" onChange={onFile(setCharsText)} />

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, opacity: 0.9, fontWeight: 800 }}>
            <input type="checkbox" checked={stripImageData} onChange={(e) => setStripImageData(e.target.checked)} />
            &quot;data&quot;: 라인 제거
          </label>

          <button style={S.btn} onClick={() => importCharacters('merge')}>추가(merge)</button>
          <button style={{ ...S.btn, background: '#dc2626' }} onClick={() => importCharacters('replace')}>덮어쓰기</button>

          {(() => {
            if (!charsParsed.ok) return null;
            const coerced = coerceCharacters(charsParsed.data);
            if (!coerced.ok) return <span style={{ opacity: 0.8 }}>형식 오류</span>;
            return <span style={{ opacity: 0.8 }}>{`총 ${coerced.list.length}명`}</span>;
          })()}
        </div>
        <textarea style={{ ...S.input, marginTop: 10, minHeight: 110, fontFamily: 'ui-monospace, Menlo, monospace' }} value={charsText} onChange={(e) => setCharsText(e.target.value)} />
      </div>

      <div style={S.box}>
        <div style={{ fontWeight: 900 }}>로그</div>
        <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, Menlo, monospace' }}>{log || '대기 중...'}</pre>
      </div>
    </div>
  );
}
