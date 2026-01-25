// client/src/app/events/page.js
'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
// 드래그 앤 드롭 라이브러리 (설치 안 되어 있으면: npm install @hello-pangea/dnd)
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import '../../styles/Home.css'; 

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({ text: "", type: "normal" });

  // 수정 모드 상태
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ text: "", type: "normal" });

  // 유저 상태
  const [user, setUser] = useState(null);

  useEffect(() => {
    // ★ 1. [보안] 토큰 검사 (문지기)
    const token = localStorage.getItem('token');
    if (!token) {
        alert("로그인이 필요한 기능입니다. 로그인 페이지로 이동합니다.");
        window.location.href = '/login'; // 강제 추방
        return;
    }

    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await axios.get('https://eternalhunger-e7z1.onrender.com/api/events');
      setEvents(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // ★ {1}, {2}... 버튼 클릭 시 텍스트 추가 함수
  const addPlaceholder = (val) => {
    setNewEvent(prev => ({ ...prev, text: prev.text + val }));
  };

  const addEvent = async () => {
    if (!newEvent.text) return alert("내용을 입력해주세요!");
    try {
      // 배열이 아닌 단일 객체로 전송
      await axios.post('https://eternalhunger-e7z1.onrender.com/api/events/add', newEvent);
      fetchEvents(); 
      setNewEvent({ text: "", type: "normal" }); 
    } catch (err) {
      alert("추가 실패!");
    }
  };

  const deleteEvent = async (id) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await axios.delete(`https://eternalhunger-e7z1.onrender.com/api/events/${id}`);
      fetchEvents(); // 삭제 후 목록 갱신 (중복된 게 있다면 각각 다른 ID일 테니 하나만 지워짐)
    } catch (err) {
      console.error(err);
      alert("삭제 실패!");
    }
  };

  const startEditing = (evt) => {
    setEditingId(evt._id);
    setEditForm({ text: evt.text, type: evt.type });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({ text: "", type: "normal" });
  };

  const saveEdit = async (id) => {
    try {
      await axios.put(`https://eternalhunger-e7z1.onrender.com/api/events/${id}`, editForm);
      setEditingId(null);
      fetchEvents();
    } catch (err) {
      alert("수정 실패!");
    }
  };

  // ★ 예제 불러오기 (개선됨: 한 번에 통신)
  const loadExamples = async () => {
    if (!confirm("기본 예제들을 추가하시겠습니까?")) return;
    
    const examples = [
      { text: "{1}이(가) 풀숲에서 잠을 잡니다.", type: "normal" },
      { text: "{1}이(가) {2}에게 짱돌을 던졌습니다.", type: "normal" },
      { text: "{1}이(가) 지뢰를 밟고 사망했습니다.", type: "death" },
      { text: "{1}이(가) {2}를 배신하고 처치했습니다!", type: "death" },
    ];

    try {
      // 하나씩 보내지 않고 배열 통째로 보냄 (서버가 Array 처리 가능해야 함)
      await axios.post('https://eternalhunger-e7z1.onrender.com/api/events/add', examples);
      fetchEvents();
    } catch (err) {
      console.error(err);
      alert("예제 추가 실패!");
    }
  };

  // client/src/app/events/page.js

  const handleOnDragEnd = async (result) => {
    if (!result.destination) return;

    // 1. 일단 화면 먼저 바꾸기 (낙관적 업데이트)
    const items = Array.from(events);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setEvents(items);

    // 2. 서버에 저장 요청
    try {
      await axios.put('https://eternalhunger-e7z1.onrender.com/api/events/reorder', items);
      
      // ★ [추가됨] 저장 성공 후, 서버에서 부여한 '새 ID'를 받아오기 위해 목록 갱신
      fetchEvents(); 
      
    } catch (err) {
      console.error("순서 저장 실패:", err);
      alert("오류가 발생했습니다. 새로고침 후 다시 시도해주세요.");
    }
  };

  // 로그아웃
  const handleLogout = () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      window.location.reload();
    }
  };

  return (
    <main>
      {/* 헤더 */}
      <header>
        <section id="header-id1">
          <ul>
            <li>
              <Link href="/" className="logo-btn">
                <div className="text-logo">
                  <span className="logo-top">PROJECT</span>
                  <span className="logo-main">ARENA</span>
                </div>
              </Link>
            </li>
            <li><Link href="/">메인</Link></li>
            <li><Link href="/characters">캐릭터 설정</Link></li>
            <li><Link href="/details">캐릭터 상세설정</Link></li>
            <li><Link href="/events">이벤트 설정</Link></li>
            <li><Link href="/modifiers">보정치 설정</Link></li>
            <li><Link href="/simulation" style={{color:'#0288d1', fontWeight:'bold'}}>▶ 게임 시작</Link></li>
            <li className="auth-menu">
              {user ? (
                <div className="user-info">
                  <span>👤 <strong>{user.username}</strong>님 (LP: {user.lp})</span>
                  <button className="logout-btn" onClick={handleLogout}>🚪 로그아웃</button>
                </div>
              ) : (
                <div className="auth-btns">
                  <Link href="/login" className="login-btn">🔑 로그인</Link>
                  <Link href="/signup" className="signup-btn">📝 회원가입</Link>
                </div>
              )}
            </li>
          </ul>
        </section>
      </header>

      <div className="page-header">
        <h1>이벤트(시나리오) 설정</h1>
        <p>게임 중에 발생할 사건들을 정의합니다. 드래그하여 순서를 바꿀 수 있습니다.</p>
      </div>

      <div style={{maxWidth: '900px', margin: '0 auto'}}>
        
        {/* 입력 폼 */}
        <div style={{
            background: 'white', padding: '25px', borderRadius: '15px', 
            boxShadow: '0 5px 15px rgba(0,0,0,0.05)', marginBottom: '30px'
        }}>
          {/* 상단: 입력 필드 */}
          <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px'}}>
            <select 
              value={newEvent.type} 
              onChange={(e) => setNewEvent({...newEvent, type: e.target.value})}
              style={{
                  padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
                  backgroundColor: 'white', color: '#333', fontSize: '1rem', minWidth: '130px', fontWeight: 'bold'
              }}
            >
              <option value="normal">일반 (생존)</option>
              <option value="death">💀 사망</option>
            </select>
            
            <input 
              type="text" 
              placeholder="예: {1}이(가) {2}에게 짱돌을 던졌습니다." 
              value={newEvent.text}
              onChange={(e) => setNewEvent({...newEvent, text: e.target.value})}
              style={{flexGrow: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd', minWidth: '250px', fontSize:'1rem'}}
            />
            <button onClick={addEvent} style={{padding: '12px 25px', background: '#4185b3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize:'1rem'}}>
              추가
            </button>
          </div>

          {/* ★ 하단: 편의 기능 버튼들 ({1}~{6}) */}
          <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
            <span style={{fontSize:'0.9rem', color:'#666', fontWeight:'bold', marginRight:'5px'}}>변수 삽입:</span>
            {['{1}', '{2}', '{3}', '{4}', '{5}', '{6}'].map((val) => (
              <button 
                key={val} 
                onClick={() => addPlaceholder(val)}
                style={{
                  padding: '5px 10px', background: '#f0f4f8', border: '1px solid #d1d9e6', 
                  borderRadius: '6px', color: '#333', cursor: 'pointer', fontWeight:'600', fontSize:'0.85rem',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#e1e8f0'}
                onMouseOut={(e) => e.target.style.background = '#f0f4f8'}
              >
                {val}
              </button>
            ))}
             <span style={{fontSize:'0.8rem', color:'#999', marginLeft:'10px'}}>(클릭 시 입력창에 추가됨)</span>
          </div>
        </div>

        {/* 이벤트 리스트 (드래그 앤 드롭) */}
        <DragDropContext onDragEnd={handleOnDragEnd}>
          <Droppable droppableId="eventsList">
            {(provided) => (
              <div 
                {...provided.droppableProps} 
                ref={provided.innerRef}
                style={{display: 'flex', flexDirection: 'column', gap: '10px'}}
              >
                {events.map((evt, index) => (
                  <Draggable key={evt._id} draggableId={evt._id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={{
                          ...provided.draggableProps.style,
                          opacity: snapshot.isDragging ? 0.8 : 1,
                          background: editingId === evt._id ? '#e3f2fd' : (evt.type === 'death' ? '#fff0f0' : 'white'),
                          padding: '15px', 
                          borderRadius: '10px', 
                          border: '1px solid #eee',
                          borderLeft: editingId === evt._id ? '5px solid #2196f3' : (evt.type === 'death' ? '5px solid #ff5252' : '5px solid #4caf50'),
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          boxShadow: snapshot.isDragging ? '0 10px 20px rgba(0,0,0,0.15)' : '0 2px 5px rgba(0,0,0,0.02)',
                          marginBottom: '10px'
                        }}
                      >
                        {/* 드래그 핸들 */}
                        <span style={{marginRight: '12px', cursor: 'grab', color: '#ccc', fontSize:'1.2rem'}}>⋮⋮</span>

                        {editingId === evt._id ? (
                           /* 수정 모드 */
                           <div style={{display: 'flex', gap: '10px', flexGrow: 1, flexWrap: 'wrap', alignItems:'center'}}>
                              <select 
                                 value={editForm.type}
                                 onChange={(e) => setEditForm({...editForm, type: e.target.value})}
                                 style={{padding: '8px', borderRadius: '5px', border: '1px solid #aaa'}}
                              >
                                 <option value="normal">일반</option>
                                 <option value="death">💀 사망</option>
                              </select>
                              <input 
                                 type="text" 
                                 value={editForm.text}
                                 onChange={(e) => setEditForm({...editForm, text: e.target.value})}
                                 style={{flexGrow: 1, padding: '8px', borderRadius: '5px', border: '1px solid #aaa'}}
                              />
                              <div style={{display:'flex', gap:'5px'}}>
                                <button onClick={() => saveEdit(evt._id)} style={{background: '#4caf50', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight:'bold'}}>저장</button>
                                <button onClick={cancelEditing} style={{background: '#9e9e9e', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight:'bold'}}>취소</button>
                              </div>
                           </div>
                        ) : (
                           /* 일반 모드 */
                           <>
                             <div style={{display:'flex', alignItems:'center', gap:'10px', flexGrow: 1}}>
                                 <span style={{
                                     fontSize: '0.8rem', padding: '3px 8px', borderRadius: '4px', 
                                     background: evt.type === 'death' ? '#ffcdd2' : '#c8e6c9',
                                     color: evt.type === 'death' ? '#b71c1c' : '#1b5e20', fontWeight: 'bold',
                                     minWidth: '50px', textAlign: 'center'
                                 }}>
                                   {evt.type === 'death' ? '💀 사망' : '일반'}
                                 </span>
                                 <span style={{color: '#333', fontWeight: '500', fontSize:'1.05rem'}}>
                                   {evt.text}
                                 </span>
                             </div>

                             <div style={{display:'flex', gap:'8px'}}>
                               <button onClick={() => startEditing(evt)} style={{background: '#e0e0e0', color: '#555', border: 'none', padding: '5px 12px', borderRadius: '5px', cursor: 'pointer', fontWeight:'bold', fontSize:'0.9rem'}}>✏️ 수정</button>
                               <button onClick={() => deleteEvent(evt._id)} style={{background: '#ff5252', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '5px', cursor: 'pointer', fontWeight:'bold', fontSize:'0.9rem'}}>삭제</button>
                             </div>
                           </>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <div style={{textAlign: 'center', margin: '40px 0'}}>
             <button onClick={loadExamples} style={{background: '#ff9800', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(255, 152, 0, 0.3)'}}>
                📂 기본 예제 불러오기
             </button>
        </div>

      </div>
    </main>
  );
}