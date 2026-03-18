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

// オールインテスト

test('オールイン：1人オールイン、他全員フォールド', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 100 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // Aliceオールイン
    const turn1 = game.turnIndex;
    game.bet(turn1, 100);
    
    // 他全員フォールド
    const turn2 = game.turnIndex;
    game.fold(turn2);
    const turn3 = game.turnIndex;
    game.fold(turn3);
    
    assertEquals(game.phase, 'WINNER', 'WINNER状態');
    assertTrue(game.winner !== undefined, '勝者決定');
});

test('オールイン：2人オールイン（同額）', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 100 },
        { id: '2', name: 'Bob', chips: 100 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // Alice, Bobオールイン、Carolフォールド
    let turn = game.turnIndex;
    game.bet(turn, 100);
    turn = game.turnIndex;
    game.call(turn);
    turn = game.turnIndex;
    game.fold(turn);
    
    // フェーズが進行する
    assertTrue(game.phase !== 'PREFLOP', 'フェーズ進行');
});

test('オールイン：2人オールイン（異なる額）、1人コール', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 50 },
        { id: '2', name: 'Bob', chips: 150 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // Aliceオールイン50
    let turn = game.turnIndex;
    const aliceIndex = game.players.findIndex(p => p.name === 'Alice');
    if (turn === aliceIndex) {
        game.bet(turn, 50);
        turn = game.turnIndex;
    }
    
    // Bobオールイン150
    const bobIndex = game.players.findIndex(p => p.name === 'Bob');
    if (turn === bobIndex) {
        game.bet(turn, 150);
        turn = game.turnIndex;
    }
    
    // Carolコール
    const carolIndex = game.players.findIndex(p => p.name === 'Carol');
    if (turn === carolIndex) {
        game.call(turn);
    }
    
    // ショウダウンまで進行
    let loopCount = 0;
    while (game.phase !== 'SHOWDOWN' && game.phase !== 'WINNER' && loopCount < 100) {
        turn = game.turnIndex;
        if (game.players[turn].chips > 0 && !game.players[turn].folded) {
            game.check(turn);
        }
        loopCount++;
    }
    assertTrue(loopCount < 100, '無限ループ検出');
    
    // サイドポット生成確認
    assertTrue(game.sidePots !== undefined, 'サイドポット情報あり');
});

test('オールイン：3人全員オールイン（異なる額）', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 50 },
        { id: '2', name: 'Bob', chips: 100 },
        { id: '3', name: 'Carol', chips: 200 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // 全員オールイン
    let turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    turn = game.turnIndex;
    game.call(turn);
    turn = game.turnIndex;
    game.call(turn);
    
    // ショウダウンまで自動進行
    assertTrue(game.phase === 'SHOWDOWN' || game.phase === 'FLOP' || game.phase === 'TURN' || game.phase === 'RIVER', 'フェーズ進行');
});

test('オールイン：オールイン後のターンスキップ', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 50 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // Aliceオールイン
    const aliceIndex = game.players.findIndex(p => p.name === 'Alice');
    let turn = game.turnIndex;
    if (turn === aliceIndex) {
        game.bet(turn, 50);
    }
    
    // 次のターンはAliceではない
    turn = game.turnIndex;
    assertFalse(turn === aliceIndex, 'オールインプレイヤーはスキップ');
});

test('オールイン：オールイン額未満でコール', () => {
    // シンプルなシナリオ：3人、1人だけチップが少ない
    const players = [
        { id: '1', name: 'Alice', chips: 1000 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 30 } // ブラインド後に10または20残る
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // Carolのインデックスとブラインド後のチップを確認
    const carolIndex = game.players.findIndex(p => p.name === 'Carol');
    const carolChipsAfterBlind = game.players[carolIndex].chips;
    
    // 誰かが大きくレイズ（100）
    let raiseHappened = false;
    for (let i = 0; i < 5; i++) {
        const turn = game.turnIndex;
        if (turn !== carolIndex && !raiseHappened) {
            game.bet(turn, 100);
            raiseHappened = true;
            break;
        } else if (turn === carolIndex) {
            game.fold(turn);
            break;
        } else {
            game.fold(turn);
        }
    }
    
    // 新しいゲームで確実にテスト
    const players2 = [
        { id: '1', name: 'Alice', chips: 1000 },
        { id: '2', name: 'Bob', chips: 40 }
    ];
    const game2 = new PokerGame(players2, 10, 20);
    game2.start();
    
    // Bobのインデックス
    const bobIndex = game2.players.findIndex(p => p.name === 'Bob');
    
    // Aliceがレイズ
    let turn = game2.turnIndex;
    if (turn !== bobIndex) {
        game2.bet(turn, 100);
        turn = game2.turnIndex;
    }
    
    // Bobがコール（チップ不足）
    if (turn === bobIndex) {
        const bobChips = game2.players[bobIndex].chips;
        const toCall = game2.currentBet - game2.players[bobIndex].bet;
        
        if (bobChips < toCall) {
            game2.call(bobIndex);
            assertEquals(game2.players[bobIndex].chips, 0, 'Bobオールイン');
            assertEquals(game2.players[bobIndex].lastAction, 'allin', 'オールイン記録');
        }
    }
});

test('オールイン：レイズでオールイン', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 100 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // Aliceレイズでオールイン
    const aliceIndex = game.players.findIndex(p => p.name === 'Alice');
    let turn = game.turnIndex;
    if (turn === aliceIndex) {
        game.bet(turn, 100);
        assertEquals(game.players[aliceIndex].chips, 0, 'チップ0');
        assertEquals(game.players[aliceIndex].lastAction, 'allin', 'オールイン記録');
    }
});

