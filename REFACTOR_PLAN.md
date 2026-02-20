# CF7 Wizard リファクタリング設計書

## 1. ディレクトリ構成

```
cf7-modern-enhancer/
├── cf7-modern-enhancer.php          # プラグインエントリポイント
├── inc/
│   ├── class-cf7-wizard-core.php    # メニュー・アセット・ノンス
│   ├── class-cf7-wizard-ajax.php    # Ajax ハンドラ専用
│   └── class-cf7-wizard-repository.php  # CF7 フォームの取得・保存ロジック
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── main.js                  # エントリ（App を起動）
│       └── wizard/
│           ├── config.js            # 定数・設定
│           ├── data-processor.js    # 変換ロジック
│           ├── ui-manager.js        # DOM操作・表示
│           └── app.js               # 統括
└── REFACTOR_PLAN.md                 # 本設計書
```

## 2. 責務の分担

### PHP

| クラス | 責務 |
|--------|------|
| **CF7_Wizard_Core** | メニュー登録、ウィザードページ描画、CSS/JS 読み込み、`wp_localize_script`、ノンス発行 |
| **CF7_Wizard_Ajax** | `cf7me_save_form` / `cf7me_get_form` の Ajax 処理、入力検証、Repository 呼び出し |
| **CF7_Wizard_Repository** | `get_form_list`、`get_form_data`、`save_form`、`get_default_mail` など CF7 メタ操作 |

### JavaScript

| モジュール | 責務 |
|------------|------|
| **Config** | `FIELD_DEFS`、`SELECT_TYPES`、`HORIZONTAL_TYPES` など |
| **DataProcessor** | 項目→CF7タグ変換、パース、メールテンプレート生成、使用可能タグ抽出 |
| **UIManager** | タブ切り替え、プレビュー描画、モーダル、メール設定UI、イベントバインディング |
| **App** | 初期化、状態管理、Ajax 保存/取得、各モジュールのオーケストレーション |

## 3. PHP クラス間の依存関係

```
cf7-modern-enhancer.php
    └── CF7_Wizard_Core::boot()
            ├── メニュー登録
            ├── アセット登録（Core 内）
            └── Ajax アクション登録（CF7_Wizard_Ajax をフック）
    └── CF7_Wizard_Ajax
            └── CF7_Wizard_Repository（save/get 時に利用）
```

## 4. JavaScript モジュール間の依存関係

```
main.js
    └── App.init() （#wizard-app がある場合のみ）

wizard/config.js      → 定数・設定
wizard/data-processor.js → Config 依存、変換・パース・メールテンプレート
wizard/ui-manager.js  → Config, DataProcessor 依存、DOM 描画
wizard/app.js         → Config, DataProcessor, UIManager 依存、統括・Ajax
main.js               → App 起動
```

## 5. 関数サイズのルール

- 1 関数は **最大 20〜30 行**
- 細かい処理はプライベートメソッドに切り出す
- 条件分岐が深い場合は early return を積極活用
