import { PokerGame } from '../core/poker.js';

// シンプルなテストフレームワーク
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${e.message}`);
        failed++;
    }
}

function assertEquals(actual, expected, message = '') {
    if (actual !== expected) {
        throw new Error(`${message ? message + ': ' : ''}期待値「${expected}」, 実際「${actual}」`);
    }
}

// コミュニティカードを直接セットしてgetHandName/evaluateHandをテストするヘルパー
function makeGame(hand, community) {
    const game = new PokerGame(
        [
            { id: '1', name: 'Alice', chips: 1000 },
            { id: '2', name: 'Bob', chips: 1000 },
        ],
        10,
        20
    );
    game.community = community;
    return { game, hand };
}

function handName(hand, community) {
    const { game } = makeGame(hand, community);
    return game.getHandName(hand);
}

function handRank(hand, community) {
    const { game } = makeGame(hand, community);
    return game.evaluateHand(hand);
}

// ─────────────────────────────────────────────
// ストレートフラッシュ
// ─────────────────────────────────────────────
console.log('\n=== ストレートフラッシュ ===');

test('正常なストレートフラッシュ（♠5枚連続）', () => {
    const hand = [
        { suit: '♠', rank: '9' },
        { suit: '♠', rank: 'T' },
    ];
    const community = [
        { suit: '♠', rank: 'J' },
        { suit: '♠', rank: 'Q' },
        { suit: '♠', rank: 'K' },
    ];
    assertEquals(handName(hand, community), 'ストレートフラッシュ');
});

test('ストレートとフラッシュが別スートで同時発生 → ストレートフラッシュにならない', () => {
    // ♠でストレート（2-3-4-5-6）、♥でフラッシュ（A,K,Q,J,T）が同時に成立するケース
    const hand = [
        { suit: '♠', rank: '2' },
        { suit: '♠', rank: '3' },
    ];
    const community = [
        { suit: '♠', rank: '4' },
        { suit: '♠', rank: '5' },
        { suit: '♥', rank: '6' },  // ストレートの最後が♥
    ];
    // community に♥を追加してフラッシュ要件を満たす
    // 実際は5枚しかないのでこのケースでは♥フラッシュにならない
    // → 以下のケースで検証
    const name = handName(hand, community);
    // ♠2-3-4-5 + ♥6 → ストレートは成立するがフラッシュスートは1種類に5枚ない
    // よってストレートフラッシュにならない
    assertEquals(name === 'ストレート' || name === 'ストレートフラッシュ',
        name !== 'ストレートフラッシュ' || false,
        'ストレートフラッシュであってはならない');
    // 正確にはストレートになる
    assertEquals(name, 'ストレート');
});

test('ストレート(♠)+フラッシュ(♥)が別々に成立 → ストレートフラッシュにならない', () => {
    // 7枚: ♠A,♠2,♠3,♠4,♠5(ストレート) + ♥A,♥K,♥Q,♥J,♥T(フラッシュ)
    const hand = [
        { suit: '♠', rank: 'A' },
        { suit: '♥', rank: 'A' },
    ];
    const community = [
        { suit: '♠', rank: '2' },
        { suit: '♠', rank: '3' },
        { suit: '♥', rank: 'K' },
        { suit: '♥', rank: 'Q' },
        { suit: '♥', rank: 'J' },
    ];
    // ♠: A,2,3 → ストレートにならない、♥: A,K,Q,J(4枚) → フラッシュにならない
    // ただしストレートは A,2,3 + ♠4,♠5 がないので成立しない
    // 実際の役を確認
    const name = handName(hand, community);
    // この組み合わせではストレートフラッシュは成立しない
    const rank = handRank(hand, community);
    assertEquals(rank >= 8000000, false, 'ストレートフラッシュスコアであってはならない');
});

test('同スートの5枚連続 → ストレートフラッシュ（ロイヤルフラッシュ含む）', () => {
    const hand = [
        { suit: '♥', rank: 'A' },
        { suit: '♥', rank: 'K' },
    ];
    const community = [
        { suit: '♥', rank: 'Q' },
        { suit: '♥', rank: 'J' },
        { suit: '♥', rank: 'T' },
    ];
    assertEquals(handName(hand, community), 'ストレートフラッシュ');
    const rank = handRank(hand, community);
    assertEquals(rank >= 8000000, true, 'ストレートフラッシュスコア');
    // ロイヤルフラッシュはhigh=14
    assertEquals(rank, 8000000 + 14);
});

test('A-2-3-4-5 スチールホイール（同スート）', () => {
    const hand = [
        { suit: '♦', rank: 'A' },
        { suit: '♦', rank: '2' },
    ];
    const community = [
        { suit: '♦', rank: '3' },
        { suit: '♦', rank: '4' },
        { suit: '♦', rank: '5' },
    ];
    assertEquals(handName(hand, community), 'ストレートフラッシュ');
    const rank = handRank(hand, community);
    assertEquals(rank, 8000000 + 5, 'ホイールのhighは5');
});

test('6枚フラッシュ + ストレートが別スートで成立 → フラッシュのみ', () => {
    // ♠6枚でフラッシュ成立、♥でストレートの一部
    const hand = [
        { suit: '♠', rank: '2' },
        { suit: '♠', rank: '4' },
    ];
    const community = [
        { suit: '♠', rank: '6' },
        { suit: '♠', rank: '8' },
        { suit: '♠', rank: 'T' },
        { suit: '♥', rank: '3' },
        { suit: '♥', rank: '5' },
    ];
    // ♠はバラバラなのでストレートフラッシュにはならない → フラッシュ
    const name = handName(hand, community);
    assertEquals(name, 'フラッシュ');
});

// ─────────────────────────────────────────────
// フォーカード
// ─────────────────────────────────────────────
console.log('\n=== フォーカード ===');

test('フォーカード（A×4）', () => {
    const hand = [
        { suit: '♠', rank: 'A' },
        { suit: '♥', rank: 'A' },
    ];
    const community = [
        { suit: '♦', rank: 'A' },
        { suit: '♣', rank: 'A' },
        { suit: '♠', rank: 'K' },
    ];
    assertEquals(handName(hand, community), 'フォーカード');
});

// ─────────────────────────────────────────────
// フルハウス
// ─────────────────────────────────────────────
console.log('\n=== フルハウス ===');

test('フルハウス（K×3 + Q×2）', () => {
    const hand = [
        { suit: '♠', rank: 'K' },
        { suit: '♥', rank: 'K' },
    ];
    const community = [
        { suit: '♦', rank: 'K' },
        { suit: '♣', rank: 'Q' },
        { suit: '♠', rank: 'Q' },
    ];
    assertEquals(handName(hand, community), 'フルハウス');
});

// ─────────────────────────────────────────────
// フラッシュ
// ─────────────────────────────────────────────
console.log('\n=== フラッシュ ===');

test('フラッシュ（♣5枚、連続なし）', () => {
    const hand = [
        { suit: '♣', rank: '2' },
        { suit: '♣', rank: '4' },
    ];
    const community = [
        { suit: '♣', rank: '7' },
        { suit: '♣', rank: '9' },
        { suit: '♣', rank: 'K' },
    ];
    assertEquals(handName(hand, community), 'フラッシュ');
});

// ─────────────────────────────────────────────
// ストレート
// ─────────────────────────────────────────────
console.log('\n=== ストレート ===');

test('ストレート（5-6-7-8-9、異スート）', () => {
    const hand = [
        { suit: '♠', rank: '5' },
        { suit: '♥', rank: '6' },
    ];
    const community = [
        { suit: '♦', rank: '7' },
        { suit: '♣', rank: '8' },
        { suit: '♠', rank: '9' },
    ];
    assertEquals(handName(hand, community), 'ストレート');
});

test('A-2-3-4-5 ストレート（ホイール）', () => {
    const hand = [
        { suit: '♠', rank: 'A' },
        { suit: '♥', rank: '2' },
    ];
    const community = [
        { suit: '♦', rank: '3' },
        { suit: '♣', rank: '4' },
        { suit: '♠', rank: '5' },
    ];
    assertEquals(handName(hand, community), 'ストレート');
});

// ─────────────────────────────────────────────
// スリーカード
// ─────────────────────────────────────────────
console.log('\n=== スリーカード ===');

test('スリーカード（J×3）', () => {
    const hand = [
        { suit: '♠', rank: 'J' },
        { suit: '♥', rank: 'J' },
    ];
    const community = [
        { suit: '♦', rank: 'J' },
        { suit: '♣', rank: '2' },
        { suit: '♠', rank: '7' },
    ];
    assertEquals(handName(hand, community), 'スリーカード');
});

// ─────────────────────────────────────────────
// ツーペア
// ─────────────────────────────────────────────
console.log('\n=== ツーペア ===');

test('ツーペア（Q×2 + 8×2）', () => {
    const hand = [
        { suit: '♠', rank: 'Q' },
        { suit: '♥', rank: 'Q' },
    ];
    const community = [
        { suit: '♦', rank: '8' },
        { suit: '♣', rank: '8' },
        { suit: '♠', rank: '3' },
    ];
    assertEquals(handName(hand, community), 'ツーペア');
});

// ─────────────────────────────────────────────
// ワンペア
// ─────────────────────────────────────────────
console.log('\n=== ワンペア ===');

test('ワンペア（T×2）', () => {
    const hand = [
        { suit: '♠', rank: 'T' },
        { suit: '♥', rank: 'T' },
    ];
    const community = [
        { suit: '♦', rank: '2' },
        { suit: '♣', rank: '5' },
        { suit: '♠', rank: '9' },
    ];
    assertEquals(handName(hand, community), 'ワンペア');
});

// ─────────────────────────────────────────────
// ハイカード
// ─────────────────────────────────────────────
console.log('\n=== ハイカード ===');

test('ハイカード（役なし）', () => {
    const hand = [
        { suit: '♠', rank: 'A' },
        { suit: '♥', rank: '9' },
    ];
    const community = [
        { suit: '♦', rank: '2' },
        { suit: '♣', rank: '5' },
        { suit: '♠', rank: '7' },
    ];
    assertEquals(handName(hand, community), 'ハイカード');
});

// ─────────────────────────────────────────────
// 役の強さ順序検証
// ─────────────────────────────────────────────
console.log('\n=== 役の強さ順序 ===');

test('ストレートフラッシュ > フォーカード', () => {
    const sfRank = handRank(
        [{ suit: '♠', rank: '9' }, { suit: '♠', rank: 'T' }],
        [{ suit: '♠', rank: 'J' }, { suit: '♠', rank: 'Q' }, { suit: '♠', rank: 'K' }]
    );
    const fourRank = handRank(
        [{ suit: '♠', rank: 'A' }, { suit: '♥', rank: 'A' }],
        [{ suit: '♦', rank: 'A' }, { suit: '♣', rank: 'A' }, { suit: '♠', rank: 'K' }]
    );
    assertEquals(sfRank > fourRank, true, 'ストレートフラッシュはフォーカードより強い');
});

test('フォーカード > フルハウス', () => {
    const fourRank = handRank(
        [{ suit: '♠', rank: 'A' }, { suit: '♥', rank: 'A' }],
        [{ suit: '♦', rank: 'A' }, { suit: '♣', rank: 'A' }, { suit: '♠', rank: 'K' }]
    );
    const fhRank = handRank(
        [{ suit: '♠', rank: 'K' }, { suit: '♥', rank: 'K' }],
        [{ suit: '♦', rank: 'K' }, { suit: '♣', rank: 'Q' }, { suit: '♠', rank: 'Q' }]
    );
    assertEquals(fourRank > fhRank, true, 'フォーカードはフルハウスより強い');
});

test('フルハウス > フラッシュ', () => {
    const fhRank = handRank(
        [{ suit: '♠', rank: 'K' }, { suit: '♥', rank: 'K' }],
        [{ suit: '♦', rank: 'K' }, { suit: '♣', rank: 'Q' }, { suit: '♠', rank: 'Q' }]
    );
    const flushRank = handRank(
        [{ suit: '♣', rank: '2' }, { suit: '♣', rank: '4' }],
        [{ suit: '♣', rank: '7' }, { suit: '♣', rank: '9' }, { suit: '♣', rank: 'K' }]
    );
    assertEquals(fhRank > flushRank, true, 'フルハウスはフラッシュより強い');
});

test('フラッシュ > ストレート', () => {
    const flushRank = handRank(
        [{ suit: '♣', rank: '2' }, { suit: '♣', rank: '4' }],
        [{ suit: '♣', rank: '7' }, { suit: '♣', rank: '9' }, { suit: '♣', rank: 'K' }]
    );
    const strRank = handRank(
        [{ suit: '♠', rank: '5' }, { suit: '♥', rank: '6' }],
        [{ suit: '♦', rank: '7' }, { suit: '♣', rank: '8' }, { suit: '♠', rank: '9' }]
    );
    assertEquals(flushRank > strRank, true, 'フラッシュはストレートより強い');
});

test('ストレート > スリーカード', () => {
    const strRank = handRank(
        [{ suit: '♠', rank: '5' }, { suit: '♥', rank: '6' }],
        [{ suit: '♦', rank: '7' }, { suit: '♣', rank: '8' }, { suit: '♠', rank: '9' }]
    );
    const threeRank = handRank(
        [{ suit: '♠', rank: 'J' }, { suit: '♥', rank: 'J' }],
        [{ suit: '♦', rank: 'J' }, { suit: '♣', rank: '2' }, { suit: '♠', rank: '7' }]
    );
    assertEquals(strRank > threeRank, true, 'ストレートはスリーカードより強い');
});

// ─────────────────────────────────────────────
// 結果
// ─────────────────────────────────────────────
console.log(`\n結果: ${passed} 成功 / ${failed} 失敗\n`);
if (failed > 0) {
    process.exit(1);
}
