# iPhone専用・無料ポーカー（WebRTC）

## 概要
このプロジェクトは **iPhoneだけ** で動作する  
**お金をかけない（仮想チップのみ）ポーカー** を目的とした Web アプリです。

- App Store 非公開
- サーバ維持費 0 円
- マンションWi-Fi（端末分離あり）対応
- Safari で URL を開くだけ
- WebRTC による P2P 通信

---

## 特徴
- 現金・換金要素なし
- iPhone Safari 対応
- インストール不要（ホーム画面追加可）
- ゲーム通信は完全 P2P
- 無料枠のみで運用可能

---

## 要件（Requirements）

### 機能要件
- 2〜7 人でプレイ可能
- テキサスホールデム方式
- 仮想チップのみ使用
- ホスト（ディーラー）方式
- 1 テーブル制

### 非機能要件
- サーバ代 0 円
- Mac 不要
- iPhone 単体で利用可能
- Apple 審査不要
- HTTPS 必須

### 制約
- 完全オフライン不可
- TURN サーバ未使用（接続不可な環境あり）
- 切断時はゲーム終了扱い

---

## 技術スタック（Technology Stack）

### フロントエンド
- HTML5
- CSS
- JavaScript（ES6）

### 実行環境
- iOS Safari
- ホーム画面追加で疑似アプリ化

### 通信
- WebRTC DataChannel（P2P）

### シグナリング
- Firebase Realtime Database（無料枠）
  - 接続開始時のみ使用
  - ゲームデータは通らない

### ホスティング
- GitHub Pages（HTTPS / 無料）

---

## システム構成

iPhone（ホスト）  
↔ WebRTC DataChannel（P2P）  
↔ iPhone（参加者）

※ 接続時のみ Firebase を使用（Offer / Answer / ICE）

---

## ファイル構成

index.html  
style.css  
main.js  
webrtc.js  
poker.js  

---

## ポーカーゲーム設計

### ゲーム状態（State）
- phase: WAITING / PREFLOP / FLOP / TURN / RIVER / SHOWDOWN
- deck: 山札
- players: プレイヤー配列
- community: 共通カード
- pot: ポット
- currentBet: 現在ベット額
- turnIndex: 手番

### 役割

ホスト  
- 山札生成・シャッフル  
- カード配布  
- ベット管理  
- 状態同期  

参加者  
- ベット / フォールド操作送信  
- 表示のみ担当  

---

## ロジック実装方針

- すべてのゲームロジックはホストが保持
- クライアントは「操作要求」のみ送信
- 状態は 1 オブジェクトで一元管理

---

## ロジック実装例（概要）

### 山札生成
- スート：S / H / D / C
- ランク：2〜A
- 52 枚を配列で管理

### シャッフル
- Fisher–Yates アルゴリズム

### ゲーム開始
- 山札生成 → シャッフル
- 各プレイヤーに 2 枚配布
- フェーズを PREFLOP に変更

### ベット処理
- 所持チップ確認
- チップ減算
- ポット加算
- currentBet 更新

### フェーズ進行
- PREFLOP → FLOP（3 枚）
- FLOP → TURN（1 枚）
- TURN → RIVER（1 枚）
- RIVER → SHOWDOWN

### 勝敗判定（初期実装）
- フォールドしていないプレイヤーから勝者決定
- ポットを勝者に付与
- 次ゲームへ

※ 役判定は後から拡張可能

---

## 通信メッセージ設計（例）

クライアント → ホスト  
- join（参加）
- bet（ベット）
- fold（フォールド）

ホスト → 全員  
- state（ゲーム状態更新）
- deal（手札配布）
- result（勝敗）

---

## 実装手順

1. GitHub Pages を有効化
2. Firebase Realtime Database を作成
3. WebRTC DataChannel 接続実装
4. poker.js にゲームロジック実装
5. UI 作成（iPhone縦画面）
6. Safari で動作確認
7. ホーム画面に追加

---

## 注意事項
- 本アプリは娯楽目的のみ
- 金銭・換金・外部価値なし
- 接続できないネットワーク環境あり

---

## 今後の拡張
- 正式な役判定ロジック
- UI/UX 改善
- 切断耐性向上
- 観戦モード

---

## ライセンス
Private / Personal Use Only
