/**
 * CF7 Wizard - Config
 * 定数・設定の管理
 */
( function( global ) {
	'use strict';

	var FIELD_DEFS = [
		{ type: 'text', slug: 'your-name', label: 'テキスト' },
		{ type: 'email', slug: 'your-email', label: 'メール' },
		{ type: 'url', slug: 'your-url', label: 'URL' },
		{ type: 'tel', slug: 'your-tel', label: '電話番号' },
		{ type: 'number', slug: 'your-number', label: '数値' },
		{ type: 'date', slug: 'your-date', label: '日付' },
		{ type: 'textarea', slug: 'your-message', label: 'テキストエリア' },
		{ type: 'select', slug: 'your-select', label: 'ドロップダウン' },
		{ type: 'checkbox', slug: 'your-checkbox', label: 'チェックボックス（複数選択）' },
		{ type: 'radio', slug: 'your-radio', label: 'ラジオボタン' },
		{ type: 'acceptance', slug: 'your-acceptance', label: '同意チェック（承諾）' },
		{ type: 'quiz', slug: 'your-quiz', label: 'クイズ' },
		{ type: 'file', slug: 'your-file', label: 'ファイル' },
		{ type: 'submit', slug: 'submit', label: '送信ボタン' }
	];

	var SELECT_TYPES = [ 'select', 'checkbox', 'radio' ];
	var HORIZONTAL_TYPES = [ 'checkbox', 'radio' ];

	var SLUG_LABELS = {
		'your-name': 'お名前', 'your-email': 'メールアドレス', 'your-subject': '件名',
		'your-message': 'メッセージ', 'your-tel': '電話番号', 'your-url': 'URL',
		'your-date': '日付', 'your-number': '数値', 'your-select': '選択',
		'your-checkbox': '選択内容', 'your-radio': '選択内容',
		'your-file': '添付ファイル', 'your-quiz': 'クイズ回答', 'your-acceptance': '同意'
	};

	var DUMMY_DATA = {
		'your-name': '山田 太郎', 'your-email': 'sample@example.com', 'your-subject': 'お問い合わせについて',
		'your-message': 'よろしくお願いいたします。\nこちらは2行目のサンプルです。',
		'your-tel': '03-1234-5678', 'your-url': 'https://example.com', 'your-date': '2025/02/21',
		'your-number': '123', 'your-select': '選択肢1', 'your-checkbox': '選択肢1, 選択肢2',
		'your-radio': '選択肢1', 'your-file': '添付ファイル.pdf', 'your-quiz': '正解',
		'your-acceptance': '同意しました', '_site_admin_email': 'admin@example.com'
	};

	var MAIL2_DEFAULT_BODY = 'お問い合わせありがとうございました。以下の内容で受け付けました。';
	var MAIL2_DEFAULT_SUBJECT = 'お問い合わせありがとうございます';

	global.CF7ME = global.CF7ME || {};
	global.CF7ME.Config = {
		FIELD_DEFS: FIELD_DEFS,
		SELECT_TYPES: SELECT_TYPES,
		HORIZONTAL_TYPES: HORIZONTAL_TYPES,
		SLUG_LABELS: SLUG_LABELS,
		DUMMY_DATA: DUMMY_DATA,
		MAIL2_DEFAULT_BODY: MAIL2_DEFAULT_BODY,
		MAIL2_DEFAULT_SUBJECT: MAIL2_DEFAULT_SUBJECT
	};
} )( typeof window !== 'undefined' ? window : this );
