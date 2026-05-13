# 授業管理アプリ

通信制高校など、授業日が連続しない学校向けの授業予定・出席管理アプリです。Next.js、TypeScript、Tailwind CSS、Supabase Auth / Database で作っています。

## 主な機能

- メールアドレス・パスワードでログイン / 新規登録
- 初回ログイン時に初期科目を自動登録
- 非連続の日付を追加し、各日付に1限から6限のコマを作成
- 登録済み科目から授業コマへ科目を割り当て
- 授業ごとの済 / 未済切り替え
- 科目ごとの出席数、総授業数、最低出席数を自動表示
- 最低出席数の半分以上で淡い黄色、最低出席数達成で淡い緑に色分け
- 科目の追加・編集・非表示・再表示
- PC は表形式とサイドバー、スマホはカード表示と下部ナビゲーションに対応
- PWA としてホーム画面に追加可能

## セットアップ

1. 依存関係をインストールします。

```bash
npm install
```

2. Supabase プロジェクトを作成し、SQL Editor で `supabase/schema.sql` を実行します。

3. `.env.example` を参考に `.env.local` を作成します。

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. 開発サーバーを起動します。

```bash
npm run dev
```

5. ブラウザで `http://localhost:3000` を開きます。

## GitHub Pages に公開する

このアプリは静的書き出しに対応しています。GitHub Pages へ公開すると、スマホから同じURLを開いてPWAとしてホーム画面に追加できます。

1. GitHubで新しいリポジトリを作成します。

2. このフォルダをGitHubへpushします。

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/ユーザー名/リポジトリ名.git
git push -u origin main
```

3. GitHubのリポジトリ画面で、`Settings` → `Secrets and variables` → `Actions` → `Secrets` に以下を追加します。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. `Settings` → `Pages` → `Build and deployment` で、`Source` を `GitHub Actions` にします。

5. `Actions` タブで `Deploy to GitHub Pages` が成功すると、`https://ユーザー名.github.io/リポジトリ名/` で開けます。

Supabase Auth のメール認証を使う場合は、Supabase側の `Authentication` → `URL Configuration` で、GitHub Pages のURLを `Site URL` と `Redirect URLs` に追加してください。

## Supabase 構成

`supabase/schema.sql` に以下が含まれています。

- `subjects`: 科目
- `school_days`: 授業日
- `lesson_slots`: 1限から6限の授業コマ
- `updated_at` 自動更新トリガー
- `school_days` 作成時に `lesson_slots` を6件作成するトリガー
- 全テーブルの Row Level Security
- `auth.uid()` によるユーザーごとのデータ分離

## ファイル構成

- `app/page.tsx`: 認証、メイン画面、科目管理、授業詳細、科目選択モーダル
- `app/layout.tsx`: メタデータと PWA 登録
- `app/manifest.ts`: PWA マニフェスト
- `components/PwaRegister.tsx`: Service Worker 登録
- `lib/supabase.ts`: Supabase クライアント
- `lib/defaultSubjects.ts`: 初期科目
- `lib/attendance.ts`: 出席数と色判定
- `lib/types.ts`: DB 型定義
- `public/sw.js`: Service Worker
- `supabase/schema.sql`: Supabase テーブル、トリガー、RLS

## 入力ルール

科目は、科目名・色・総授業数・最低出席数が必須です。総授業数と最低出席数は1以上、最低出席数は総授業数以下に制限しています。日付は重複登録できません。
