# Firebase セットアップ（Realtime Database ルール）

ログアウト後に再ログインできない・`permission_denied` が出る場合は、**Realtime Database のセキュリティルール**が未設定の可能性があります。

## 手順

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクトを開く
2. 左メニュー **Realtime Database** → **ルール** タブ
3. 次のルールを貼り付けて **公開** する（または `database.rules.json` の内容をコピー）

```json
{
  "rules": {
    "userSessions": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "roomMeta": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "rooms": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

- **userSessions**: ログイン中のセッション管理（単一ログイン制御）用。自分の UID のみ読み書き可能。
- **roomMeta** / **rooms**: ルーム一覧・WebRTC シグナリング用。認証済みユーザーが読み書き可能。

ルールを反映すると、ログアウト→再ログインができるようになります。
