'use client';

import { useState } from 'react';

function getInitialStackUnit(): 'chips' | 'bb' {
  try {
    const v = localStorage.getItem('stackUnit');
    if (v === 'chips' || v === 'bb') return v;
  } catch { /* ignore */ }
  return 'chips';
}

export function useStackUnit() {
  const [stackUnit, setStackUnitState] = useState<'chips' | 'bb'>(getInitialStackUnit);

  function toggleStackUnit() {
    const next = stackUnit === 'chips' ? 'bb' : 'chips';
    setStackUnitState(next);
    try { localStorage.setItem('stackUnit', next); } catch { /* ignore */ }
  }

  return { stackUnit, toggleStackUnit };
}
