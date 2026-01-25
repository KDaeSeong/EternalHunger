'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import '../../styles/Home.css'; 

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({ 
    text: "", type: "normal", survivorCount: 1, victimCount: 0, timeOfDay: "both" 
  });
  
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ 
    text: "", type: "normal", survivorCount: 1, victimCount: 0, timeOfDay: "both" 
  });
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
        alert("로그인이 필요한 기능입니다. 로그인 페이지로 이동합니다.");
        window.location.href = '/login';
        return;
    }
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get('https://eternalhunger-e7z1.onrender.com/api/events', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEvents(res.data);
    } catch (err) { console.error(err); }
  };

  const addEvent = async () => {
    const token = localStorage.getItem('token');
    if (!newEvent.text) return alert("내용을 입력해주세요!");
    try {
      await axios.post('https://eternalhunger-e7z1.onrender.com/api/events/add', newEvent, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchEvents(); 
      setNewEvent({ text: "", type: "normal", survivorCount: 1, victimCount: 0, timeOfDay: "both" }); 
    } catch (err) { alert("추가 실패!"); }
  };

  const deleteEvent = async (id) => {
    const token = localStorage.getItem('token');
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await axios.delete(`https://eternalhunger-e7z1.onrender.com/api/events/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchEvents();
    } catch (err) { alert("삭제 실패!"); }
  };

  const startEditing = (evt) => {
    setEditingId(evt._id);
    // ★ 수정 폼을 채울 때 timeOfDay도 반드시 넣어주세요!
    setEditForm({ 
      text: evt.text, 
      type: evt.type, 
      survivorCount: evt.survivorCount || 1, 
      victimCount: evt.victimCount || 0,
      timeOfDay: evt.timeOfDay || 'both' // 추가
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({ text: "", type: "normal", survivorCount: 1, victimCount: 0, timeOfDay: "both" });
  };

  const saveEdit = async (id) => {
    const token = localStorage.getItem('token');
    try {
      await axios.put(`https://eternalhunger-e7z1.onrender.com/api/events/${id}`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditingId(null);
      fetchEvents();
    } catch (err) { alert("수정 실패!"); }
  };

  const handleOnDragEnd = async (result) => {
    if (!result.destination) return;
    const token = localStorage.getItem('token');
    const items = Array.from(events);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setEvents(items);
    try {
      await axios.put('https://eternalhunger-e7z1.onrender.com/api/events/reorder', items, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchEvents(); 
    } catch (err) { alert("순서 저장 실패!"); }
  };

  const addTag = (tag) => setNewEvent(prev => ({ ...prev, text: prev.text + tag }));
  const handleLogout = () => { if (confirm("로그아웃?")) { localStorage.clear(); window.location.reload(); } };

  return (
    <main>
      <header>
        <section id="header-id1">
          <ul>
            <li><Link href="/" className="logo-btn"><div className="text-logo"><span className="logo-top">PROJECT</span><span className="logo-main">ARENA</span></div></Link></li>
            <li><Link href="/">메인</Link></li>
            <li><Link href="/characters">캐릭터 설정</Link></li>
            <li><Link href="/details">캐릭터 상세설정</Link></li>
            <li><Link href="/events" style={{color:'#0288d1'}}>이벤트 설정</Link></li>
            <li><Link href="/modifiers">보정치 설정</Link></li>
            <li><Link href="/simulation" style={{fontWeight:'bold'}}>▶ 게임 시작</Link></li>
            <li className="auth-menu">{user ? <div className="user-info"><span>👤 <strong>{user.username}</strong>님</span><button className="logout-btn" onClick={handleLogout}>🚪 로그아웃</button></div> : <div className="auth-btns"><Link href="/login" className="login-btn">🔑 로그인</Link></div>}</li>
          </ul>
        </section>
      </header>

      <div className="page-header">
        <h1>이벤트(시나리오) 설정</h1>
        <p>L(생존자)와 D(사망자) 변수 및 시간대를 설정하여 정교한 사건을 정의하세요.</p>
      </div>

      <div style={{maxWidth: '900px', margin: '0 auto'}}>
        {/* 신규 등록 폼 */}
        <div style={{background: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 5px 15px rgba(0,0,0,0.05)', marginBottom: '30px'}}>
          <div style={{display: 'flex', gap: '20px', marginBottom: '15px', padding: '15px', background: '#f8f9fa', borderRadius: '10px', alignItems:'center'}}>
            <div><label style={{fontWeight: 'bold', fontSize: '0.9rem'}}>🟢 생존자: </label>
              <select value={newEvent.survivorCount} onChange={e => setNewEvent({...newEvent, survivorCount: Number(e.target.value)})}>
                {[1, 2, 3].map(n => <option key={n} value={n}>{n}명</option>)}
              </select>
            </div>
            <div><label style={{fontWeight: 'bold', fontSize: '0.9rem'}}>💀 사망자: </label>
              <select value={newEvent.victimCount} onChange={e => setNewEvent({...newEvent, victimCount: Number(e.target.value)})}>
                {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n}명</option>)}
              </select>
            </div>
            <div><label style={{fontWeight: 'bold', fontSize: '0.9rem'}}>🕒 시간대: </label>
              <select value={newEvent.timeOfDay} onChange={e => setNewEvent({...newEvent, timeOfDay: e.target.value})}>
                <option value="both">☀️🌙 무관</option>
                <option value="day">☀️ 낮</option>
                <option value="night">🌙 밤</option>
              </select>
            </div>
          </div>

          <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
            <select value={newEvent.type} onChange={(e) => setNewEvent({...newEvent, type: e.target.value})} style={{padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontWeight: 'bold'}}>
              <option value="normal">일반 (생존)</option><option value="death">💀 사망</option>
            </select>
            <input type="text" placeholder="예: L1이 D1을 처치했습니다." value={newEvent.text} onChange={(e) => setNewEvent({...newEvent, text: e.target.value})} style={{flexGrow: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd'}} />
            <button onClick={addEvent} style={{padding: '12px 25px', background: '#4185b3', color: 'white', borderRadius: '8px', fontWeight: 'bold'}}>추가</button>
          </div>

          <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
            <div style={{display:'flex', gap:'5px'}}><span style={{fontSize:'0.85rem', fontWeight:'bold', color:'#2e7d32'}}>생존자:</span>
              {[...Array(newEvent.survivorCount)].map((_, i) => <button key={i} onClick={() => addTag(`L${i+1}`)} style={{padding:'5px 12px', background:'#e8f5e9', border:'1px solid #4caf50', borderRadius:'5px', cursor:'pointer'}}>L{i+1}</button>)}
            </div>
            <div style={{display:'flex', gap:'5px'}}><span style={{fontSize:'0.85rem', fontWeight:'bold', color:'#c62828'}}>사망자:</span>
              {[...Array(newEvent.victimCount)].map((_, i) => <button key={i} onClick={() => addTag(`D${i+1}`)} style={{padding:'5px 12px', background:'#ffebee', border:'1px solid #f44336', borderRadius:'5px', cursor:'pointer'}}>D{i+1}</button>)}
            </div>
          </div>
        </div>

        {/* 이벤트 리스트  */}
        <DragDropContext onDragEnd={handleOnDragEnd}>
          <Droppable droppableId="eventsList">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                {events.map((evt, index) => (
                  <Draggable key={evt._id} draggableId={evt._id} index={index}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                        style={{ ...provided.draggableProps.style, background: editingId === evt._id ? '#e3f2fd' : (evt.type === 'death' ? '#fff0f0' : 'white'), padding: '15px', borderRadius: '10px', border: '1px solid #eee', borderLeft: editingId === evt._id ? '5px solid #2196f3' : (evt.type === 'death' ? '5px solid #ff5252' : '5px solid #4caf50'), marginBottom: '10px' }}>
                        
                        {editingId === evt._id ? (
                          <div style={{display: 'flex', flexDirection: 'column', gap: '10px', width: '100%'}}>
                            <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                              <select value={editForm.survivorCount} onChange={e => setEditForm({...editForm, survivorCount: Number(e.target.value)})}>{[1,2,3].map(n => <option key={n} value={n}>L:{n}</option>)}</select>
                              <select value={editForm.victimCount} onChange={e => setEditForm({...editForm, victimCount: Number(e.target.value)})}>{[0,1,2,3].map(n => <option key={n} value={n}>D:{n}</option>)}</select>
                              <select value={editForm.timeOfDay} onChange={e => setEditForm({...editForm, timeOfDay: e.target.value})}><option value="both">☀️🌙</option><option value="day">☀️</option><option value="night">🌙</option></select>
                              <select value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})}><option value="normal">일반</option><option value="death">💀 사망</option></select>
                            </div>
                            <div style={{display: 'flex', gap: '10px'}}>
                              <input style={{flexGrow: 1, padding: '8px'}} value={editForm.text} onChange={e => setEditForm({...editForm, text: e.target.value})} />
                              <button onClick={() => saveEdit(evt._id)} style={{background: '#4caf50', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '5px', cursor:'pointer'}}>저장</button>
                              <button onClick={cancelEditing} style={{background: '#9e9e9e', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '5px', cursor:'pointer'}}>취소</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
                            <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                              <span style={{color: '#ccc'}}>⋮⋮</span>
                              <span style={{fontSize: '1.2rem'}}>{evt.timeOfDay === 'day' ? '☀️' : evt.timeOfDay === 'night' ? '🌙' : '🌓'}</span>
                              <span style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#999'}}>{evt.survivorCount}L : {evt.victimCount}D</span>
                              <span style={{fontWeight: '500'}}>{evt.text}</span>
                            </div>
                            <div style={{display:'flex', gap:'8px'}}>
                              <button onClick={() => startEditing(evt)} style={{background: '#e0e0e0', color: '#555', border: 'none', padding: '5px 12px', borderRadius: '5px', fontWeight:'bold', cursor:'pointer'}}>✏️ 수정</button>
                              <button onClick={() => deleteEvent(evt._id)} style={{background: '#ff5252', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '5px', fontWeight:'bold', cursor:'pointer'}}>삭제</button>
                            </div>
                          </div>
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
      </div>
    </main>
  );
}