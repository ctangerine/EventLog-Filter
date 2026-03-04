import React, { useState, useCallback } from 'react';

export default function FileDropZone({ fileRef, onUpload, uploading, msg, compact }) {
  const [drag, setDrag] = useState(false);
  const [names, setNames] = useState([]);

  const syncNames = () => {
    const f = fileRef.current?.files;
    setNames(f ? Array.from(f).map((x) => x.name) : []);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files.length) {
      fileRef.current.files = e.dataTransfer.files;
      syncNames();
    }
  }, []);

  /* ── compact mode: small inline bar ── */
  if (compact) {
    return (
      <div className="dz-compact">
        <input type="file" ref={fileRef} multiple accept=".evtx" hidden onChange={syncNames} />
        <button
          className="btn outline sm"
          onClick={() => fileRef.current?.click()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Thêm file
        </button>
        {names.length > 0 && (
          <span className="dz-compact-files">
            {names.length} file: {names.join(', ')}
          </span>
        )}
        <button
          className="btn primary sm"
          onClick={onUpload}
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        {msg && <span className="dz-msg">{msg}</span>}
      </div>
    );
  }

  /* ── full drop zone ── */
  return (
    <div
      className={`dropzone${drag ? ' drag' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => fileRef.current?.click()}
    >
      <input type="file" ref={fileRef} multiple accept=".evtx" hidden onChange={syncNames} />
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <p className="dz-title">Kéo thả hoặc bấm để chọn file .evtx</p>
      {names.length > 0 && (
        <span className="dz-files">
          {names.length} file{names.length > 1 ? 's' : ''}: {names.join(', ')}
        </span>
      )}
      <button
        className="btn primary"
        onClick={(e) => { e.stopPropagation(); onUpload(); }}
        disabled={uploading}
      >
        {uploading ? 'Uploading…' : 'Upload'}
      </button>
      {msg && <span className="dz-msg">{msg}</span>}
    </div>
  );
}
