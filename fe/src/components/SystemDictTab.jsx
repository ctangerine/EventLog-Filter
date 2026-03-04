import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BE } from '../config';
import Modal, { ModalHead } from './Modal';

const EMPTY_FORM = { event_id: '', description: '' };

export default function SystemDictTab() {
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  /* ── fetch ─────────────────────────────────────────────────── */
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BE}/dictionary/system`);
      const j = await r.json();
      if (j?.entries) {
        // Convert static object { "ID": "Desc" } to array [ { event_id: ID, description: Desc }, ... ]
        const formatted = Object.entries(j.entries).map(([id, desc]) => ({
          event_id: Number(id),
          description: desc,
        }));
        setEntries(formatted);
      }
    } catch {
      setMsg('Không thể kết nối server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  /* ── derived ────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return entries;
    return entries.filter(
      (e) =>
        String(e.event_id).includes(kw) ||
        String(e.description || '').toLowerCase().includes(kw)
    );
  }, [entries, search]);

  /* ── open form ──────────────────────────────────────────────── */
  const openAdd = () => {
    setForm(EMPTY_FORM);
    setIsEdit(false);
    setMsg('');
    setShowForm(true);
  };

  const openEdit = (entry) => {
    setForm({ event_id: String(entry.event_id), description: entry.description ?? '' });
    setIsEdit(true);
    setMsg('');
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setMsg(''); };

  /* ── save ───────────────────────────────────────────────────── */
  const save = async () => {
    if (!form.event_id.trim()) { setMsg('event_id không được để trống.'); return; }
    if (isNaN(Number(form.event_id))) { setMsg('event_id phải là số nguyên.'); return; }
    setSaving(true);
    setMsg('');
    try {
      const url = isEdit 
        ? `${BE}/dictionary/edit/${form.event_id}`
        : `${BE}/dictionary/add`;
      
      const r = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: Number(form.event_id),
          description: form.description.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok) { setMsg(j?.error || 'Lỗi không xác định.'); return; }
      closeForm();
      await fetchEntries();
    } catch {
      setMsg('Lỗi kết nối.');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') save(); };

  /* ── delete ─────────────────────────────────────────────────── */
  const del = async (event_id) => {
    if (!window.confirm(`Xóa entry event_id = ${event_id}?`)) return;
    try {
      await fetch(`${BE}/dictionary/delete/${event_id}`, { method: 'DELETE' });
      setEntries((prev) => prev.filter((e) => e.event_id !== event_id));
    } catch {
      alert('Xóa thất bại.');
    }
  };

  /* ── render ─────────────────────────────────────────────────── */
  return (
    <main className="page">
      {/* Top bar */}
      <div className="dict-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2>System Dictionary</h2>
          <span className="badge">{filtered.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="Search event_id / description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn primary sm" onClick={openAdd}>+ Add Entry</button>
        </div>
      </div>

      <p className="muted" style={{ marginBottom: 14 }}>
        Dictionary hệ thống — ánh xạ event_id sang mô tả, dùng chung cho mọi session.
      </p>

      {/* Table */}
      {loading ? (
        <p className="muted center">Đang tải…</p>
      ) : filtered.length === 0 ? (
        <p className="muted center">Không có entry nào{search ? ' phù hợp' : ''}.</p>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Event ID</th>
                <th>Description</th>
                <th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.event_id}>
                  <td className="mono">{e.event_id}</td>
                  <td className="desc-cell">{e.description || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn ghost xs" onClick={() => openEdit(e)}>Edit</button>
                      <button
                        className="btn outline xs"
                        style={{ color: 'var(--muted)' }}
                        onClick={() => del(e.event_id)}
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal open={showForm} onClose={closeForm}>
        <ModalHead
          title={isEdit ? `Edit — Event ${form.event_id}` : 'Add Dictionary Entry'}
          onClose={closeForm}
        />

        <div className="sysdict-form">
          <div className="f-item">
            <label>Event ID <span style={{ color: 'var(--accent)' }}>*</span></label>
            <input
              type="text"
              placeholder="e.g. 4624"
              value={form.event_id}
              readOnly={isEdit}
              style={isEdit ? { background: 'var(--surface-alt)', cursor: 'not-allowed' } : {}}
              onChange={(e) => setForm((p) => ({ ...p, event_id: e.target.value }))}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="f-item">
            <label>Description</label>
            <input
              type="text"
              placeholder="Mô tả sự kiện…"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              onKeyDown={handleKeyDown}
            />
          </div>

          {msg && <p className="sysdict-msg">{msg}</p>}

          <div className="sysdict-actions">
            <button className="btn outline sm" onClick={closeForm}>Hủy</button>
            <button className="btn primary sm" onClick={save} disabled={saving}>
              {saving ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Thêm'}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
