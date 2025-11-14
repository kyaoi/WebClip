# WebClip TODO改善 開発計画

## 概要
TODO.mdに記載されている改善要求を実現するための開発計画書

## 現状分析

### 1. 現在の実装
- **Optionsページ**: テンプレート設定、カテゴリ管理、フロントマター設定
- **SidebarTreePanel**: ディレクトリツリー表示（ファイル・フォルダ両方表示）
- **Categoryページ**: カテゴリ選択UI（リスト形式）
- **カテゴリシステム**: 
  - カテゴリは`CategorySetting`型で管理（id, label, folder, aggregate, subfolders）
  - folderフィールドは手動入力またはドロップダウンで選択
  - サブフォルダ機能あり（CategorySubfolder型）

### 2. TODO要件

#### Optionページの改善
1. **カテゴリをディレクトリ名とする**
   - 現状: folderフィールドは別途入力
   - 要求: カテゴリ名をそのままディレクトリ名として使用

2. **ツリーでディレクトリを作成できるようにする**
   - 現状: ツリーは表示のみ
   - 要求: ツリーから直接ディレクトリ作成機能を追加

3. **ツリー表示をディレクトリのみに**
   - 現状: ファイルとディレクトリ両方表示
   - 要求: ディレクトリのみ表示に変更

4. **ディレクトリ選択時のテンプレート表示**
   - 現状: ツリー選択は参照のみ
   - 要求: ディレクトリ選択でそのディレクトリ用のテンプレート/フロントマター編集画面を表示

#### Popupページの改善
1. **ツリー表示**
   - 現状: カテゴリはリスト形式で表示
   - 要求: ツリー形式で表示

2. **各ディレクトリごとにInbox/Page選択**
   - 現状: カテゴリ直下とサブフォルダでInbox/Page選択可能
   - 要求: 維持しつつツリー表示に変更

3. **表示サイズ調整**
   - 現状: コンパクトなサイズ
   - 要求: ツリー表示に適したサイズに拡大

## 実装戦略

### フェーズ1: データ構造の見直し

#### 1.1 カテゴリ=ディレクトリの実現
**影響範囲**: `src/shared/types.ts`, `src/options/App.tsx`, `src/background/index.ts`

**変更内容**:
- `CategorySetting`の`folder`フィールドを削除または読み取り専用化
- `label`を正規化してディレクトリ名として直接使用
- 既存データのマイグレーション処理を追加

**実装方針**:
```typescript
// labelをディレクトリ名として使用
// slugify不要（ユーザーが直接ディレクトリ名を入力）
interface CategorySetting {
  id: string;
  label: string; // これがディレクトリ名になる
  aggregate: boolean;
  subfolders: CategorySubfolder[];
}
```

#### 1.2 ディレクトリベースのテンプレート
**影響範囲**: `src/shared/types.ts`

**新規型定義**:
```typescript
interface DirectoryTemplate {
  directoryPath: string; // ディレクトリのフルパス
  frontMatter: TemplateFrontMatter;
  entryTemplate: string;
}

interface TemplateSetting {
  // 既存フィールド
  directoryTemplates: DirectoryTemplate[]; // 追加
}
```

### フェーズ2: Optionsページの改善

#### 2.1 ツリーをディレクトリのみ表示に変更
**影響範囲**: `src/shared/fileSystem.ts`, `src/options/components/SidebarTreePanel.tsx`

**変更内容**:
- `buildDirectoryTree`関数でファイルを除外
- TreeNodeコンポーネントでディレクトリのみレンダリング

#### 2.2 ツリーからディレクトリ作成機能
**影響範囲**: `src/options/components/SidebarTreePanel.tsx`, `src/shared/fileSystem.ts`

**新規機能**:
- ツリーノードに「新しいフォルダ」ボタン追加
- `createDirectory`関数の実装（File System Access API使用）
- 作成後にツリーを自動更新

#### 2.3 ディレクトリ選択時のテンプレート編集
**影響範囲**: `src/options/App.tsx`

**UI変更**:
- 左: ツリー（ディレクトリのみ）
- 右: 選択ディレクトリのテンプレート/フロントマター編集エリア
- ディレクトリ未選択時は全体設定を表示

**状態管理**:
```typescript
const [selectedDirectory, setSelectedDirectory] = useState<string | null>(null);
const [directoryTemplate, setDirectoryTemplate] = useState<DirectoryTemplate | null>(null);
```

### フェーズ3: Categoryページ（Popup）の改善

#### 3.1 ツリー表示への変更
**影響範囲**: `src/category/App.tsx`

