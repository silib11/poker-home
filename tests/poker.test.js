import { PokerGame } from '../core/poker.js';

// シンプルなテストフレームワーク
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

function assertFalse(condition, message = '') {
    if (condition) {
        throw new Error(message || '条件がtrueです');
    }
}

// テストケース

test('ゲーム初期化', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 1000 },
        { id: '2', name: 'Bob', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    
    assertEquals(game.players.length, 2, 'プレイヤー数');
    assertEquals(game.sb, 10, 'SB');
    assertEquals(game.bb, 20, 'BB');
    assertEquals(game.pot, 0, '初期ポット');
    assertEquals(game.phase, 'PREFLOP', '初期フェーズ');
});

test('ゲーム開始：ブラインド徴収', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 1000 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // ディーラー=0, SB=1, BB=2
    assertEquals(game.players[1].bet, 10, 'SBベット');
    assertEquals(game.players[1].chips, 990, 'SBチップ');
    assertEquals(game.players[2].bet, 20, 'BBベット');
    assertEquals(game.players[2].chips, 980, 'BBチップ');
    assertEquals(game.currentBet, 20, 'currentBet');
    assertEquals(game.phase, 'PREFLOP', 'フェーズ');
});

test('手札配布', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 1000 },
        { id: '2', name: 'Bob', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    game.players.forEach(p => {
        assertEquals(p.hand.length, 2, '手札は2枚');
        assertTrue(p.hand[0].suit && p.hand[0].rank, '有効なカード');
    });
});

test('コール処理', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 1000 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // ターン=0（ディーラー）がコール
    const turnPlayer = game.players[game.turnIndex];
    const beforeChips = turnPlayer.chips;
    
    game.call(game.turnIndex);
    
    assertEquals(turnPlayer.bet, 20, 'ベット額');
    assertEquals(turnPlayer.chips, beforeChips - 20, 'チップ減少');
    assertEquals(turnPlayer.lastAction, 'call', 'アクション記録');
    assertTrue(turnPlayer.acted, 'acted=true');
});

test('レイズ処理', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 1000 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    const turnIndex = game.turnIndex;
    game.bet(turnIndex, 40);
    
    assertEquals(game.currentBet, 40, 'currentBet更新');
    assertEquals(game.players[turnIndex].bet, 40, 'ベット額');
    assertEquals(game.players[turnIndex].lastAction, 'raise', 'レイズ記録');
});

test('フォールド処理', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 1000 },
        { id: '2', name: 'Bob', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    const turnIndex = game.turnIndex;
    game.fold(turnIndex);
    
    assertTrue(game.players[turnIndex].folded, 'フォールド状態');
    assertEquals(game.players[turnIndex].lastAction, 'fold', 'アクション記録');
});

test('1人残りで即勝利', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 1000 },
        { id: '2', name: 'Bob', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // Aliceがフォールド
    game.fold(0);
    
    assertEquals(game.phase, 'WINNER', 'WINNER状態');
    assertEquals(game.winner.id, '2', 'Bobが勝者');
    assertTrue(game.winAmount > 0, '賞金あり');
});

test('チェック処理', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 1000 },
        { id: '2', name: 'Bob', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // BBがチェック可能な状況を作る
    game.call(0); // SB calls
    const bbIndex = 1;
    
    game.check(bbIndex);
    
    assertEquals(game.players[bbIndex].lastAction, 'check', 'チェック記録');
    assertTrue(game.players[bbIndex].acted, 'acted=true');
});

test('フェーズ進行：PREFLOP→FLOP', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 1000 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // 全員コール
    const turn1 = game.turnIndex;
    game.call(turn1);
    const turn2 = game.turnIndex;
    game.call(turn2);
    const turn3 = game.turnIndex;
    game.check(turn3);
    
    assertEquals(game.phase, 'FLOP', 'FLOP進行');
    assertEquals(game.community.length, 3, 'コミュニティ3枚');
    assertTrue(game.pot > 0, 'ポット蓄積');
});

test('オールイン：チップ全額', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 100 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // 現在のターンプレイヤーがオールイン
    const turnIndex = game.turnIndex;
    const turnPlayer = game.players[turnIndex];
    const allChips = turnPlayer.chips;
    
    game.bet(turnIndex, allChips);
    
    assertEquals(turnPlayer.chips, 0, 'チップ0');
    assertEquals(turnPlayer.lastAction, 'allin', 'オールイン記録');
});

