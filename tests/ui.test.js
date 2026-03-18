import { PokerGame } from '../core/poker.js';
import { getPositionName } from '../src/utils/playerPositions.js';

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

// UIテスト

test('ポジション表示：2人', () => {
    const dealerIndex = 0;
    const totalPlayers = 2;
    
    // D=0, SB=1
    assertEquals(getPositionName(0, dealerIndex, totalPlayers), null, 'Dは追加ポジションなし');
    assertEquals(getPositionName(1, dealerIndex, totalPlayers), null, 'SBは追加ポジションなし');
});

test('ポジション表示：3人', () => {
    const dealerIndex = 0;
    const totalPlayers = 3;
    
    // D=0, SB=1, BB=2
    assertEquals(getPositionName(0, dealerIndex, totalPlayers), null, 'D');
    assertEquals(getPositionName(1, dealerIndex, totalPlayers), null, 'SB');
    assertEquals(getPositionName(2, dealerIndex, totalPlayers), null, 'BB');
});

test('ポジション表示：4人（D, SB, BB, UTG）', () => {
    const dealerIndex = 0;
    const totalPlayers = 4;
    
    // D=0, SB=1, BB=2, UTG=3
    assertEquals(getPositionName(0, dealerIndex, totalPlayers), null, 'D');
    assertEquals(getPositionName(1, dealerIndex, totalPlayers), null, 'SB');
    assertEquals(getPositionName(2, dealerIndex, totalPlayers), null, 'BB');
    assertEquals(getPositionName(3, dealerIndex, totalPlayers), 'UTG', 'UTG');
});

test('ポジション表示：5人（D, SB, BB, UTG, CO）', () => {
    const dealerIndex = 0;
    const totalPlayers = 5;
    
    // D=0, SB=1, BB=2, UTG=3, CO=4
    assertEquals(getPositionName(0, dealerIndex, totalPlayers), null, 'D');
    assertEquals(getPositionName(1, dealerIndex, totalPlayers), null, 'SB');
    assertEquals(getPositionName(2, dealerIndex, totalPlayers), null, 'BB');
    assertEquals(getPositionName(3, dealerIndex, totalPlayers), 'UTG', 'UTG');
    assertEquals(getPositionName(4, dealerIndex, totalPlayers), 'CO', 'CO');
});

test('ポジション表示：6人（D, SB, BB, UTG, HJ, CO）', () => {
    const dealerIndex = 0;
    const totalPlayers = 6;
    
    // D=0, SB=1, BB=2, UTG=3, HJ=4, CO=5
    assertEquals(getPositionName(0, dealerIndex, totalPlayers), null, 'D');
    assertEquals(getPositionName(1, dealerIndex, totalPlayers), null, 'SB');
    assertEquals(getPositionName(2, dealerIndex, totalPlayers), null, 'BB');
    assertEquals(getPositionName(3, dealerIndex, totalPlayers), 'UTG', 'UTG');
    assertEquals(getPositionName(4, dealerIndex, totalPlayers), 'HJ', 'HJ');
    assertEquals(getPositionName(5, dealerIndex, totalPlayers), 'CO', 'CO');
});

test('ポジション表示：7人（D, SB, BB, UTG, LJ, HJ, CO）', () => {
    const dealerIndex = 0;
    const totalPlayers = 7;
    
    // D=0, SB=1, BB=2, UTG=3, LJ=4, HJ=5, CO=6
    assertEquals(getPositionName(0, dealerIndex, totalPlayers), null, 'D');
    assertEquals(getPositionName(1, dealerIndex, totalPlayers), null, 'SB');
    assertEquals(getPositionName(2, dealerIndex, totalPlayers), null, 'BB');
    assertEquals(getPositionName(3, dealerIndex, totalPlayers), 'UTG', 'UTG');
    assertEquals(getPositionName(4, dealerIndex, totalPlayers), 'LJ', 'LJ');
    assertEquals(getPositionName(5, dealerIndex, totalPlayers), 'HJ', 'HJ');
    assertEquals(getPositionName(6, dealerIndex, totalPlayers), 'CO', 'CO');
});

test('ポジション表示：ディーラー移動（6人）', () => {
    const dealerIndex = 2; // ディーラーが2番目
    const totalPlayers = 6;
    
    // D=2, SB=3, BB=4, UTG=5, HJ=0, CO=1
    assertEquals(getPositionName(2, dealerIndex, totalPlayers), null, 'D');
    assertEquals(getPositionName(3, dealerIndex, totalPlayers), null, 'SB');
    assertEquals(getPositionName(4, dealerIndex, totalPlayers), null, 'BB');
    assertEquals(getPositionName(5, dealerIndex, totalPlayers), 'UTG', 'UTG');
    assertEquals(getPositionName(0, dealerIndex, totalPlayers), 'HJ', 'HJ');
    assertEquals(getPositionName(1, dealerIndex, totalPlayers), 'CO', 'CO');
});

test('バッジ表示：D, SB, BBの確認', () => {
    const players = [
        { id: '1', name: 'Alice', chips: 1000 },
        { id: '2', name: 'Bob', chips: 1000 },
        { id: '3', name: 'Carol', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    const state = game.getState();
    const dealerIndex = state.dealerIndex;
    const sbIndex = (dealerIndex + 1) % 3;
    const bbIndex = (dealerIndex + 2) % 3;
    
    assertEquals(dealerIndex, 0, 'ディーラーは0番');
    assertEquals(sbIndex, 1, 'SBは1番');
    assertEquals(bbIndex, 2, 'BBは2番');
});

test('バッジ表示：6人でのポジション確認', () => {
    const players = [
        { id: '1', name: 'P1', chips: 1000 },
        { id: '2', name: 'P2', chips: 1000 },
        { id: '3', name: 'P3', chips: 1000 },
        { id: '4', name: 'P4', chips: 1000 },
        { id: '5', name: 'P5', chips: 1000 },
        { id: '6', name: 'P6', chips: 1000 }
    ];
    const game = new PokerGame(players, 10, 20);
    game.start();
    
    const state = game.getState();
    const dealerIndex = state.dealerIndex;
    
    // 各ポジションを確認
    const positions = [];
    for (let i = 0; i < 6; i++) {
        const sbIndex = (dealerIndex + 1) % 6;
        const bbIndex = (dealerIndex + 2) % 6;
        
        if (i === dealerIndex) positions.push('D');
        else if (i === sbIndex) positions.push('SB');
        else if (i === bbIndex) positions.push('BB');
        else {
            const pos = getPositionName(i, dealerIndex, 6);
            positions.push(pos || 'NONE');
        }
    }
    
    // D, SB, BB, UTG, HJ, COが含まれているか確認
    assertTrue(positions.includes('D'), 'Dあり');
    assertTrue(positions.includes('SB'), 'SBあり');
    assertTrue(positions.includes('BB'), 'BBあり');
    assertTrue(positions.includes('UTG'), 'UTGあり');
    assertTrue(positions.includes('HJ'), 'HJあり');
    assertTrue(positions.includes('CO'), 'COあり');
});

// テスト実行
async function runTests() {
    console.log('🎨 UIテスト開始\n');
    
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