**変更内容**:
- リスト形式からツリー形式に変更
- `SidebarTreePanel`の再利用または専用ツリーコンポーネント作成
- カテゴリとサブフォルダの階層をツリー構造で表現

#### 3.2 表示サイズの調整
**影響範囲**: `manifest.config.ts` or `src/category/index.html`

**変更内容**:
- ウィンドウサイズを拡大（例: 400x600 → 600x800）
- レスポンシブデザインの最適化

### フェーズ4: 統合テスト・調整

#### 4.1 データマイグレーション
- 既存カテゴリデータの`folder`から`label`への移行
- バージョン番号の追加とマイグレーションロジック

#### 4.2 エッジケースの対応
- 同名ディレクトリの衝突処理
- 無効なディレクトリ名の検証
- パーミッションエラーのハンドリング

#### 4.3 UX改善
- ローディング状態の表示
- エラーメッセージの改善
- 成功フィードバックの最適化

## 実装順序

### ステップ1: ディレクトリのみ表示（最小限の変更）
1. `buildDirectoryTree`でファイルフィルタリング
2. TreeNodeコンポーネントの調整
3. テスト

### ステップ2: ディレクトリ作成機能
1. `createDirectory`関数実装
2. SidebarTreePanelにUIボタン追加
3. エラーハンドリング実装
4. テスト

### ステップ3: カテゴリ=ディレクトリ化
1. データ型の変更
2. マイグレーション処理
3. Options UIの調整（folder入力削除）
4. 保存ロジックの更新
5. テスト

### ステップ4: ディレクトリ別テンプレート
1. DirectoryTemplate型追加
2. 選択ディレクトリの状態管理
3. テンプレート編集UIの実装
4. 保存・読み込みロジック
5. テスト

### ステップ5: Categoryページのツリー化
1. ツリーコンポーネントの実装
2. レイアウト調整
3. ウィンドウサイズ変更
4. テスト

### ステップ6: 統合テスト
1. 全機能の動作確認
2. エッジケース対応
3. パフォーマンス確認
4. ドキュメント更新

## 技術的考慮事項

### File System Access API
- ディレクトリ作成: `directoryHandle.getDirectoryHandle(name, { create: true })`
- パーミッション確認: `handle.queryPermission()` / `requestPermission()`
- エラーハンドリング: AbortError, NotAllowedError, NotFoundError

### データマイグレーション
```typescript
// バージョン管理
interface Settings {
  version: number; // 追加
  // ...existing fields
}

async function migrateSettings(settings: Settings): Promise<Settings> {
  if (settings.version < 2) {
    // v1 -> v2: folder削除、labelをディレクトリ名に
    settings.templates = settings.templates.map(t => ({
      ...t,
      categories: t.categories.map(c => ({
        id: c.id,
        label: c.folder || slugify(c.label), // folderを優先
        aggregate: c.aggregate,
        subfolders: c.subfolders
      }))
    }));
    settings.version = 2;
  }
  return settings;
}
```

### パフォーマンス
- ディレクトリツリーのキャッシュ
- 大量ディレクトリ対応（仮想スクロール検討）
- 非同期処理の最適化

## リスク管理

### 高リスク項目
1. **既存データの破損**: マイグレーション失敗時のロールバック機能必須
2. **パーミッションエラー**: ユーザーフレンドリーなエラーメッセージとリトライ機能
3. **無効なディレクトリ名**: バリデーションとサニタイゼーション必須

### 対策
- バックアップ機能の実装（設定エクスポート機能は既存）
- 段階的なロールアウト（フィーチャーフラグ使用）
- 十分なエラーハンドリングとログ出力

## 成功基準

### 機能要件
- [x] ツリーがディレクトリのみ表示
- [x] ツリーから新しいディレクトリを作成可能
- [x] カテゴリ名がそのままディレクトリ名として使用される
- [x] ディレクトリ選択でテンプレート/フロントマター編集可能
- [x] Categoryページがツリー表示
- [x] ウィンドウサイズが適切に調整

### 非機能要件
- 既存データが正しくマイグレーションされる
- パフォーマンスの低下がない（ツリー表示が1秒以内）
- エラーが適切にハンドリングされる
- UIが直感的で使いやすい

## タイムライン（目安）

- ステップ1-2: 1-2日（ツリー改善）
- ステップ3: 2-3日（カテゴリ=ディレクトリ化）
- ステップ4: 3-4日（ディレクトリ別テンプレート）
- ステップ5: 2-3日（Categoryページ改善）
- ステップ6: 2-3日（統合テスト）

**合計**: 10-15日

## 備考

- 既存の機能を壊さないよう慎重に実装
- 各ステップで十分なテストを実施
- ユーザー体験を最優先に設計
- コードの可読性と保守性を維持
