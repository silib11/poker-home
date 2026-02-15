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
        this.players[sbIndex].acted = true;
        this.pot += this.sb;
        
        this.players[bbIndex].chips -= this.bb;
        this.players[bbIndex].bet = this.bb;
        this.players[bbIndex].acted = true;
        this.pot += this.bb;
        
        this.currentBet = this.bb;
        this.lastRaiserIndex = bbIndex;
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
        
        // 1人だけ残ったら即終了
        const activePlayers = this.players.filter(p => !p.folded);
        if (activePlayers.length === 1) {
            this.phase = 'SHOWDOWN';
            this.determineWinner();
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
            activePlayers[0].chips += this.pot;
            return activePlayers[0];
        }
        
        // 役判定して勝者決定
        const ranked = activePlayers.map(p => ({
            player: p,
            rank: this.evaluateHand(p.hand)
        }));
        
        ranked.sort((a, b) => b.rank - a.rank);
        const winner = ranked[0].player;
        winner.chips += this.pot;
        
        return winner;
    }

    // 役判定（簡易版：ハイカードのみ）
    evaluateHand(hand) {
        const allCards = [...hand, ...this.community];
        const rankValues = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
        
        // とりあえず最高カードの値を返す
        return Math.max(...allCards.map(c => rankValues[c.rank]));
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
            bb: this.bb
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
