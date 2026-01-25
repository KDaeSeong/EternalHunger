'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { calculateBattle } from '../../utils/battleLogic'; 
import { generateDynamicEvent } from '../../utils/eventLogic'; 
import { updateEffects } from '../../utils/statusLogic'; 
import { applyItemEffect } from '../../utils/itemLogic';
import '../../styles/ERSimulation.css';

export default function SimulationPage() {
  const [survivors, setSurvivors] = useState([]); 
  const [dead, setDead] = useState([]);           
  const [events, setEvents] = useState([]);       
  const [logs, setLogs] = useState([]);           
  
  const [day, setDay] = useState(0);           
  const [phase, setPhase] = useState('night');
  const [isGameOver, setIsGameOver] = useState(false);
  const [loading, setLoading] = useState(true);

  // 킬 카운트 및 결과창 관리
  const [killCounts, setKillCounts] = useState({});
  const [showResultModal, setShowResultModal] = useState(false);
  const [winner, setWinner] = useState(null);

  // ★ [수정] 서버에서 불러올 설정값 상태 (기본값 설정)
  const [settings, setSettings] = useState({
      statWeights: { str:1, agi:1, int:1, men:1, luk:1, dex:1, sht:1, end:1 }, // 가중치 기본값
      suddenDeathTurn: 5,
      forbiddenZoneStartDay: 3,
      forbiddenZoneDamageBase: 1.5
  });

  const logEndRef = useRef(null);
  const hasInitialized = useRef(false);

  // 초기 데이터 로드 (캐릭터 + 이벤트 + ★설정)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
        alert("로그인이 필요한 기능입니다. 로그인 페이지로 이동합니다.");
        window.location.href = '/login'; 
        return;
    }

    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const fetchData = async () => {
      try {
        // ★ [추가] 내 게임 설정(가중치 포함)도 같이 불러오기!
        // Promise.all로 병렬 요청해서 속도 최적화
        const [charRes, eventRes, settingRes] = await Promise.all([
            axios.get('https://eternalhunger-e7z1.onrender.com/api/characters'),
            axios.get('https://eternalhunger-e7z1.onrender.com/api/events'),
            axios.get('https://eternalhunger-e7z1.onrender.com/api/settings', { headers: { Authorization: `Bearer ${token}` } })
        ]);
        
        // 설정 적용
        if (settingRes.data) {
            setSettings(settingRes.data); 
            console.log("✅ 게임 설정 로드 완료:", settingRes.data);
        }

        // 캐릭터 hp 초기화
        const charsWithStats = charRes.data.map(c => ({ ...c, hp: 100 }));
        const shuffledChars = charsWithStats.sort(() => Math.random() - 0.5);
        setSurvivors(shuffledChars);
        setEvents(eventRes.data);

        // 킬 카운트 초기화
        const initialKills = {};
        charRes.data.forEach(c => initialKills[c._id] = 0);
        setKillCounts(initialKills);
        
        addLog("📢 선수들이 경기장에 입장했습니다. 잠시 후 게임이 시작됩니다.", "system");

      } catch (err) {
            console.error("데이터 로드 실패:", err);
            addLog("⚠️ 데이터를 불러오는데 실패했습니다.", "death");
      } finally {
            setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (text, type = "normal") => {
    setLogs(prev => [...prev, { text, type, id: Date.now() + Math.random() }]);
  };

  // ★ 수정: latestKillCounts 인자 추가 (최신 킬 정보 받기)
  const finishGame = async (finalSurvivors, latestKillCounts) => {
    const winner = finalSurvivors[0];
    
    // ★ 수정: state(killCounts) 대신 인자로 받은 latestKillCounts를 우선 사용
    const finalKills = latestKillCounts || killCounts; 
    
    const myKills = winner ? (finalKills[winner._id] || 0) : 0;
    const rewardLP = 100 + (myKills * 10); 

    setWinner(winner);
    setIsGameOver(true);
    setShowResultModal(true);

    if (winner) {
        addLog(`🏆 게임 종료! 최후의 생존자: [${winner.name}]`, "highlight");
    } else {
        addLog(`💀 생존자가 아무도 없습니다...`, "death");
    }

    const token = localStorage.getItem('token');

    if (token && winner) {
        try {
            await axios.post('https://eternalhunger-e7z1.onrender.com/api/game/end', {
                winnerId: winner._id,
                killCounts: finalKills, // ★ 수정: 최신 킬 정보 전송
                fullLogs: logs.map(l => l.text),
                participants: [...survivors, ...dead]
            }, {
                headers: { Authorization: `Bearer ${token}` } 
            });
            console.log("✅ 명예의 전당 저장 성공");
        } catch (err) {
            console.error("명예의 전당 저장 실패:", err);
        }

        try {
            const res = await axios.post('https://eternalhunger-e7z1.onrender.com/api/user/update-stats', {
                kills: myKills,
                isWin: true,
                lpEarned: rewardLP
            }, {
                headers: { Authorization: `Bearer ${token}` } 
            });
            addLog(`💾 [전적 저장 완료] LP +${rewardLP} 획득! (현재 총 LP: ${res.data.newLp})`, "system");
            
            const currentUser = JSON.parse(localStorage.getItem('user'));
            if (currentUser) {
                currentUser.lp = res.data.newLp;
                localStorage.setItem('user', JSON.stringify(currentUser));
            }
        } catch (err) {
             addLog(`⚠️ LP 저장 실패: ${err.response?.data?.error || "서버 오류"}`, "death");
        }
    } else if (!token) {
        addLog(`📢 비로그인 상태이므로 전적이 기록되지 않습니다.`, "system");
    }
  };


  // --- [핵심] 진행 로직 ---
  const proceedPhase = () => {
    // 1. 페이즈 및 날짜 변경
    let nextPhase = phase === 'morning' ? 'night' : 'morning';
    let nextDay = day;
    if (phase === 'night') nextDay++;
    
    setDay(nextDay);
    setPhase(nextPhase);
    addLog(`=== ${nextPhase === 'morning' ? '🌞' : '🌙'} ${nextDay}일차 ${nextPhase === 'morning' ? '아침' : '밤'}이 되었습니다 ===`, "day-header");

    // 2. 금지구역 데미지 (설정값 사용)
    const sdTurn = settings.suddenDeathTurn || 5;
    const areaDamage = day >= (settings.forbiddenZoneStartDay || 3) 
                     ? (day * (settings.forbiddenZoneDamageBase || 1.5)) 
                     : 0;
    
    if (areaDamage > 0) {
        addLog(`⚠️ 금지구역이 좁혀집니다! 모든 생존자가 체력을 잃습니다. (HP -${areaDamage})`, "system");
    }

    let updatedSurvivors = survivors.map(s => {
        let updated = updateEffects(s);
        updated.hp -= areaDamage; 

        if (updated.hp <= 0 && s.hp > 0) {
            addLog(`💀 [${s.name}]이(가) 금지구역을 벗어나지 못하고 사망했습니다.`, "death");
            setDead(prev => [...prev, updated]);
        }
        return updated;
    }).filter(s => s.hp > 0);

    // 확률 보정
    const battleProb = Math.min(0.8, 0.3 + (day * 0.05));
    const eventProb = Math.min(0.95, battleProb + 0.3);

    let todaysSurvivors = [...updatedSurvivors].sort(() => Math.random() - 0.5);
    let survivorMap = new Map(todaysSurvivors.map(s => [s._id, s]));
    let newDeadIds = [];

    // ★ 임시 킬 카운트 (이번 턴에 발생한 킬을 모아서 한 번에 업데이트)
    let roundKills = {}; 

    // 3. 메인 루프
    while (todaysSurvivors.length > 0) {
        let actor = todaysSurvivors.pop();
        actor = survivorMap.get(actor._id);

        if (newDeadIds.includes(actor._id) || actor.hp <= 0) continue;

        // 아이템 사용
        if (actor.hp < 60 && actor.inventory?.length > 0) {
            const itemIndex = actor.inventory.findIndex(i => i.type === 'food' || i.tags?.includes('heal'));
            if (itemIndex > -1) {
                const itemToUse = actor.inventory[itemIndex];
                const effect = applyItemEffect(actor, itemToUse);
                addLog(effect.log, "highlight"); 
                actor.hp = Math.min(100, actor.hp + effect.recovery);
                actor.inventory.splice(itemIndex, 1);
                survivorMap.set(actor._id, actor);
            }
        }

        const potentialTargets = todaysSurvivors.filter(t => !newDeadIds.includes(t._id));
        const canDual = potentialTargets.length > 0;
        const rand = Math.random();

        if (canDual && rand < battleProb) { 
            // [⚔️ 전투]
            const targetOrg = potentialTargets[0];
            const target = survivorMap.get(potentialTargets[0]._id);
            
            // 상대방 행동권 사용
            const targetIndex = todaysSurvivors.findIndex(t => t._id === target._id);
            if (targetIndex > -1) todaysSurvivors.splice(targetIndex, 1);
            
            // ★ [수정] settings(가중치)를 전달하여 전투 계산
            const battleResult = calculateBattle(actor, target, day, settings); 
            
            addLog(battleResult.log, battleResult.type);

            if (battleResult.winner) {
                const loser = battleResult.winner._id === actor._id ? target : actor;
                const winnerId = battleResult.winner._id;

                loser.hp = 0;
                newDeadIds.push(loser._id);
                setDead(prev => [...prev, loser]);
                
                // ★ [핵심] 킬 카운트 누적 (즉시 상태 업데이트 하면 루프 안에서 꼬일 수 있으므로 모았다가 함)
                roundKills[winnerId] = (roundKills[winnerId] || 0) + 1;
            }

        } else if (canDual && rand < eventProb) {
            // [🤝 2인 이벤트]
            const targetOrg = potentialTargets[0];
            const target = survivorMap.get(targetOrg._id);
            const targetIndex = todaysSurvivors.findIndex(t => t._id === target._id);
            if (targetIndex > -1) todaysSurvivors.splice(targetIndex, 1);

            let availableEvents = events.filter(e => e.text.includes("{2}") && e.type !== 'death');
            if (availableEvents.length === 0) availableEvents = events;
            
            const randomEvent = availableEvents[Math.floor(Math.random() * availableEvents.length)];
            const eventText = randomEvent.text.replace(/\{1\}/g, `[${actor.name}]`).replace(/\{2\}/g, `[${target.name}]`);
            addLog(eventText, "normal");

        } else {
            // [🌳 1인 이벤트]
            const eventResult = generateDynamicEvent(actor, nextDay);
            addLog(eventResult.log, eventResult.damage > 0 ? "highlight" : "normal");

            if (eventResult.newItem && (actor.inventory || []).length < 3) {
                actor.inventory = [...(actor.inventory || []), eventResult.newItem];
            }
            if (eventResult.damage) actor.hp -= eventResult.damage;
            if (eventResult.recovery) actor.hp = Math.min(100, actor.hp + eventResult.recovery);
            if (eventResult.newEffect) {
                actor.activeEffects = [...(actor.activeEffects || []), eventResult.newEffect];
            }

            if (actor.hp <= 0) {
                addLog(`💀 [${actor.name}]이(가) 사고로 사망했습니다.`, "death");
                newDeadIds.push(actor._id);
                setDead(prev => [...prev, actor]);
            }
        }
        survivorMap.set(actor._id, actor);
    }

    // 4. ★ 수정: 킬 카운트 객체를 미리 만들어서 저장하고, finishGame에도 넘겨줌
    const updatedKillCounts = { ...killCounts }; // 기존 킬 복사
    Object.keys(roundKills).forEach(killerId => {
        updatedKillCounts[killerId] = (updatedKillCounts[killerId] || 0) + roundKills[killerId];
    });

    setKillCounts(updatedKillCounts); // 화면 업데이트용 (비동기)

    // 5. 생존자 업데이트
    const finalStepSurvivors = Array.from(survivorMap.values()).filter(s => !newDeadIds.includes(s._id));
    setSurvivors(finalStepSurvivors);

    if (finalStepSurvivors.length <= 1) {
        // ★ 핵심 수정: 방금 만든 따끈따끈한 updatedKillCounts를 직접 넘겨줌
        finishGame(finalStepSurvivors, updatedKillCounts);
    }
  };

  return (
    <main>
      <header>
        <section id="header-id1">
          <ul>
            <li><Link href="/" className="logo-btn">
                <div className="text-logo"><span className="logo-top">PROJECT</span><span className="logo-main">ARENA</span></div>
            </Link></li>
            <li><Link href="/">메인</Link></li>
            <li><Link href="/characters">캐릭터 설정</Link></li>
            <li><Link href="/details">캐릭터 상세설정</Link></li>
            <li><Link href="/events">이벤트 설정</Link></li>
            <li><Link href="/modifiers">보정치 설정</Link></li>
            <li><Link href="/simulation" style={{color:'#0288d1'}}>▶ 게임 시작</Link></li>
          </ul>
        </section>
      </header>

      <div className="simulation-container">
        {/* 생존자 현황판 */}
        <aside className="survivor-board">
          <h2>생존자 ({survivors.length}명)</h2>
          <div className="survivor-grid">
            {survivors.map(char => (
                <div key={char._id} className="survivor-card alive">
                <img src={char.previewImage || '/Images/default_image.png'} alt={char.name} />
                <span>{char.name}</span>
                <div className="skill-tag">⭐ {char.specialSkill?.name || "기본 공격"}</div>
                
                <div className="inventory-summary">
                    <span className="bag-icon">🎒</span>
                    <span className="inv-count">{char.inventory?.length || 0}/3</span>
                    <div className="inv-tooltip">
                        {char.inventory?.map((item, i) => (
                            <div key={i} className="inv-item-mini">
                                {item.type === 'food' ? '🍎' : item.type === 'weapon' ? '⚔️' : '📦'} {item.text}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ★ 킬 수 배지 (실시간 업데이트) */}
                {killCounts[char._id] > 0 && <span className="kill-badge">⚔️{killCounts[char._id]}</span>}

                <div className="status-effects-container">
                    {char.activeEffects?.map(eff => (
                    <span key={eff.name} title={eff.name} className="effect-icon">
                        {eff.name === "식중독" ? "🤢" : "🤕"}
                    </span>
                    ))}
                </div>
                </div>
            ))}
            </div>
          <h2 style={{marginTop:'30px', color:'#ff5252'}}>사망자 ({dead.length}명)</h2>
          <div className="survivor-grid">
            {dead.map(char => (
              <div key={char._id} className="survivor-card dead">
                 <img src={char.previewImage || '/Images/default_image.png'} alt={char.name} />
                 <span>{char.name}</span>
                 {killCounts[char._id] > 0 && <span className="kill-badge">⚔️{killCounts[char._id]}</span>}
              </div>
            ))}
          </div>
        </aside>

        {/* 게임 화면 */}
        <section className={`game-screen ${phase === 'morning' ? 'morning-mode' : 'night-mode'}`}>
          <div className="screen-header">
             <h1>{day === 0 ? "GAME READY" : `DAY ${day} - ${phase === 'morning' ? 'MORNING' : 'NIGHT'}`}</h1>
             <span className="weather-badge">{phase === 'morning' ? '☀ 맑음' : '🌙 밤'}</span>
          </div>
          <div className="log-window">
            {logs.map((log) => (
              <div key={log.id} className={`log-message ${log.type}`}>{log.text}</div>
            ))}
            <div ref={logEndRef} />
          </div>
          <div className="control-panel">
            {isGameOver ? (
              <button className="btn-restart" onClick={() => window.location.reload()}>🔄 다시 하기</button>
            ) : (
              <button 
                className="btn-proceed" 
                onClick={proceedPhase} 
                disabled={loading || (day === 0 && survivors.length < 2)} 
                style={{opacity: (loading || (day === 0 && survivors.length < 2)) ? 0.5 : 1}}
              >
                {loading ? "⏳ 로딩 중..." : 
                 (survivors.length < 2 && day === 0) ? "⚠️ 인원 부족 (2명↑)" : 
                 day === 0 ? "🔥 게임 시작" : 
                 (survivors.length <= 1) ? "🏆 결과 확인하기" :
                 phase === 'morning' ? "🌙 밤으로 진행" : "🌞 다음 날 아침으로 진행"}
              </button>
            )}
          </div>
        </section>
      </div>

      {/* 결과 모달창 */}
      {showResultModal && (
        <div className="result-modal-overlay">
            <div className="result-modal">
                <h1>🏆 게임 종료 🏆</h1>
                {winner ? (
                    <div className="winner-section">
                        <img src={winner.previewImage} alt="우승자" className="winner-img"/>
                        <h2>{winner.name}</h2>
                        <p>최후의 1인! 생존을 축하합니다!</p>
                    </div>
                ) : (
                    <h2>생존자가 없습니다...</h2>
                )}

                <div className="stats-summary">
                    <h3>⚔️ 킬 랭킹 (Top 3)</h3>
                    <ul>
                        {[...survivors, ...dead]
                            .sort((a, b) => (killCounts[b._id] || 0) - (killCounts[a._id] || 0))
                            .slice(0, 3)
                            .map((char, idx) => (
                                <li key={char._id}>
                                    <span>{idx+1}위. {char.name}</span>
                                    <strong>{killCounts[char._id] || 0} 킬</strong>
                                </li>
                            ))
                        }
                    </ul>
                </div>
                <button className="close-btn" onClick={() => setShowResultModal(false)}>닫기</button>
            </div>
        </div>
      )}
    </main>
  );
}