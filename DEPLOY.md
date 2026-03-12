# Vercelデプロイ手順

## 前提条件
- Vercelアカウント作成済み
- TURNサーバーの認証情報を取得済み

## 手順

### 1. Vercel CLIインストール
```bash
npm install -g vercel
```

### 2. Vercelにログイン
```bash
vercel login
```

### 3. プロジェクトをVercelにリンク
```bash
vercel link
```

### 4. 環境変数を設定

#### 方法A: Vercel CLIで設定
```bash
vercel env add TURN_SERVER_URL
# 値を入力: your-turn-server.com

vercel env add TURN_USERNAME
# 値を入力: your-username

vercel env add TURN_CREDENTIAL
# 値を入力: your-password
```

#### 方法B: Vercel Dashboardで設定
1. https://vercel.com/dashboard にアクセス
2. プロジェクトを選択
3. Settings → Environment Variables
4. 以下を追加:
   - `TURN_SERVER_URL`: TURNサーバーのURL
   - `TURN_USERNAME`: 認証ユーザー名
   - `TURN_CREDENTIAL`: 認証パスワード

### 5. デプロイ

#### 初回デプロイ
```bash
vercel
```

#### 本番デプロイ
```bash
vercel --prod
```

## TURNサーバーの選択肢

### オプション1: Metered（無料枠あり）
1. https://www.metered.ca/tools/openrelay/ にアクセス
2. 認証情報を取得
3. 環境変数に設定:
   ```
   TURN_SERVER_URL=a.relay.metered.ca
   TURN_USERNAME=（取得した値）
   TURN_CREDENTIAL=（取得した値）
   ```

### オプション2: 自前のTURNサーバー
1. VPS（AWS EC2等）にcoturnをインストール
2. 設定ファイルでユーザー名とパスワードを設定
3. 環境変数に設定:
   ```
   TURN_SERVER_URL=your-server-ip
   TURN_USERNAME=pokeruser
   TURN_CREDENTIAL=SecurePassword123
   ```

## セキュリティチェックリスト

- [ ] `.env`ファイルが`.gitignore`に含まれている
- [ ] 環境変数がGitにコミットされていない
- [ ] Vercel Dashboardで環境変数が設定されている
- [ ] TURNサーバーの認証情報が強固なパスワード

## トラブルシューティング

### 環境変数が読み込まれない
```bash
# 環境変数を確認
vercel env ls

# 再デプロイ
vercel --prod --force
```

### TURN接続が失敗する
1. ブラウザのコンソールでICE Serversを確認
2. TURNサーバーが起動しているか確認
3. ファイアウォール設定を確認（ポート3478, 5349）

## ローカル開発

### 1. .envファイル作成
```bash
cp .env.example .env
# .envファイルを編集して認証情報を入力
```

### 2. ローカルサーバー起動
```bash
vercel dev
```

これで `http://localhost:3000` でアクセス可能
