'use client';

import { useMemo, useState } from 'react';
import { apiGet, apiPost, getUser } from '@/utils/api';
import { compactCharactersForSave } from '@/utils/characterPayload';

const S = {
  wrap: { maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 },
  box: { border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 14 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#e5e7eb' },
  btn: { padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: '#2563eb', color: '#e5e7eb', fontWeight: 900, cursor: 'pointer' },
};

const stripImageDataLines = (text) => String(text || '').replace(/^\s*"data"\s*:\s*"[^"]*"\s*,?\s*$/gm, '');

const parse = (text) => {
  try { return { ok: true, data: JSON.parse(text) }; }
  catch (error) { return { ok: false, error: error?.message || 'JSON parse error' }; }
};

const genderToKorean = (gender) => {
  const value = String(gender || '').toLowerCase();
  if (value === 'f' || value === 'female' || value === 'woman') return '여';
  if (value === 'm' || value === 'male' || value === 'man') return '남';
  return '기타';
};

const dedupeByName = (list) => {
  const seen = new Set();
  const out = [];
  for (const character of list) {
    const name = String(character?.name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...character, name });
  }
  return out;
};

const coerceCharacters = (data) => {
  if (Array.isArray(data)) return { ok: true, list: dedupeByName(data) };
  const source = Array.isArray(data?.characters) ? data.characters : null;
  if (!source) return { ok: false, error: '지원하지 않는 형식입니다. (최상위 배열 또는 { characters: [...] } 필요)' };
  const list = source.map((character) => {
    const name = String(character?.name || '').trim();
    if (!name) return null;
    const image = String(character?.image?.data || '').trim();
    return {
      name,
      gender: genderToKorean(character?.gender_select),
      previewImage: image.startsWith('data:image/') && image.length <= 200000 ? image : null,
    };
  }).filter(Boolean);
  return { ok: true, list: dedupeByName(list) };
};

function stringifyLogBody(payload) {
  if (typeof payload === 'string') return payload;
  try { return JSON.stringify(payload, null, 2); }
  catch { return String(payload); }
}

export default function ImportClient() {
  const [charsText, setCharsText] = useState('');
  const [log, setLog] = useState('');
  const [stripImageData, setStripImageData] = useState(true);
  const charsParsed = useMemo(() => parse(charsText), [charsText]);

  const onFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      setCharsText(stripImageData ? stripImageDataLines(raw) : raw);
    };
    reader.readAsText(file);
  };

  const postJson = async (endpoint, body) => {
    setLog('');
    try {
      const response = await apiPost(endpoint, body, { returnFullResponse: true });
      setLog(`POST ${endpoint} → ${response.status}\n${stringifyLogBody(response.data)}`);
    } catch (error) {
      setLog(`요청 실패: ${error?.message || String(error)}`);
    }
  };

  const importCharacters = async (mode) => {
    setLog('');
    if (!getUser()) return setLog('로그인 세션이 없습니다. 다시 로그인해주세요.');
    if (!charsParsed.ok) return setLog(`JSON 오류: ${charsParsed.error}`);
    const coerced = coerceCharacters(charsParsed.data);
    if (!coerced.ok) return setLog(`캐릭터 형식 오류: ${coerced.error}`);

    let payload = coerced.list;
    if (mode === 'merge') {
      try {
        const existing = await apiGet('/characters');
        const existingList = Array.isArray(existing) ? existing : [];
        const existingNames = new Set(existingList.map((character) => String(character?.name || '').trim().toLowerCase()).filter(Boolean));
        payload = [...existingList, ...payload.filter((character) => !existingNames.has(character.name.toLowerCase()))];
      } catch (error) {
        return setLog(`기존 캐릭터 불러오기 실패: ${error?.message || String(error)}`);
      }
    }
    await postJson('/characters/save', compactCharactersForSave(payload));
  };

  return (
    <div style={S.wrap}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px' }}>NGUH JSON 이식</div>
        <div style={{ opacity: 0.85, marginTop: 6, lineHeight: 1.6 }}><b>characters.eh.json</b> (배열) 또는 <b>{`{ characters: [...] }`}</b> (NGUH 원본) 업로드를 지원합니다.</div>
      </div>
      <div style={S.box}>
        <div style={{ fontWeight: 900 }}>인증 및 API</div>
        <div style={{ opacity: 0.8, marginTop: 8 }}>현재 로그인 세션과 배포 환경에 설정된 API 주소를 사용합니다. 토큰과 임의 목적지는 화면에서 입력받지 않습니다.</div>
      </div>
      <div style={S.box}>
        <div style={{ fontWeight: 900 }}>캐릭터</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <input type="file" accept=".json,application/json" onChange={onFile} />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, opacity: 0.9, fontWeight: 800 }}><input type="checkbox" checked={stripImageData} onChange={(event) => setStripImageData(event.target.checked)} />&quot;data&quot;: 라인 제거</label>
          <button style={S.btn} onClick={() => importCharacters('merge')}>추가(merge)</button>
          <button style={{ ...S.btn, background: '#dc2626' }} onClick={() => importCharacters('replace')}>덮어쓰기</button>
          {(() => {
            if (!charsParsed.ok) return null;
            const coerced = coerceCharacters(charsParsed.data);
            return coerced.ok ? <span style={{ opacity: 0.8 }}>{`총 ${coerced.list.length}명`}</span> : <span style={{ opacity: 0.8 }}>형식 오류</span>;
          })()}
        </div>
        <textarea style={{ ...S.input, marginTop: 10, minHeight: 110, fontFamily: 'ui-monospace, Menlo, monospace' }} value={charsText} onChange={(event) => setCharsText(event.target.value)} />
      </div>
      <div style={S.box}><div style={{ fontWeight: 900 }}>로그</div><pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, Menlo, monospace' }}>{log || '대기 중...'}</pre></div>
    </div>
  );
}
