'use client';

import { useEffect, useMemo, useState } from 'react';

const S = {
  wrap: { maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 },
  box: { border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 14 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#e5e7eb' },
  btn: { padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: '#2563eb', color: '#e5e7eb', fontWeight: 900, cursor: 'pointer' },
};

const parse = (t) => { try { return { ok: true, data: JSON.parse(t) }; } catch (e) { return { ok: false, error: e?.message || 'JSON parse error' }; } };

export default function ImportClient() {
  const [apiBase, setApiBase] = useState('');
  const [token, setToken] = useState('');
  const [eventsText, setEventsText] = useState('');
  const [charsText, setCharsText] = useState('');
  const [log, setLog] = useState('');

  useEffect(() => {
    const savedBase = window.localStorage.getItem('EH_API_BASE');
    const base = savedBase || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '');
    setApiBase(base);
    setToken(window.localStorage.getItem('token') || '');
  }, []);

  const eventsParsed = useMemo(() => parse(eventsText), [eventsText]);
  const charsParsed = useMemo(() => parse(charsText), [charsText]);

  const onFile = (setter) => (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setter(String(r.result || ''));
    r.readAsText(f);
  };

  const post = async (endpoint, parsed) => {
    setLog('');
    if (!token) return setLog('token 없음: DevTools → Application → Local Storage → token');
    if (!parsed.ok) return setLog(`JSON 오류: ${parsed.error}`);
    if (!Array.isArray(parsed.data)) return setLog('JSON 최상위는 배열([])이어야 합니다.');

    const base = (apiBase || '').replace(/\/$/, '');
    const url = `${base}${endpoint}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(parsed.data),
      });
      const text = await res.text();
      setLog(`POST ${endpoint} → ${res.status}\n${text}`);
    } catch (e) {
      setLog(`요청 실패: ${e?.message || String(e)}`);
    }
  };

  return (
    <div style={S.wrap}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px' }}>NGUH JSON 이식</div>
        <div style={{ opacity: 0.85, marginTop: 6, lineHeight: 1.6 }}>
          변환된 <b>events.eh.json / characters.eh.json</b>을 업로드해서 서버에 넣습니다. (기본: /api/events/add, /api/characters/save)
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
        <div style={{ fontWeight: 900 }}>이벤트</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <input type="file" accept=".json,application/json" onChange={onFile(setEventsText)} />
          <button style={S.btn} onClick={() => post('/api/events/add', eventsParsed)}>업로드</button>
          {eventsParsed.ok && Array.isArray(eventsParsed.data) ? <span style={{ opacity: 0.8 }}>{`총 ${eventsParsed.data.length}개`}</span> : null}
        </div>
        <textarea style={{ ...S.input, marginTop: 10, minHeight: 110, fontFamily: 'ui-monospace, Menlo, monospace' }} value={eventsText} onChange={(e) => setEventsText(e.target.value)} />
      </div>

      <div style={S.box}>
        <div style={{ fontWeight: 900 }}>캐릭터</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <input type="file" accept=".json,application/json" onChange={onFile(setCharsText)} />
          <button style={S.btn} onClick={() => post('/api/characters/save', charsParsed)}>업로드</button>
          {charsParsed.ok && Array.isArray(charsParsed.data) ? <span style={{ opacity: 0.8 }}>{`총 ${charsParsed.data.length}명`}</span> : null}
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