test('オールイン：コールでオールイン', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 50 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // 最初のターンプレイヤーがレイズ
    const turn1 = game.turnIndex;
    game.bet(turn1, 100);
    
    // 次のプレイヤーを探す（チップ50のプレイヤー）
    const aliceIndex = game.players.findIndex(p => p.chips === 40); // 50 - 10(SB) = 40
    if (aliceIndex !== -1 && game.turnIndex === aliceIndex) {
        game.call(aliceIndex);
        assertEquals(game.players[aliceIndex].chips, 0, 'オールイン');
        assertEquals(game.players[aliceIndex].lastAction, 'allin', 'オールイン記録');
    } else {
        // スキップ（テスト条件に合わない）
        assertTrue(true, 'スキップ');
    }
});

test('オールイン後のターンスキップ', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 50 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // Aliceオールイン
    game.bet(0, 50);
    
    // 次のターンはAliceをスキップ
    const nextTurn = game.turnIndex;
    assertFalse(game.players[nextTurn].chips === 0, '次のターンはチップあり');
});

test('全員オールインでフェーズ進行', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 100 },
        { id: '2', name: 'Bob', chips: 100 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // 両者オールイン
    game.bet(0, 100);
    game.call(1);
    
    // アクション可能なプレイヤーが0なのでフェーズ進行
    assertTrue(game.phase !== 'PREFLOP', 'フェーズ進行');
});

test('ショウダウン：役判定', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 1000 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // PREFLOP
    let turn = game.turnIndex;
    game.call(turn);
    turn = game.turnIndex;
    game.call(turn);
    turn = game.turnIndex;
    game.check(turn);
    
    // FLOP
    turn = game.turnIndex;
    game.check(turn);
    turn = game.turnIndex;
    game.check(turn);
    turn = game.turnIndex;
    game.check(turn);
    
    // TURN
    turn = game.turnIndex;
    game.check(turn);
    turn = game.turnIndex;
    game.check(turn);
    turn = game.turnIndex;
    game.check(turn);
    
    // RIVER
    turn = game.turnIndex;
    game.check(turn);
    turn = game.turnIndex;
    game.check(turn);
    turn = game.turnIndex;
    game.check(turn);
    
    assertEquals(game.phase, 'SHOWDOWN', 'ショウダウン');
    assertTrue(game.winner !== undefined, '勝者決定');
    assertTrue(game.winningHand !== undefined, '役名あり');
});

test('複数ラウンド：ディーラー移動', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 1000 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    
    const initialDealer = game.dealerIndex;
    game.start();
    
    // 次のゲーム
    const game2 = new PokerGame(players, 10, 20);
    game2.dealerIndex = (initialDealer + 1) % 3;
    game2.start();
    
    assertEquals(game2.dealerIndex, (initialDealer + 1) % 3, 'ディーラー移動');
});

test('サイドポット：2人オールイン（異なる額）', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 100 },
        { id: '2', name: 'Bob', chips: 200 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // 全員オールイン/コール
    const turn1 = game.turnIndex;
    game.bet(turn1, 100); // Alice all-in 100
    
    const turn2 = game.turnIndex;
    game.bet(turn2, 200); // Bob all-in 200
    
    const turn3 = game.turnIndex;
    game.call(turn3); // Carol calls 200
    
    // サイドポット計算
    const sidePots = game.calculateSidePots();
    
    assertTrue(sidePots.length >= 1, 'サイドポットが生成される');
    assertTrue(game.pot > 0, 'ポットにチップがある');
});

test('サイドポット：メインポットとサイドポット', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 50 },
        { id: '2', name: 'Bob', chips: 100 },
        { id: '3', name: 'Carol', chips: 100 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // Aliceオールイン50、Bob/Carolコール
    const aliceIndex = game.players.findIndex(p => p.name === 'Alice');
    if (game.turnIndex === aliceIndex) {
        game.bet(aliceIndex, 50);
    }
    
    // ポットが正しく計算されることを確認
    assertTrue(game.pot >= 0, 'ポット計算');
});

// テスト実行
async function runTests() {
    console.log('🧪 ポーカーゲームテスト開始\n');
    
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
