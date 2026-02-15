export class PokerGame {
    constructor(players, sb, bb) {
        this.players = players.map((p, i) => ({
            ...p,
            hand: [],
            bet: 0,
            folded: false,
            position: i,
            acted: false
        }));
        this.sb = sb;
        this.bb = bb;
        this.deck = [];
        this.community = [];
        this.pot = 0;
        this.currentBet = 0;
        this.phase = 'PREFLOP';
        this.turnIndex = 0;
        this.dealerIndex = 0;
        this.lastRaiserIndex = -1;
    }

    // 山札生成
    createDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        this.deck = [];
        suits.forEach(suit => {
            ranks.forEach(rank => {
                this.deck.push({ suit, rank });
            });
        });
    }

    // シャッフル
    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    // ゲーム開始
    start() {
        this.createDeck();
        this.shuffle();
        
        // ブラインド設定
        const sbIndex = (this.dealerIndex + 1) % this.players.length;
        const bbIndex = (this.dealerIndex + 2) % this.players.length;
        
        this.players[sbIndex].chips -= this.sb;
        this.players[sbIndex].bet = this.sb;
        this.players[sbIndex].acted = false;
        this.pot += this.sb;
        
        this.players[bbIndex].chips -= this.bb;
        this.players[bbIndex].bet = this.bb;
        this.players[bbIndex].acted = false;
        this.pot += this.bb;
        
        this.currentBet = this.bb;
        this.lastRaiserIndex = -1;
        this.turnIndex = (bbIndex + 1) % this.players.length;
        
        // 手札配布
        this.players.forEach(p => {
            p.hand = [this.deck.pop(), this.deck.pop()];
        });
        
        this.phase = 'PREFLOP';
    }

    // ベット処理
    bet(playerIndex, amount) {
        const player = this.players[playerIndex];
        const totalBet = Math.min(amount, player.chips);
        
        player.chips -= totalBet;
        player.bet += totalBet;
        player.acted = true;
        this.pot += totalBet;
        
        if (player.bet > this.currentBet) {
            this.currentBet = player.bet;
            this.lastRaiserIndex = playerIndex;
            // レイズされたら他のプレイヤーのactedをリセット
            this.players.forEach((p, i) => {
                if (i !== playerIndex && !p.folded) {
                    p.acted = false;
                }
            });
        }
        
        this.nextTurn();
    }

    // コール
    call(playerIndex) {
        const player = this.players[playerIndex];
        const toCall = Math.min(this.currentBet - player.bet, player.chips);
        
        player.chips -= toCall;
        player.bet += toCall;
        player.acted = true;
        this.pot += toCall;
        
        this.nextTurn();
    }

    // フォールド
    fold(playerIndex) {
        this.players[playerIndex].folded = true;
        this.players[playerIndex].acted = true;
        
        // 1人だけ残ったら即終了（手札公開なし）
        const activePlayers = this.players.filter(p => !p.folded);
        if (activePlayers.length === 1) {
            this.phase = 'WINNER';
            activePlayers[0].chips += this.pot;
            this.winner = activePlayers[0];
            return;
        }
        
        this.nextTurn();
    }

    // チェック
    check(playerIndex) {
        this.players[playerIndex].acted = true;
        this.nextTurn();
    }

    // 次のターン
    nextTurn() {
        const activePlayers = this.players.filter(p => !p.folded);
        
        // 全員アクション済みかつベット額が揃っているかチェック
        const allActed = activePlayers.every(p => p.acted);
        const allBetsEqual = activePlayers.every(p => p.bet === this.currentBet || p.chips === 0);
        
        if (allActed && allBetsEqual) {
            this.nextPhase();
            return;
        }
        
        // 次のプレイヤー
        do {
            this.turnIndex = (this.turnIndex + 1) % this.players.length;
        } while (this.players[this.turnIndex].folded);
    }

    // 次のフェーズ
    nextPhase() {
        // ベットリセット
        this.players.forEach(p => {
            p.bet = 0;
            p.acted = false;
        });
        this.currentBet = 0;
        this.lastRaiserIndex = -1;
        
        // 最初のアクティブプレイヤーから開始
        this.turnIndex = (this.dealerIndex + 1) % this.players.length;
        while (this.players[this.turnIndex].folded) {
            this.turnIndex = (this.turnIndex + 1) % this.players.length;
        }
        
        if (this.phase === 'PREFLOP') {
            this.community = [this.deck.pop(), this.deck.pop(), this.deck.pop()];
            this.phase = 'FLOP';
        } else if (this.phase === 'FLOP') {
            this.community.push(this.deck.pop());
            this.phase = 'TURN';
        } else if (this.phase === 'TURN') {
            this.community.push(this.deck.pop());
            this.phase = 'RIVER';
        } else if (this.phase === 'RIVER') {
            this.phase = 'SHOWDOWN';
            this.determineWinner();
        }
    }

    // 勝者決定（簡易版）
    determineWinner() {
        const activePlayers = this.players.filter(p => !p.folded);
        
        if (activePlayers.length === 1) {
            const winAmount = this.pot;
            activePlayers[0].chips += winAmount;
            this.winner = activePlayers[0];
            this.winAmount = winAmount;
            return activePlayers[0];
        }
        
        // 役判定して勝者決定
        const ranked = activePlayers.map(p => ({
            player: p,
            rank: this.evaluateHand(p.hand),
            handName: this.getHandName(p.hand)
        }));
        
        ranked.sort((a, b) => b.rank - a.rank);
        const winner = ranked[0].player;
        const winAmount = this.pot;
        winner.chips += winAmount;
        
        this.winner = winner;
        this.winAmount = winAmount;
        this.winningHand = ranked[0].handName;
        
        return winner;
    }
    
    // 役名を取得
    getHandName(hand) {
        const allCards = [...hand, ...this.community];
        const rankValues = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
        
        const cards = allCards.map(c => ({ rank: c.rank, suit: c.suit, value: rankValues[c.rank] }));
        cards.sort((a, b) => b.value - a.value);
        
        const rankCounts = {};
        cards.forEach(c => {
            rankCounts[c.value] = (rankCounts[c.value] || 0) + 1;
        });
        
        const counts = Object.entries(rankCounts).map(([rank, count]) => ({ rank: parseInt(rank), count }));
        counts.sort((a, b) => b.count - a.count || b.rank - a.rank);
        
        const suitCounts = {};
        cards.forEach(c => {
            suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
        });
        
        const isFlush = Object.values(suitCounts).some(count => count >= 5);
        
        const uniqueValues = [...new Set(cards.map(c => c.value))].sort((a, b) => b - a);
        let isStraight = false;
        
        for (let i = 0; i <= uniqueValues.length - 5; i++) {
            if (uniqueValues[i] - uniqueValues[i + 4] === 4) {
                isStraight = true;
                break;
            }
        }
        
        if (!isStraight && uniqueValues.includes(14) && uniqueValues.includes(5) && 
            uniqueValues.includes(4) && uniqueValues.includes(3) && uniqueValues.includes(2)) {
            isStraight = true;
        }
        
        if (isFlush && isStraight) return 'ストレートフラッシュ';
        if (counts[0].count === 4) return 'フォーカード';
        if (counts[0].count === 3 && counts[1].count >= 2) return 'フルハウス';
        if (isFlush) return 'フラッシュ';
        if (isStraight) return 'ストレート';
        if (counts[0].count === 3) return 'スリーカード';
        if (counts[0].count === 2 && counts[1].count === 2) return 'ツーペア';
        if (counts[0].count === 2) return 'ワンペア';
        return 'ハイカード';
    }

    // 役判定（正式版）
    evaluateHand(hand) {
        const allCards = [...hand, ...this.community];
        const rankValues = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
        
        // カードをランクと数値に変換
        const cards = allCards.map(c => ({ rank: c.rank, suit: c.suit, value: rankValues[c.rank] }));
        cards.sort((a, b) => b.value - a.value);
        
        // ランクごとの枚数をカウント
        const rankCounts = {};
        cards.forEach(c => {
            rankCounts[c.value] = (rankCounts[c.value] || 0) + 1;
        });
        
        const counts = Object.entries(rankCounts).map(([rank, count]) => ({ rank: parseInt(rank), count }));
        counts.sort((a, b) => b.count - a.count || b.rank - a.rank);
        
        // スートごとの枚数をカウント
        const suitCounts = {};
        cards.forEach(c => {
            suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
        });
        
        const isFlush = Object.values(suitCounts).some(count => count >= 5);
        
        // ストレート判定
        const uniqueValues = [...new Set(cards.map(c => c.value))].sort((a, b) => b - a);
        let isStraight = false;
        let straightHigh = 0;
        
        for (let i = 0; i <= uniqueValues.length - 5; i++) {
            if (uniqueValues[i] - uniqueValues[i + 4] === 4) {
                isStraight = true;
                straightHigh = uniqueValues[i];
                break;
            }
        }
        
        // A-2-3-4-5のストレート（ホイール）
        if (!isStraight && uniqueValues.includes(14) && uniqueValues.includes(5) && 
            uniqueValues.includes(4) && uniqueValues.includes(3) && uniqueValues.includes(2)) {
            isStraight = true;
            straightHigh = 5;
        }
        
        // 役の判定
        // ストレートフラッシュ
        if (isFlush && isStraight) {
            return 8000000 + straightHigh;
        }
        
        // フォーカード
        if (counts[0].count === 4) {
            return 7000000 + counts[0].rank * 1000 + counts[1].rank;
        }
        
        // フルハウス
        if (counts[0].count === 3 && counts[1].count >= 2) {
            return 6000000 + counts[0].rank * 1000 + counts[1].rank;
        }
        
        // フラッシュ
        if (isFlush) {
            return 5000000 + cards[0].value * 10000 + cards[1].value * 100 + cards[2].value;
        }
        
        // ストレート
        if (isStraight) {
            return 4000000 + straightHigh;
        }
        
        // スリーカード
        if (counts[0].count === 3) {
            return 3000000 + counts[0].rank * 10000 + counts[1].rank * 100 + counts[2].rank;
        }
        
        // ツーペア
        if (counts[0].count === 2 && counts[1].count === 2) {
            return 2000000 + counts[0].rank * 10000 + counts[1].rank * 100 + counts[2].rank;
        }
        
        // ワンペア
        if (counts[0].count === 2) {
            return 1000000 + counts[0].rank * 10000 + counts[1].rank * 100 + counts[2].rank;
        }
        
        // ハイカード
        return cards[0].value * 10000 + cards[1].value * 100 + cards[2].value;
    }

    // 状態取得
    getState() {
        return {
            players: this.players,
            community: this.community,
            pot: this.pot,
            currentBet: this.currentBet,
            phase: this.phase,
            turnIndex: this.turnIndex,
            dealerIndex: this.dealerIndex,
            sb: this.sb,
            bb: this.bb,
            winner: this.winner,
            winAmount: this.winAmount,
            winningHand: this.winningHand
        };
    }

    // プレイヤー用状態（手札は自分のみ）
    getPlayerState(playerIndex) {
        const state = this.getState();
        state.players = state.players.map((p, i) => ({
            ...p,
            hand: i === playerIndex ? p.hand : []
        }));
        return state;
    }
}
