import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BE, SK_SESSION, SK_DICT } from './config';
import DictionaryTab from './components/DictionaryTab';
import QueryTab from './components/QueryTab';
import SystemDictTab from './components/SystemDictTab';

export default function App() {
  const [sid, setSid] = useState('');
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [dict, setDict] = useState([]);
  const [tab, setTab] = useState('dict');
  const [events, setEvents] = useState([]);

  /* fetch a brand-new session from BE */
  const spawnSession = useCallback(async () => {
    try {
      const r = await fetch(`${BE}/get_session`);
      const j = await r.json();
      if (j?.session_id) {
        setSid(j.session_id);
        localStorage.setItem(SK_SESSION, j.session_id);
        // reset state for new session
        setDict([]);
        setEvents([]);
        setUploadMsg('');
        localStorage.removeItem(SK_DICT);
        if (fileRef.current) fileRef.current.value = '';
      }
    } catch {
      setUploadMsg('BE offline.');
    }
  }, []);

  /* bootstrap session + cached dict */
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(SK_DICT) || '[]');
      if (Array.isArray(d) && d.length) setDict(d);
    } catch {}
    const s = localStorage.getItem(SK_SESSION);
    if (s) { setSid(s); return; }
    spawnSession();
  }, [spawnSession]);

  /* upload handler */
  const upload = useCallback(async () => {
    if (!sid) { setUploadMsg('Session chưa sẵn sàng.'); return; }
    const fl = fileRef.current?.files;
    if (!fl || !fl.length) { setUploadMsg('Chọn file .evtx trước.'); return; }
    const fd = new FormData();
    fd.append('session_id', sid);
    for (let i = 0; i < fl.length; i++) fd.append('files', fl[i]);
    setUploading(true);
    setUploadMsg('Đang upload…');
    try {
      const r = await fetch(`${BE}/upload`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) { setUploadMsg(j?.error || 'Thất bại.'); return; }
      const nd = Array.isArray(j?.dictionary) ? j.dictionary : [];
      setDict(nd);
      localStorage.setItem(SK_DICT, JSON.stringify(nd));
      setUploadMsg(`OK — ${nd.length} event IDs.`);
    } catch {
      setUploadMsg('Lỗi kết nối.');
    } finally {
      setUploading(false);
    }
  }, [sid]);

  /* query API — called by QueryTab */
  const runQueryApi = useCallback(async (payload) => {
    const r = await fetch(`${BE}/filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sid, filters: payload }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || 'Query thất bại.');
    return Array.isArray(j?.events) ? j.events : [];
  }, [sid]);

  return (
    <div className="shell">
      {/* Decorative gradient blobs */}
      <div className="bg-blob blob-1" />
      <div className="bg-blob blob-2" />

      <header className="appbar">
        <span className="logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          EventLog Filter
        </span>
        <nav className="tabs">
          <button className={`tab-btn${tab === 'dict' ? ' on' : ''}`} onClick={() => setTab('dict')}>
            Dictionary
          </button>
          <button className={`tab-btn${tab === 'query' ? ' on' : ''}`} onClick={() => setTab('query')}>
            Query
          </button>
          <button className={`tab-btn${tab === 'sys' ? ' on' : ''}`} onClick={() => setTab('sys')}>
            System Dict
          </button>
        </nav>
        <button className="btn outline xs" style={{ marginLeft: 'auto' }} onClick={spawnSession} title="Tạo session mới, xóa dữ liệu cũ">
          + New Session
        </button>
      </header>

      {tab === 'dict' && (
        <DictionaryTab
          dict={dict}
          fileRef={fileRef}
          upload={upload}
          uploading={uploading}
          uploadMsg={uploadMsg}
        />
      )}

      {tab === 'query' && (
        <QueryTab
          sid={sid}
          dict={dict}
          events={events}
          setEvents={setEvents}
          runQueryApi={runQueryApi}
        />
      )}

      {tab === 'sys' && <SystemDictTab />}
    </div>
  );
}