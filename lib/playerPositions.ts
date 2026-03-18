export interface Position {
  x: number;
  y: number;
}

export function getOpponentPositions(
  count: number,
  width: number,
  height: number
): Position[] {
  const effectiveHeight = height - 200;
  const centerX = width / 2;
  const centerY = effectiveHeight * 0.45;
  const radiusX = width * 0.4;
  const radiusY = effectiveHeight * 0.35;
  const positions: Position[] = [];
  const opponentCount = count - 1;

  for (let i = 0; i < opponentCount; i++) {
    const startAngle = 200;
    const endAngle = 340;
    const angleRange = endAngle - startAngle;
    const angle =
      (startAngle + (angleRange / (opponentCount + 1)) * (i + 1)) *
      (Math.PI / 180);
    const x = centerX + radiusX * Math.cos(angle);
    const y = centerY + radiusY * Math.sin(angle);
    positions.push({ x, y });
  }

  return positions;
}
