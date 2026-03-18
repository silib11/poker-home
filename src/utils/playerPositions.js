export function getOpponentPositions(count) {
    const width = window.innerWidth;
    const height = window.innerHeight - 200;
    const centerX = width / 2;
    const centerY = height * 0.45;
    const radiusX = width * 0.4;
    const radiusY = height * 0.35;
    const positions = [];
    const opponentCount = count - 1;

    for (let i = 0; i < opponentCount; i++) {
        const startAngle = 200;
        const endAngle = 340;
        const angleRange = endAngle - startAngle;
        const angle = (startAngle + (angleRange / (opponentCount + 1)) * (i + 1)) * (Math.PI / 180);
        const x = centerX + radiusX * Math.cos(angle);
        const y = centerY + radiusY * Math.sin(angle);
        positions.push({ x, y });
    }

    return positions;
}

export function getPositionName(index, dealerIndex, totalPlayers) {
    if (totalPlayers === 2 || totalPlayers === 3) {
        return null;
    }

    const positionsAfterBB = [];
    for (let i = 3; i < totalPlayers; i++) {
        const pos = (dealerIndex + i) % totalPlayers;
        positionsAfterBB.push(pos);
    }

    if (totalPlayers === 4) {
        if (index === positionsAfterBB[0]) return 'UTG';
    } else if (totalPlayers === 5) {
        if (index === positionsAfterBB[0]) return 'UTG';
        if (index === positionsAfterBB[positionsAfterBB.length - 1]) return 'CO';
    } else if (totalPlayers === 6) {
        if (index === positionsAfterBB[0]) return 'UTG';
        if (index === positionsAfterBB[1]) return 'HJ';
        if (index === positionsAfterBB[positionsAfterBB.length - 1]) return 'CO';
    } else if (totalPlayers >= 7) {
        if (index === positionsAfterBB[0]) return 'UTG';
        if (index === positionsAfterBB[1]) return 'LJ';
        if (index === positionsAfterBB[2]) return 'HJ';
        if (index === positionsAfterBB[positionsAfterBB.length - 1]) return 'CO';
    }

    return null;
}
