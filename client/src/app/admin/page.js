'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [logs, setLogs] = useState([]);
    const [itemList, setItemList] = useState([]);
    const [mapList, setMapList] = useState([]); // 맵 목록 메모리
    
    // 폼 상태들
    const [itemForm, setItemForm] = useState({ name: '', type: '무기', stats: { atk: 0, def: 0, hp: 0 }, description: '' });
    const [mapForm, setMapForm] = useState({ name: '', description: '', image: '' });
    const [connectData, setConnectData] = useState({ map1: '', map2: '' });

    const router = useRouter();
    const API_BASE = "https://eternalhunger-e7z1.onrender.com/api/admin";

    useEffect(() => {
        const checkAdmin = async () => {
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('user'));
            if (!token || !user?.isAdmin) {
                alert("접근 권한이 없습니다.");
                router.push('/');
                return;
            }
            setIsAdmin(true);
            fetchData();
        };
        checkAdmin();
    }, []);

    const fetchData = () => {
        fetchItems();
        fetchMaps();
    };

    // 공통 API 호출 (POST/PUT)
    const callAdminApi = async (method, url, data = {}) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios({
                method,
                url: `${API_BASE}${url}`,
                data,
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(res.data.message);
            setLogs(prev => [`[성공] ${res.data.message}`, ...prev]);
            fetchData();
        } catch (err) {
            alert("실패: " + (err.response?.data?.error || err.message));
        }
    };

    // 2. 아이템 목록 불러오기 (GET)
    const fetchItems = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE}/items`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setItemList(res.data); // 메모리(itemList) 업데이트
        } catch (err) { console.error("아이템 로드 실패"); }
    };

    // 맵 목록 로드
    const fetchMaps = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE}/maps`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMapList(res.data);
        } catch (err) { console.error("맵 로드 실패"); }
    };

    if (!isAdmin) return <div>접근 확인 중...</div>;

    return (
        <div style={{padding: '50px', maxWidth: '1000px', margin: '0 auto'}}>
            <h1 style={{color: 'red'}}>🚨 관리자 전용 페이지 (Developer Tools)</h1>
            
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px'}}>
                
                {/* 기능 1: 시즌 초기화 */}
                <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                    <div style={{border: '1px solid #ccc', padding: '20px', borderRadius: '10px'}}>
                        <h3>💀 시즌 초기화</h3>
                        <p>모든 유저의 LP를 0으로 만듭니다.</p>
                        <button 
                            onClick={() => confirm("정말 초기화하시겠습니까?") && callAdminApi('/reset-lp')}
                            style={{background: 'red', color: 'white', padding: '10px', border: 'none', cursor: 'pointer', width: '100%'}}
                        > 실행 </button>
                    </div>

                    <div style={{border: '1px solid #ccc', padding: '20px', borderRadius: '10px'}}>
                        <h3>🎁 LP 선물하기</h3>
                        <input id="targetUser" placeholder="유저 닉네임" style={{display:'block', marginBottom:'10px', padding:'5px', width: '90%'}} />
                        <input id="lpAmount" type="number" placeholder="지급량" style={{padding:'5px', width: '80px'}} />
                        <button 
                            onClick={() => {
                                const username = document.getElementById('targetUser').value;
                                const amount = document.getElementById('lpAmount').value;
                                callAdminApi('/give-lp', { username, amount: Number(amount) });
                            }}
                            style={{background: 'blue', color: 'white', padding: '10px', marginLeft:'10px', border: 'none', cursor: 'pointer'}}
                        > 지급 </button>
                    </div>
                </div>

                {/* 오른쪽: 아이템 추가 기능 */}
                <div style={{border: '1px solid #ccc', padding: '20px', borderRadius: '10px', background: '#f9f9f9'}}>
                    <h3>⚔️ 신규 아이템 생성</h3>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                        <input placeholder="아이템 이름" onChange={e => setItemForm({...itemForm, name: e.target.value})} style={{padding: '8px'}} />
                        <select onChange={e => setItemForm({...itemForm, type: e.target.value})} style={{padding: '8px'}}>
                            <option value="무기">무기</option>
                            <option value="방어구">방어구</option>
                            <option value="소모품">소모품</option>
                        </select>
                        <div style={{display: 'flex', gap: '5px'}}>
                            <input type="number" placeholder="공격력" onChange={e => setItemForm({...itemForm, stats: {...itemForm.stats, atk: Number(e.target.value)}})} style={{width: '30%', padding: '5px'}} />
                            <input type="number" placeholder="방어력" onChange={e => setItemForm({...itemForm, stats: {...itemForm.stats, def: Number(e.target.value)}})} style={{width: '30%', padding: '5px'}} />
                            <input type="number" placeholder="체력" onChange={e => setItemForm({...itemForm, stats: {...itemForm.stats, hp: Number(e.target.value)}})} style={{width: '30%', padding: '5px'}} />
                        </div>
                        <textarea placeholder="아이템 상세 설명" onChange={e => setItemForm({...itemForm, description: e.target.value})} style={{padding: '8px', height: '60px'}} />
                        <button 
                            onClick={() => callAdminApi('/items', itemForm)}
                            style={{background: '#28a745', color: 'white', padding: '10px', border: 'none', cursor: 'pointer'}}
                        > 아이템 데이터베이스 등록 </button>
                    </div>
                </div>
            </div>

            <hr style={{margin: '40px 0', border: '0.5px solid #ccc'}} />

            {/* 중단: 🗺️ 월드 맵 설계 섹션 */}
            <div style={{display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px'}}>
                
                {/* 1. 구역 생성 및 동선 연결 */}
                <div style={{background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}}>
                    <h3>🗺️ 새 구역(Region) 생성</h3>
                    <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
                        <input placeholder="구역 이름 (예: 숲, 공장)" style={{flex: 1, padding: '10px'}} 
                               onChange={e => setMapForm({...mapForm, name: e.target.value})} />
                        <button onClick={() => callAdminApi('post', '/maps', mapForm)} 
                                style={{background: '#5bc0de', color: 'white', border: 'none', padding: '0 20px', cursor: 'pointer'}}>생성</button>
                    </div>

                    <h3 style={{marginTop: '30px'}}>🛤️ 동선 연결 (Waypoints)</h3>
                    <p style={{fontSize: '0.85rem', color: '#666'}}>두 구역을 연결하여 캐릭터가 이동할 수 있게 합니다.</p>
                    <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                        <select style={{padding: '10px', flex: 1}} onChange={e => setConnectData({...connectData, map1: e.target.value})}>
                            <option value="">구역 A 선택</option>
                            {mapList.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                        </select>
                        <span>↔</span>
                        <select style={{padding: '10px', flex: 1}} onChange={e => setConnectData({...connectData, map2: e.target.value})}>
                            <option value="">구역 B 선택</option>
                            {mapList.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                        </select>
                        <button onClick={() => callAdminApi('put', `/maps/${connectData.map1}/connect`, { targetMapId: connectData.map2 })}
                                style={{background: '#f0ad4e', color: 'white', border: 'none', padding: '10px 20px', cursor: 'pointer'}}>연결하기</button>
                    </div>
                </div>

                {/* 2. 현재 월드맵 상태 요약 */}
                <div style={{background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}}>
                    <h3>🌐 현재 월드 구성</h3>
                    <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                        {mapList.map(map => (
                            <div key={map._id} style={{padding: '15px', borderBottom: '1px solid #eee'}}>
                                <strong style={{fontSize: '1.1rem', color: '#337ab7'}}>{map.name}</strong>
                                <div style={{fontSize: '0.85rem', marginTop: '5px'}}>
                                    <span style={{color: '#888'}}>연결된 곳:</span> {map.connectedMaps?.length > 0 
                                        ? map.connectedMaps.map(cm => cm.name).join(', ') 
                                        : '고립된 구역'}
                                </div>
                            </div>
                        ))}
                        {mapList.length === 0 && <p style={{color: '#999'}}>등록된 구역이 없습니다.</p>}
                    </div>
                </div>
            </div>

            {/* 하단: 데이터 목록 및 로그 */}
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px'}}>
                <div style={{background: '#eee', padding: '20px', borderRadius: '10px', maxHeight: '300px', overflowY: 'auto'}}>
                    <h4>📦 현재 등록된 아이템 ({itemList.length})</h4>
                    {itemList.map(item => (
                        <div key={item._id} style={{fontSize: '0.9rem', borderBottom: '1px solid #ddd', padding: '5px 0'}}>
                            <strong>[{item.type}]</strong> {item.name} (ATK:{item.stats.atk} / DEF:{item.stats.def})
                        </div>
                    ))}
                </div>
                <div style={{background: '#333', color: '#0f0', padding: '20px', borderRadius: '10px', maxHeight: '300px', overflowY: 'auto'}}>
                    <h4>📜 시스템 로그</h4>
                    {logs.map((l, i) => <div key={i} style={{fontSize: '0.8rem'}}>{l}</div>)}
                </div>
            </div>
        </div>
    );
}