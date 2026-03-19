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

  // モバイル（幅480px以下）: 左右列レイアウト
  if (width <= 480 && opponentCount > 0) {
    if (opponentCount === 1) {
      // 1人は左上（BlindLevelWidgetを避ける）
      return [{ x: 72, y: 110 }];
    }

    const leftX = 72;
    const rightX = width - 72;
    const topY = 90;
    const bottomY = height - 240;
    const rows = Math.ceil(opponentCount / 2);

    for (let i = 0; i < opponentCount; i++) {
      const side = i % 2; // 0 = 左, 1 = 右
      const row = Math.floor(i / 2);
      const x = side === 0 ? leftX : rightX;
      const y =
        rows <= 1
          ? (topY + bottomY) / 2
          : topY + ((bottomY - topY) / (rows - 1)) * row;
      positions.push({ x, y });
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
