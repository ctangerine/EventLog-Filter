import React from 'react';

export default function Modal({ open, onClose, className = '', children }) {
  if (!open) return null;
  return (
    <div className="ov" onClick={onClose}>
      <div className={`modal ${className}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-content-wrapper">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ModalHead({ title, onClose }) {
  return (
    <div className="m-head">
      <h3>{title}</h3>
      <button className="btn ghost xs" onClick={onClose}>✕</button>
    </div>
  );
}
