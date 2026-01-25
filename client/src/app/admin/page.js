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

    const fetchItems = async () => { /* 기존 아이템 로드 로직 */ };
    
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
        <div style={{padding: '50px', maxWidth: '1200px', margin: '0 auto', backgroundColor: '#f4f1ea'}}>
            <h1 style={{color: '#d9534f', textAlign: 'center'}}>🚨 PROJECT ARENA 개발자 도구</h1>
            
            {/* 상단: 기본 관리 & 아이템 생성 (기존 유지) */}
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                {/* ... 기존 LP관리 & 아이템 생성 폼 ... */}
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