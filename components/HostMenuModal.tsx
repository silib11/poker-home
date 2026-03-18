'use client';

import { useState } from 'react';
import { useGame } from '@/context/GameContext';

interface Props {
  onClose: () => void;
}

export default function HostMenuModal({ onClose }: Props) {
  const { sb, bb, updateBlinds } = useGame();
  const [sbInput, setSbInput] = useState(sb);
  const [bbInput, setBbInput] = useState(bb);

  function handleUpdateBlinds() {
    updateBlinds(sbInput, bbInput);
    onClose();
  }

  return (
    <div
      className="modal"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h3>ホストメニュー</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="blinds-section">
            <h4>ブラインド設定</h4>
            <div className="input-group">
              <label>SB</label>
              <input
                type="number"
                value={sbInput}
                min={5}
                step={5}
                onChange={(e) => setSbInput(Number(e.target.value))}
              />
            </div>
            <div className="input-group">
              <label>BB</label>
              <input
                type="number"
                value={bbInput}
                min={10}
                step={10}
                onChange={(e) => setBbInput(Number(e.target.value))}
              />
            </div>
            <button className="modal-btn" onClick={handleUpdateBlinds}>
              更新
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
