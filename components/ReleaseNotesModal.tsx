'use client';

import { RELEASE_NOTES } from '@/lib/releaseNotes';

interface Props {
  onClose: () => void;
}

const VERSION_COLORS: Record<string, string> = {
  'v1.4': '#a78bfa',
  'v1.3': '#60a5fa',
  'v1.2': '#4ade80',
  'v1.1': '#f59e0b',
  'v1.0': '#94a3b8',
};

export default function ReleaseNotesModal({ onClose }: Props) {
  return (
    <div
      className="modal"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: '480px',
          width: 'min(92vw, 480px)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>アップデート履歴</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div
          className="modal-body"
          style={{
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {RELEASE_NOTES.map((note) => {
            const color = VERSION_COLORS[note.version] ?? '#94a3b8';
            return (
              <div
                key={note.version}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '10px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color,
                      background: `${color}22`,
                      border: `1px solid ${color}55`,
                      borderRadius: '6px',
                      padding: '2px 8px',
                      letterSpacing: '0.5px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {note.version}
                  </span>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#fff',
                    }}
                  >
                    {note.title}
                  </span>
                </div>

                <ul
                  style={{
                    margin: 0,
                    padding: '0 0 0 4px',
                    listStyle: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {note.items.map((item, i) => (
                    <li
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.7)',
                        lineHeight: '1.5',
                      }}
                    >
                      <span
                        style={{
                          color,
                          marginTop: '1px',
                          flexShrink: 0,
                          fontSize: '10px',
                        }}
                      >
                        ●
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