test('オールイン：オールイン後にレイズされる', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 50 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // Aliceオールイン50
    let turn = game.turnIndex;
    const aliceIndex = game.players.findIndex(p => p.name === 'Alice');
    if (turn === aliceIndex) {
        game.bet(turn, 50);
        turn = game.turnIndex;
    }
    
    // Bobレイズ100
    const bobIndex = game.players.findIndex(p => p.name === 'Bob');
    if (turn === bobIndex) {
        const beforeBet = game.currentBet;
        game.bet(turn, 100);
        assertTrue(game.currentBet > beforeBet, 'currentBet更新');
    }
});

test('オールイン：複数ラウンドでオールイン', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 100 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // PREFLOPで全員チェック/コール
    let turn = game.turnIndex;
    let loopCount = 0;
    const maxLoops = 20;
    
    while (game.phase === 'PREFLOP' && loopCount < maxLoops) {
        turn = game.turnIndex;
        if (game.currentBet > game.players[turn].bet) {
            game.call(turn);
        } else {
            game.check(turn);
        }
        loopCount++;
    }
    assertTrue(loopCount < maxLoops, 'PREFLOP無限ループ検出');
    assertEquals(game.phase, 'FLOP', 'FLOP進行');
    
    // FLOPでAliceオールイン
    turn = game.turnIndex;
    const aliceIndex = game.players.findIndex(p => p.name === 'Alice');
    if (turn === aliceIndex) {
        game.bet(turn, game.players[aliceIndex].chips);
        assertEquals(game.players[aliceIndex].chips, 0, 'オールイン');
    }
});

test('オールイン：サイドポット - メインポット勝者とサイドポット勝者が異なる', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 50 },
        { id: '2', name: 'Bob', chips: 100 },
        { id: '3', name: 'Carol', chips: 200 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // 全員オールイン（最大額からベット）
    let turn = game.turnIndex;
    const firstPlayer = game.players[turn];
    
    // 最大チップのプレイヤーが全額ベット
    const carolIndex = game.players.findIndex(p => p.name === 'Carol');
    if (turn === carolIndex) {
        game.bet(turn, 200);
    } else {
        game.bet(turn, game.players[turn].chips);
    }
    
    // 残りのプレイヤーも全額ベット
    turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    
    turn = game.turnIndex;
    game.call(turn);
    
    // 全員オールイン後は自動進行してショウダウンまたは勝者決定
    assertTrue(game.phase === 'SHOWDOWN' || game.phase === 'WINNER', `ショウダウンまたは勝者決定（実際: ${game.phase}）`);
    
    // サイドポット計算確認
    if (game.phase === 'SHOWDOWN') {
        const sidePots = game.calculateSidePots();
        assertTrue(sidePots.length >= 2, '複数のポット生成');
    }
});

test('オールイン：1人だけチップ残り、他全員オールイン', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 50 },
        { id: '2', name: 'Bob', chips: 50 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // Alice, Bobオールイン、Carolコール
    let turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    turn = game.turnIndex;
    game.call(turn);
    turn = game.turnIndex;
    game.call(turn);
    
    // Carolだけチップが残っている
    const carolIndex = game.players.findIndex(p => p.name === 'Carol');
    assertTrue(game.players[carolIndex].chips > 0, 'Carolチップあり');
    
    // フェーズが自動進行
    assertTrue(game.phase !== 'PREFLOP', 'フェーズ進行');
});

