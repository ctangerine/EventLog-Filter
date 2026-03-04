import React, { useMemo, useState } from 'react';
import FileDropZone from './FileDropZone';
import Modal, { ModalHead } from './Modal';

export default function DictionaryTab({ dict, fileRef, upload, uploading, uploadMsg }) {
  const [search, setSearch] = useState('');
  const [popup, setPopup] = useState(null);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return dict;
    return dict.filter(
      (d) =>
        String(d.event_id).includes(kw) ||
        String(d.event_description || '').toLowerCase().includes(kw)
    );
  }, [dict, search]);

  const hasData = dict.length > 0;

  return (
    <main className="page">
      {/* Full dropzone only if no data yet */}
      {!hasData && (
        <FileDropZone
          fileRef={fileRef}
          onUpload={upload}
          uploading={uploading}
          msg={uploadMsg}
          compact={false}
        />
      )}

      {hasData && (
        <>
          <div className="dict-bar">
            <h2>Event IDs <span className="badge">{filtered.length}</span></h2>
            <input
              placeholder="Search event_id / description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Description</th>
                  <th>Fields</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.event_id}>
                    <td className="mono">{d.event_id}</td>
                    <td className="desc-cell">{d.event_description || '—'}</td>
                    <td className="mono center">
                      {(d.system_fields?.length || 0) + (d.props?.length || 0)}
                    </td>
                    <td>
                      <button className="btn ghost xs" onClick={() => setPopup(d)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Compact upload bar at the bottom */}
          <FileDropZone
            fileRef={fileRef}
            onUpload={upload}
            uploading={uploading}
            msg={uploadMsg}
            compact
          />
        </>
      )}

      {/* Dict structure popup */}
      <Modal open={!!popup} onClose={() => setPopup(null)}>
        {popup && (
          <>
            <ModalHead title={`Event ${popup.event_id}`} onClose={() => setPopup(null)} />
            <p className="muted">{popup.event_description}</p>
            <h4>System fields</h4>
            <ul className="chip-list">
              {(popup.system_fields || []).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <h4>Dynamic props</h4>
            {(popup.props || []).length === 0 ? (
              <p className="muted">Không có</p>
            ) : (
              <ul className="chip-list">
                {popup.props.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </Modal>
    </main>
  );
}
