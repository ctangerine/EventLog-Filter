import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isDt, norm, fmtDt, PAGE_SIZE } from '../config';
import EventDetail from './EventDetail';
import Modal, { ModalHead } from './Modal';

export default function QueryTab({
  sid,
  dict,
  events,
  setEvents,
  runQueryApi,
}) {
  const [eidInput, setEidInput] = useState('');
  const [eidConfirmed, setEidConfirmed] = useState(null);
  const [showSugg, setShowSugg] = useState(false);
  const [filters, setFilters] = useState({});
  const [searchAny, setSearchAny] = useState('');
  const [querying, setQuerying] = useState(false);
  const [queryMsg, setQueryMsg] = useState('');
  const [page, setPage] = useState(1);
  const [eventPopup, setEventPopup] = useState(null);
  const suggRef = useRef(null);

  // close suggestions on outside click
  useEffect(() => {
    const h = (e) => {
      if (suggRef.current && !suggRef.current.contains(e.target)) setShowSugg(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* derived */
  const dictMap = useMemo(() => {
    const m = new Map();
    dict.forEach((d) => m.set(String(d.event_id), d));
    return m;
  }, [dict]);

  const suggestions = useMemo(() => {
    const k = eidInput.trim().toLowerCase();
    const src = k
      ? dict.filter(
          (d) =>
            String(d.event_id).toLowerCase().includes(k) ||
            String(d.event_description || '').toLowerCase().includes(k)
        )
      : dict;
    return src.slice(0, 12);
  }, [eidInput, dict]);

  const activeDef = useMemo(
    () => (eidConfirmed != null ? dictMap.get(String(eidConfirmed)) : null),
    [eidConfirmed, dictMap]
  );

  const allFilterFields = useMemo(() => {
    if (!activeDef) return [];
    const sys = (activeDef.system_fields || []).filter((f) => f !== 'event_id');
    const dyn = activeDef.props || [];
    return [
      ...sys.map((f) => ({ name: f, group: 'system' })),
      ...dyn.map((f) => ({ name: f, group: 'dynamic' })),
    ];
  }, [activeDef]);

  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const pageEvents = events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* actions */
  const confirmEid = (id) => {
    const v = id ?? eidInput;
    if (!v && v !== 0) return;
    const n = norm(v);
    setEidConfirmed(n);
    setEidInput(String(n));
    setShowSugg(false);
    setFilters({});
    setEvents([]);
    setPage(1);
    setQueryMsg('');
  };

  const setFV = (f, k, v) =>
    setFilters((p) => ({ ...p, [f]: { ...(p[f] || {}), [k]: v } }));

  const runQuery = async () => {
    if (!sid || eidConfirmed == null) {
      setQueryMsg('Xác nhận event_id trước.');
      return;
    }
    const pl = { event_id: [norm(eidConfirmed)] };
    if (searchAny.trim()) {
      pl.search_any = searchAny.trim();
    }
    Object.entries(filters).forEach(([f, c]) => {
      if (!c) return;
      if (c.type === 'datetime') {
        const o = {};
        if (c.gte) o.gte = fmtDt(c.gte);
        if (c.lte) o.lte = fmtDt(c.lte);
        if (Object.keys(o).length) pl[f] = o;
      } else {
        const vs = String(c.value || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map(norm);
        if (vs.length) pl[f] = vs;
      }
    });
    setQuerying(true);
    setQueryMsg('Đang query…');
    try {
      const ev = await runQueryApi(pl);
      setEvents(ev);
      setPage(1);
      setQueryMsg(`${ev.length} kết quả.`);
    } catch {
      setQueryMsg('Lỗi kết nối.');
    } finally {
      setQuerying(false);
    }
  };

  const clearAll = () => {
    setFilters({});
    setEvents([]);
    setPage(1);
    setQueryMsg('');
  };

  return (
    <main className="q-layout">
      {/* ── LEFT: filters ── */}
      <aside className="q-side">
        <div className="q-side-top">
          <h3>Filters</h3>
          {eidConfirmed != null && <span className="eid-pill">{eidConfirmed}</span>}
        </div>

        {/* Event ID picker */}
        <div className="eid-picker" ref={suggRef}>
          <label>Event ID</label>
          <div className="eid-input-wrap">
            <input
              value={eidInput}
              onChange={(e) => { setEidInput(e.target.value); setShowSugg(true); }}
              onFocus={() => setShowSugg(true)}
              placeholder="Nhập hoặc chọn…"
            />
            <button className="btn primary xs" onClick={() => confirmEid()}>
              OK
            </button>
          </div>
          {showSugg && suggestions.length > 0 && (
            <ul className="sugg">
              {suggestions.map((s) => (
                <li key={s.event_id} onClick={() => confirmEid(s.event_id)}>
                  <b>{s.event_id}</b>
                  <span>{s.event_description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {activeDef ? (
          <>
            <p className="guide">
              Phân tách nhiều giá trị bằng dấu phẩy. Field ngày giờ dùng khoảng Từ–Đến.
            </p>
            <div className="f-item" style={{ marginBottom: 16 }}>
              <label>Search Any</label>
              <input
                type="text"
                placeholder="Search across all fields..."
                value={searchAny}
                onChange={(e) => setSearchAny(e.target.value)}
              />
            </div>
            <div className="f-grid">
              {allFilterFields.map(({ name, group }) => {
                const dt = isDt(name);
                const c = filters[name] || {};
                return (
                  <div className={`f-item${dt ? ' full-row' : ''}`} key={name}>
                    <label>
                      {name}
                      <span className={`tag ${group}`}>
                        {group === 'system' ? 'SYS' : 'DYN'}
                      </span>
                    </label>
                    {dt ? (
                      <div className="dt-row">
                        <input
                          type="datetime-local"
                          value={c.gte || ''}
                          onChange={(e) => setFV(name, 'gte', e.target.value)}
                          onFocus={() => setFV(name, 'type', 'datetime')}
                        />
                        <span className="dt-sep">→</span>
                        <input
                          type="datetime-local"
                          value={c.lte || ''}
                          onChange={(e) => setFV(name, 'lte', e.target.value)}
                          onFocus={() => setFV(name, 'type', 'datetime')}
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder="vd: admin, guest"
                        value={c.value || ''}
                        onChange={(e) => {
                          setFV(name, 'value', e.target.value);
                          setFV(name, 'type', 'text');
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="f-actions">
              <button className="btn primary" onClick={runQuery} disabled={querying}>
                {querying ? 'Querying…' : 'Run Query'}
              </button>
              <button className="btn ghost" onClick={clearAll}>
                Clear
              </button>
            </div>
          </>
        ) : (
          <p className="muted">Chọn Event ID phía trên để bắt đầu.</p>
        )}
        {queryMsg && <p className="q-msg">{queryMsg}</p>}
      </aside>

      {/* ── RIGHT: results ── */}
      <section className="q-main">
        <div className="q-head">
          <h3>Results <span className="badge">{events.length}</span></h3>
          <div className="pgr">
            <button className="btn ghost xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <span>{page} / {totalPages}</span>
            <button className="btn ghost xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        </div>

        {pageEvents.length === 0 ? (
          <p className="muted center">Chưa có kết quả.</p>
        ) : (
          <div className="r-grid">
            {pageEvents.map((ev, i) => (
              <article
                className="r-card"
                key={ev.id ?? `${ev.record_id}-${i}`}
                onClick={() => setEventPopup(ev)}
              >
                <div className="rc-top">
                  <span className="rc-id">{ev.event_id}</span>
                  <span className="rc-time">{ev.time_created || ''}</span>
                </div>
                <p className="rc-desc">{ev.event_description || '—'}</p>
                <div className="rc-foot">
                  <span title="Computer">{ev.computer || ''}</span>
                  <span title="Log">{ev.event_log_name || ''}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Event detail modal */}
      <Modal open={!!eventPopup} onClose={() => setEventPopup(null)} className="lg">
        {eventPopup && (
          <>
            <ModalHead
              title={`Event Detail — ${eventPopup.event_id}`}
              onClose={() => setEventPopup(null)}
            />
            <EventDetail ev={eventPopup} />
          </>
        )}
      </Modal>
    </main>
  );
}
