'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [logs, setLogs] = useState([]);
    const router = useRouter();

    useEffect(() => {
        const checkAdmin = async () => {
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('user'));
            
            // 간단하게 로컬 정보로 1차 체크 (보안은 서버에서 2차 체크)
            if (!token || !user?.isAdmin) {
                alert("접근 권한이 없습니다.");
                router.push('/'); // 추방
                return;
            }
            setIsAdmin(true);
        };
        checkAdmin();
    }, []);

    const callAdminApi = async (url, data = {}) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`http://localhost:5000/api/admin${url}`, data, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(res.data.message);
            setLogs(prev => [`[성공] ${res.data.message}`, ...prev]);
        } catch (err) {
            alert("실패: " + (err.response?.data?.error || err.message));
        }
    };

    if (!isAdmin) return <div>접근 확인 중...</div>;

    return (
        <div style={{padding: '50px', maxWidth: '800px', margin: '0 auto'}}>
            <h1 style={{color: 'red'}}>🚨 관리자 전용 페이지 (Developer Tools)</h1>
            
            <div style={{display: 'flex', gap: '20px', marginTop: '30px'}}>
                {/* 기능 1: 시즌 초기화 */}
                <div style={{border: '1px solid #ccc', padding: '20px', borderRadius: '10px'}}>
                    <h3>💀 시즌 초기화</h3>
                    <p>모든 유저의 LP를 0으로 만듭니다.</p>
                    <button 
                        onClick={() => {
                            if(confirm("정말 모든 데이터를 날리시겠습니까?")) callAdminApi('/reset-lp');
                        }}
                        style={{background: 'red', color: 'white', padding: '10px', border: 'none', cursor: 'pointer'}}
                    >
                        실행 (되돌릴 수 없음)
                    </button>
                </div>

                {/* 기능 2: LP 지급 */}
                <div style={{border: '1px solid #ccc', padding: '20px', borderRadius: '10px'}}>
                    <h3>🎁 LP 선물하기</h3>
                    <input id="targetUser" placeholder="유저 닉네임" style={{display:'block', marginBottom:'10px', padding:'5px'}} />
                    <input id="lpAmount" type="number" placeholder="지급량" style={{width:'80px', padding:'5px'}} />
                    <button 
                        onClick={() => {
                            const username = document.getElementById('targetUser').value;
                            const amount = document.getElementById('lpAmount').value;
                            callAdminApi('/give-lp', { username, amount: Number(amount) });
                        }}
                        style={{background: 'blue', color: 'white', padding: '10px', marginLeft:'10px', border: 'none', cursor: 'pointer'}}
                    >
                        지급
                    </button>
                </div>
            </div>

            <div style={{marginTop: '50px', background: '#f0f0f0', padding: '20px'}}>
                <h4>📜 관리자 로그</h4>
                {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
        </div>
    );
}