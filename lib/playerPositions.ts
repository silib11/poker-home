export interface Position {
  x: number;
  y: number;
}

export function getOpponentPositions(
  count: number,
  width: number,
  height: number
): Position[] {
  const opponentCount = count - 1;
  const positions: Position[] = [];

  // モバイル（幅480px以下）: 上部横並びレイアウト
  if (width <= 480 && opponentCount > 0) {
    const rowY1 = 105;
    const rowY2 = 200;
    const padX = 20;
    const usableWidth = width - padX * 2;

    const row1Count = opponentCount <= 4 ? opponentCount : Math.min(4, Math.ceil(opponentCount / 2));
    const row2Count = opponentCount - row1Count;

    for (let i = 0; i < row1Count; i++) {
      const x = padX + usableWidth * ((i + 1) / (row1Count + 1));
      positions.push({ x, y: rowY1 });
    }
    for (let i = 0; i < row2Count; i++) {
      const x = padX + usableWidth * ((i + 1) / (row2Count + 1));
      positions.push({ x, y: rowY2 });
    }
    return positions;
  }

  // デスクトップ: 楕円弧レイアウト
  const effectiveHeight = height - 200;
  const centerX = width / 2;
  const centerY = effectiveHeight * 0.45;
  const radiusX = width * 0.4;
  const radiusY = effectiveHeight * 0.35;

  // opponent-box の高さ（名前+スタック+カード等）は約 90px、
  // transform: translate(-50%, -50%) で中心配置するため
  // y が小さすぎるとボックス上部が画面外にはみ出してクリップされる
  const MIN_Y = 72;

  for (let i = 0; i < opponentCount; i++) {
    const startAngle = 200;
    const endAngle = 340;
    const angleRange = endAngle - startAngle;
    const angle =
      (startAngle + (angleRange / (opponentCount + 1)) * (i + 1)) *
      (Math.PI / 180);
    const x = centerX + radiusX * Math.cos(angle);
    const y = Math.max(centerY + radiusY * Math.sin(angle), MIN_Y);
    positions.push({ x, y });
  }

  return positions;
}
