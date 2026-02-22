'use client';

import { useEffect, useMemo, useState } from 'react';

const S = {
  wrap: { maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 },
  box: { border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 14 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#e5e7eb' },
  btn: { padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: '#2563eb', color: '#e5e7eb', fontWeight: 900, cursor: 'pointer' },
};

// NGUH 추출본처럼 이미지(data:)가 매우 큰 경우가 있어, 필요 시 라인 단위로 제거
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

// 업로드된 JSON을 "서버 Character 스키마 배열"로 정규화
const coerceCharacters = (data) => {
  // 1) 이미 배열이면 그대로(서버 스키마라고 가정)
  if (Array.isArray(data)) return { ok: true, list: dedupeByName(data) };

  // 2) NGUH 원본: { version, characters: [...] }
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

export default function ImportClient() {
  const [apiBase, setApiBase] = useState('');
  const [token, setToken] = useState('');
  const [charsText, setCharsText] = useState('');
  const [log, setLog] = useState('');
  const [stripImageData, setStripImageData] = useState(true);

  useEffect(() => {
    const savedBase = window.localStorage.getItem('EH_API_BASE');
    const base = savedBase || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '');
    setApiBase(base);
    setToken(window.localStorage.getItem('token') || '');
  }, []);

  const charsParsed = useMemo(() => parse(charsText), [charsText]);

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
    const base = (apiBase || '').replace(/\/$/, '');
    const url = `${base}${endpoint}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      setLog(`POST ${endpoint} → ${res.status}\n${text}`);
    } catch (e) {
      setLog(`요청 실패: ${e?.message || String(e)}`);
    }
  };

  const getJson = async (endpoint) => {
    const base = (apiBase || '').replace(/\/$/, '');
    const url = `${base}${endpoint}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  };

  const importCharacters = async (mode) => {
    setLog('');
    if (!token) return setLog('token 없음: DevTools → Application → Local Storage → token');
    if (!charsParsed.ok) return setLog(`JSON 오류: ${charsParsed.error}`);

    const coerced = coerceCharacters(charsParsed.data);
    if (!coerced.ok) return setLog(`캐릭터 형식 오류: ${coerced.error}`);

    let payload = coerced.list;
    if (mode === 'merge') {
      try {
        const existing = await getJson('/api/characters');
        const exList = Array.isArray(existing) ? existing : [];
        const exNames = new Set(exList.map((c) => String(c?.name || '').trim().toLowerCase()).filter(Boolean));
        const newOnly = payload.filter((c) => !exNames.has(String(c?.name || '').trim().toLowerCase()));
        payload = [...exList, ...newOnly];
      } catch (e) {
        return setLog(`기존 캐릭터 불러오기 실패: ${e?.message || String(e)}`);
      }
    }

    await postJson('/api/characters/save', payload);
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
              window.localStorage.setItem('EH_API_BASE', v);
            }}
            placeholder="예) http://localhost:5000"
          />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <div style={{ fontWeight: 900, minWidth: 110 }}>token</div>
          <input style={S.input} value={token} onChange={(e) => setToken(e.target.value)} placeholder="LocalStorage token" />
        </div>
      </div>

      <div style={S.box}>
        <div style={{ fontWeight: 900 }}>캐릭터</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <input type="file" accept=".json,application/json" onChange={onFile(setCharsText)} />

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, opacity: 0.9, fontWeight: 800 }}>
            <input type="checkbox" checked={stripImageData} onChange={(e) => setStripImageData(e.target.checked)} />
            "data": 라인 제거
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
