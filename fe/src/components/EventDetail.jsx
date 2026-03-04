import React from 'react';

const SYS_KEYS = [
  'event_id', 'event_description', 'provider', 'time_created', 'computer',
  'event_log_name', 'channel', 'security_sid', 'record_id', 'activity_id',
  'process_id', 'thread_id', 'version', 'level', 'task', 'opcode', 'keywords',
];

export default function EventDetail({ ev }) {
  if (!ev) return null;
  const dynData = ev.event_data || {};
  const dynKeys = Object.keys(dynData);

  return (
    <div className="ev-detail">
      <div className="ev-detail-section">
        <h4>System Info</h4>
        <dl className="detail-dl">
          {SYS_KEYS.map((k) =>
            ev[k] != null && ev[k] !== '' ? (
              <div key={k} className="dl-row">
                <dt>{k}</dt>
                <dd>{String(ev[k])}</dd>
              </div>
            ) : null
          )}
        </dl>
      </div>

      {dynKeys.length > 0 && (
        <div className="ev-detail-section">
          <h4>Event Data</h4>
          <dl className="detail-dl">
            {dynKeys.map((k) => (
              <div key={k} className="dl-row">
                <dt>{k}</dt>
                <dd>{String(dynData[k] ?? '')}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
