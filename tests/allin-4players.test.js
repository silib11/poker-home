import { PokerGame } from '../core/poker.js';

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
    tests.push({ name, fn });
}

function assertEquals(actual, expected, message = '') {
    if (actual !== expected) {
        throw new Error(`${message}\n期待値: ${expected}\n実際: ${actual}`);
    }
}

function assertTrue(condition, message = '') {
    if (!condition) {
        throw new Error(message || '条件がfalseです');
    }
}

// 4人プレイ オールインテスト

test('4人：1人オールイン、他全員フォールド', () => {
    const players = [
        { id: '1', name: 'A', chips: 100 },
        { id: '2', name: 'B', chips: 1000 },
        { id: '3', name: 'C', chips: 1000 },
        { id: '4', name: 'D', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    let turn = game.turnIndex;
    game.bet(turn, 100);
    
    for (let i = 0; i < 3; i++) {
        turn = game.turnIndex;
        game.fold(turn);
    }
    
    assertEquals(game.phase, 'WINNER', 'WINNER状態');
});

test('4人：2人オールイン（同額）、2人フォールド', () => {
    const players = [
        { id: '1', name: 'A', chips: 100 },
        { id: '2', name: 'B', chips: 100 },
        { id: '3', name: 'C', chips: 1000 },
        { id: '4', name: 'D', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    let turn = game.turnIndex;
    game.bet(turn, 100);
    turn = game.turnIndex;
    game.call(turn);
    turn = game.turnIndex;
    game.fold(turn);
    turn = game.turnIndex;
    game.fold(turn);
    
    assertTrue(game.phase !== 'PREFLOP', 'フェーズ進行');
});

test('4人：3人オールイン（異なる額）、1人コール', () => {
    const players = [
        { id: '1', name: 'A', chips: 50 },
        { id: '2', name: 'B', chips: 100 },
        { id: '3', name: 'C', chips: 150 },
        { id: '4', name: 'D', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    let turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    turn = game.turnIndex;
    game.call(turn);
    
    let loopCount = 0;
    while (game.phase !== 'SHOWDOWN' && game.phase !== 'WINNER' && loopCount < 100) {
        turn = game.turnIndex;
        if (game.players[turn].chips > 0 && !game.players[turn].folded) {
            game.check(turn);
        }
        loopCount++;
    }
    assertTrue(loopCount < 100, '無限ループなし');
});

test('4人：全員オールイン（異なる額）', () => {
    const players = [
        { id: '1', name: 'A', chips: 50 },
        { id: '2', name: 'B', chips: 100 },
        { id: '3', name: 'C', chips: 150 },
        { id: '4', name: 'D', chips: 200 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    let turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    turn = game.turnIndex;
    game.call(turn);
    
    assertTrue(game.phase === 'SHOWDOWN' || game.phase === 'WINNER', 'ショウダウンまたは勝者決定');
});

test('4人：全員オールイン（同額）', () => {
    const players = [
        { id: '1', name: 'A', chips: 100 },
        { id: '2', name: 'B', chips: 100 },
        { id: '3', name: 'C', chips: 100 },
        { id: '4', name: 'D', chips: 100 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    let turn = game.turnIndex;
    game.bet(turn, 100);
    turn = game.turnIndex;
    game.call(turn);
    turn = game.turnIndex;
    game.call(turn);
    turn = game.turnIndex;
    game.call(turn);
    
    assertTrue(game.phase === 'SHOWDOWN' || game.phase === 'WINNER', 'ショウダウンまたは勝者決定');
});

test('4人：1人オールイン、2人コール、1人フォールド', () => {
    const players = [
        { id: '1', name: 'A', chips: 100 },
        { id: '2', name: 'B', chips: 1000 },
        { id: '3', name: 'C', chips: 1000 },
        { id: '4', name: 'D', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    let turn = game.turnIndex;
    game.bet(turn, 100);
    turn = game.turnIndex;
    game.call(turn);
    turn = game.turnIndex;
    game.call(turn);
    turn = game.turnIndex;
    game.fold(turn);
    
    assertTrue(game.phase !== 'PREFLOP', 'フェーズ進行');
});

test('4人：2人オールイン（異なる額）、2人コール', () => {
    const players = [
        { id: '1', name: 'A', chips: 50 },
        { id: '2', name: 'B', chips: 150 },
        { id: '3', name: 'C', chips: 1000 },
        { id: '4', name: 'D', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    let turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    turn = game.turnIndex;
    game.call(turn);
    turn = game.turnIndex;
    game.call(turn);
    
    let loopCount = 0;
    while (game.phase !== 'SHOWDOWN' && game.phase !== 'WINNER' && loopCount < 100) {
        turn = game.turnIndex;
        if (game.players[turn].chips > 0 && !game.players[turn].folded) {
            game.check(turn);
        }
        loopCount++;
    }
    assertTrue(loopCount < 100, '無限ループなし');
});

test('4人：FLOP後に1人オールイン、他チェック/コール', () => {
    const players = [
        { id: '1', name: 'A', chips: 1000 },
        { id: '2', name: 'B', chips: 1000 },
        { id: '3', name: 'C', chips: 100 },
        { id: '4', name: 'D', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // PREFLOPをパス
    let loopCount = 0;
    while (game.phase === 'PREFLOP' && loopCount < 20) {
        let turn = game.turnIndex;
        if (game.currentBet > game.players[turn].bet) {
            game.call(turn);
        } else {
            game.check(turn);
        }
        loopCount++;
    }
    assertTrue(loopCount < 20, 'PREFLOP無限ループなし');
    assertEquals(game.phase, 'FLOP', 'FLOP到達');
    
    // FLOPでCオールイン
    const cIndex = game.players.findIndex(p => p.name === 'C');
    let turn = game.turnIndex;
    if (turn === cIndex) {
        game.bet(turn, game.players[cIndex].chips);
    } else {
        game.check(turn);
    }
    
    // 残りのプレイヤーがアクション
    loopCount = 0;
    while (game.phase === 'FLOP' && loopCount < 20) {
        turn = game.turnIndex;
        if (game.currentBet > game.players[turn].bet) {
            game.call(turn);
        } else {
            game.check(turn);
        }
        loopCount++;
    }
    assertTrue(loopCount < 20, 'FLOP無限ループなし');
});

test('4人：段階的オールイン（50, 100, 150, 200）', () => {
    const players = [
        { id: '1', name: 'A', chips: 50 },
        { id: '2', name: 'B', chips: 100 },
        { id: '3', name: 'C', chips: 150 },
        { id: '4', name: 'D', chips: 200 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    let turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    
    assertTrue(game.phase === 'SHOWDOWN' || game.phase === 'WINNER', 'ショウダウンまたは勝者決定');
    
    if (game.phase === 'SHOWDOWN') {
        const sidePots = game.calculateSidePots();
        assertTrue(sidePots.length >= 3, '複数サイドポット生成');
    }
});

test('4人：1人だけチップ残り、他3人オールイン', () => {
    const players = [
        { id: '1', name: 'A', chips: 50 },
        { id: '2', name: 'B', chips: 50 },
        { id: '3', name: 'C', chips: 50 },
        { id: '4', name: 'D', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    let turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    turn = game.turnIndex;
    game.call(turn);
    turn = game.turnIndex;
    game.call(turn);
    turn = game.turnIndex;
    game.call(turn);
    
    const dIndex = game.players.findIndex(p => p.name === 'D');
    assertTrue(game.players[dIndex].chips > 0, 'Dだけチップあり');
    assertTrue(game.phase !== 'PREFLOP', 'フェーズ進行');
});

test('4人：オールイン後にレイズ合戦', () => {
    const players = [
        { id: '1', name: 'A', chips: 50 },
        { id: '2', name: 'B', chips: 1000 },
        { id: '3', name: 'C', chips: 1000 },
        { id: '4', name: 'D', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    let turn = game.turnIndex;
    const aIndex = game.players.findIndex(p => p.name === 'A');
    
    if (turn === aIndex) {
        game.bet(turn, 50);
        turn = game.turnIndex;
    }
    
    // Bレイズ
    game.bet(turn, 100);
    turn = game.turnIndex;
    
    // Cレイズ
    game.bet(turn, 200);
    turn = game.turnIndex;
    
    // Dコール
    game.call(turn);
    
    // Aはスキップされる
    turn = game.turnIndex;
    assertTrue(turn !== aIndex, 'Aスキップ');
});

test('4人：TURN後に2人オールイン', () => {
    const players = [
        { id: '1', name: 'A', chips: 1000 },
        { id: '2', name: 'B', chips: 1000 },
        { id: '3', name: 'C', chips: 100 },
        { id: '4', name: 'D', chips: 100 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // TURNまで進める
    let loopCount = 0;
    while (game.phase !== 'TURN' && loopCount < 50) {
        let turn = game.turnIndex;
        if (game.currentBet > game.players[turn].bet) {
            game.call(turn);
        } else {
            game.check(turn);
        }
        loopCount++;
    }
    assertTrue(loopCount < 50, 'TURN到達');
    
    // C, Dオールイン
    let turn = game.turnIndex;
    const cIndex = game.players.findIndex(p => p.name === 'C');
    const dIndex = game.players.findIndex(p => p.name === 'D');
    
    loopCount = 0;
    while (game.phase === 'TURN' && loopCount < 20) {
        turn = game.turnIndex;
        if (turn === cIndex || turn === dIndex) {
            if (game.players[turn].chips > 0) {
                game.bet(turn, game.players[turn].chips);
            }
        } else {
            if (game.currentBet > game.players[turn].bet) {
                game.call(turn);
            } else {
                game.check(turn);
            }
        }
        loopCount++;
    }
    assertTrue(loopCount < 20, 'TURN無限ループなし');
});

test('4人：1人ずつフォールド、最後にオールイン', () => {
    const players = [
        { id: '1', name: 'A', chips: 100 },
        { id: '2', name: 'B', chips: 1000 },
        { id: '3', name: 'C', chips: 1000 },
        { id: '4', name: 'D', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    let turn = game.turnIndex;
    game.bet(turn, 100);
    turn = game.turnIndex;
    game.fold(turn);
    turn = game.turnIndex;
    game.fold(turn);
    turn = game.turnIndex;
    game.fold(turn);
    
    assertEquals(game.phase, 'WINNER', 'WINNER状態');
});

test('4人：複数ラウンドで段階的オールイン', () => {
    const players = [
        { id: '1', name: 'A', chips: 1000 },
        { id: '2', name: 'B', chips: 1000 },
        { id: '3', name: 'C', chips: 200 },
        { id: '4', name: 'D', chips: 100 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // PREFLOPパス
    let loopCount = 0;
    while (game.phase === 'PREFLOP' && loopCount < 20) {
        let turn = game.turnIndex;
        if (game.currentBet > game.players[turn].bet) {
            game.call(turn);
        } else {
            game.check(turn);
        }
        loopCount++;
    }
    
    // FLOPでDオールイン
    const dIndex = game.players.findIndex(p => p.name === 'D');
    loopCount = 0;
    let dAllIn = false;
    while (game.phase === 'FLOP' && loopCount < 20) {
        let turn = game.turnIndex;
        if (turn === dIndex && !dAllIn && game.players[dIndex].chips > 0) {
            game.bet(turn, game.players[dIndex].chips);
            dAllIn = true;
        } else if (game.currentBet > game.players[turn].bet) {
            game.call(turn);
        } else {
            game.check(turn);
        }
        loopCount++;
    }
    
    // TURNでCオールイン
    const cIndex = game.players.findIndex(p => p.name === 'C');
    loopCount = 0;
    let cAllIn = false;
    while (game.phase === 'TURN' && loopCount < 20) {
        let turn = game.turnIndex;
        if (turn === cIndex && !cAllIn && game.players[cIndex].chips > 0) {
            game.bet(turn, game.players[cIndex].chips);
            cAllIn = true;
        } else if (game.currentBet > game.players[turn].bet) {
            game.call(turn);
        } else {
            game.check(turn);
        }
        loopCount++;
    }
    
    assertTrue(game.players[dIndex].chips === 0, 'Dオールイン');
    assertTrue(game.players[cIndex].chips === 0, 'Cオールイン');
});

// テスト実行
async function runTests() {
    console.log('💥 4人プレイ オールインテスト開始\n');
    
    for (const { name, fn } of tests) {
        try {
            await fn();
            console.log(`✅ ${name}`);
            passed++;
        } catch (error) {
            console.error(`❌ ${name}`);
            console.error(`   ${error.message}\n`);
            failed++;
        }
    }
    
    console.log(`\n📊 結果: ${passed}/${tests.length} 成功`);
    if (failed > 0) {
        console.log(`❌ ${failed} 件失敗`);
        process.exit(1);
    } else {
        console.log('✅ 全テスト成功');
    }
}

runTests();