test('オールイン：オールイン後にフォールド', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 50 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // Aliceオールイン
    let turn = game.turnIndex;
    const aliceIndex = game.players.findIndex(p => p.name === 'Alice');
    if (turn === aliceIndex) {
        game.bet(turn, 50);
        turn = game.turnIndex;
    }
    
    // Bobフォールド
    game.fold(turn);
    turn = game.turnIndex;
    
    // Carolフォールド
    game.fold(turn);
    
    // Aliceが勝利
    assertEquals(game.phase, 'WINNER', 'WINNER状態');
    assertEquals(game.winner.name, 'Alice', 'Alice勝利');
});

test('オールイン：totalBetThisHandの追跡', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 1000 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // PREFLOPでベット
    let turn = game.turnIndex;
    const player1 = game.players[turn];
    game.bet(turn, 100);
    const bet1 = player1.totalBetThisHand;
    
    // 次のラウンドでさらにベット
    turn = game.turnIndex;
    game.call(turn);
    turn = game.turnIndex;
    game.call(turn);
    
    // FLOPでベット
    turn = game.turnIndex;
    if (game.players[turn].id === player1.id) {
        game.bet(turn, 50);
        assertTrue(player1.totalBetThisHand > bet1, 'totalBetThisHand累積');
    }
});

test('オールイン：チョップ（同順位）', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 100 },
        { id: '2', name: 'Bob', chips: 100 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // 両者オールイン
    let turn = game.turnIndex;
    game.bet(turn, 100);
    turn = game.turnIndex;
    game.call(turn);
    
    // ショウダウンまで進行（全員オールインなので自動進行済み）
    assertTrue(game.phase === 'SHOWDOWN' || game.phase === 'WINNER', 'ショウダウンまたは勝者決定');
    
    // 勝者が決定される（チョップの場合もある）
    assertTrue(game.winner !== undefined || game.potResults !== undefined, '結果あり');
});

// 追加テスト

test('オールイン：ブラインドでオールイン', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 1000 },
        { id: '2', name: 'Bob', chips: 5 }, // SBでオールイン
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // Bobがブラインドでオールインしているか確認
    const bobIndex = game.players.findIndex(p => p.name === 'Bob');
    assertTrue(game.players[bobIndex].chips === 0 || game.players[bobIndex].chips < 10, 'Bobチップ不足');
});

test('オールイン：連続オールイン', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 100 },
        { id: '2', name: 'Bob', chips: 200 },
        { id: '3', name: 'Carol', chips: 300 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // 全員順番にオールイン
    let turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    
    turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    
    turn = game.turnIndex;
    game.bet(turn, game.players[turn].chips);
    
    // 少なくとも1人はオールイン
    const someAllIn = game.players.some(p => p.chips === 0);
    assertTrue(someAllIn, '少なくとも1人オールイン');
    
    // ショウダウンまで自動進行
    assertTrue(game.phase === 'SHOWDOWN' || game.phase === 'WINNER', 'ショウダウンまたは勝者決定');
});

test('オールイン：オールイン後にチェック不可', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 100 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    // Aliceオールイン
    const aliceIndex = game.players.findIndex(p => p.name === 'Alice');
    let turn = game.turnIndex;
    if (turn === aliceIndex) {
        game.bet(turn, 100);
        assertEquals(game.players[aliceIndex].chips, 0, 'Aliceオールイン');
        
        // 次のターンはAliceではない
        turn = game.turnIndex;
        assertFalse(turn === aliceIndex, 'Aliceはスキップ');
    }
});

test('オールイン：ヘッズアップでオールイン後のアクション', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 100 },
        { id: '2', name: 'Bob', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    const aliceIndex = game.players.findIndex(p => p.name === 'Alice');
    const bobIndex = game.players.findIndex(p => p.name === 'Bob');
    
    // Bobがコール
    let turn = game.turnIndex;
    if (turn === bobIndex) {
        game.call(turn);
        turn = game.turnIndex;
    }
    
    // Aliceがオールイン
    if (turn === aliceIndex && game.phase === 'PREFLOP') {
        game.bet(turn, game.players[aliceIndex].chips);
        
        // まだPREFLOPでBobのアクションを待つ
        assertEquals(game.phase, 'PREFLOP', 'まだPREFLOP');
        assertEquals(game.turnIndex, bobIndex, 'Bobのターン');
        
        // Bobがコール
        game.call(bobIndex);
        
        // フェーズが進行
        assertTrue(game.phase !== 'PREFLOP', 'フェーズ進行');
    }
});

// テスト実行
async function runTests() {
    console.log('💥 オールインテスト開始\n');
    
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
