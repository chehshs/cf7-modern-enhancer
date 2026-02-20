/**
 * CF7 Wizard - UIManager
 * DOM 操作、タブ、プレビュー、モーダル、イベントバインディング
 */
( function( global ) {
	'use strict';

	var Config = global.CF7ME && global.CF7ME.Config;
	var DP = global.CF7ME && global.CF7ME.DataProcessor;

	function buildHeader( forms, formTitle, formSlug, isSlugLocked ) {
		var opts = '<option value="0">— 新規作成 —</option>' + ( forms || [] ).map( function( f ) {
			return '<option value="' + DP.esc( f.id ) + '">' + DP.esc( f.title ) + '</option>';
		} ).join( '' );
		var titleVal = DP.esc( formTitle || '' );
		var slugVal = DP.esc( formSlug || '' );
		var slugReadonly = isSlugLocked ? ' readonly' : '';
		var slugLockClass = isSlugLocked ? ' cf7me-slug-locked' : '';
		var slugNote = isSlugLocked ? '<span class="cf7me-slug-note">※システム識別子のため変更できません</span>' : '';
		return '<div class="cf7me-header-bar">' +
			'<div class="cf7me-header-inner">' +
				'<input type="text" id="cf7me-form-title" class="cf7me-input cf7me-header-input" value="' + titleVal + '" placeholder="フォームのタイトル" aria-label="フォームのタイトル">' +
				'<select id="cf7me-form-select" class="cf7me-select cf7me-header-select" aria-label="既存フォーム">' + opts + '</select>' +
				'<div class="cf7me-header-slug-wrap">' +
					'<input type="text" id="cf7me-form-slug" class="cf7me-input cf7me-header-slug' + slugLockClass + '" value="' + slugVal + '" placeholder="英語スラッグ（例: contact）" aria-label="英語スラッグ名"' + slugReadonly + '>' +
					slugNote +
				'</div>' +
				'<div class="cf7me-header-actions">' +
					'<button type="button" id="cf7me-save-btn" class="cf7me-save-btn button button-primary">保存</button>' +
					'<span id="cf7me-save-msg" class="cf7me-save-msg"></span>' +
				'</div>' +
			'</div>' +
		'</div>';
	}

	function buildTabs( tabState ) {
		var formCls = tabState === 'form' ? ' cf7me-tab-active' : '';
		var mailCls = tabState === 'mail' ? ' cf7me-tab-active' : '';
		var confirmCls = tabState === 'confirm' ? ' cf7me-tab-active' : '';
		return '<div class="cf7me-tab-bar">' +
			'<button type="button" class="cf7me-tab' + formCls + '" data-tab="form">フォーム作成</button>' +
			'<button type="button" class="cf7me-tab' + mailCls + '" data-tab="mail">メール設定</button>' +
			'<button type="button" class="cf7me-tab' + confirmCls + '" data-tab="confirm">確認・完了設定</button>' +
		'</div>';
	}

	function buildEditArea( mainHtml, mailHtml, confirmHtml, tabState ) {
		return '<div class="cf7me-edit-area">' +
			mainHtml +
			mailHtml +
			confirmHtml +
		'</div>';
	}

	function buildTagButtons( targetId, items ) {
		var tags = DP.getAvailableTags( items );
		if ( ! tags.length ) {
			return '<div class="cf7me-tag-list"><span class="cf7me-tag-hint">フォーム作成タブで項目を追加するとタグが表示されます</span></div>';
		}
		var btns = tags.map( function( tag ) {
			return '<button type="button" class="cf7me-tag-btn" data-tag="' + DP.esc( tag ) + '" data-target="' + DP.esc( targetId ) + '">' + DP.esc( tag ) + '</button>';
		} ).join( '' );
		return '<div class="cf7me-tag-list"><span class="cf7me-tag-label">使用可能なタグ:</span>' + btns + '</div>';
	}

	function buildMailPreview( subject, body, sectionId ) {
		var subjPreview = DP.replaceTagsWithDummy( subject || '' );
		var bodyPreview = DP.replaceTagsWithDummy( body || '' );
		return '<div id="cf7me-preview-' + sectionId + '" class="cf7me-mail-preview">' +
			'<h4 class="cf7me-preview-title">実際の受信イメージ</h4>' +
			'<div class="cf7me-preview-mail">' +
				'<div class="cf7me-preview-subject"><strong>件名:</strong> ' + DP.esc( subjPreview || '（未設定）' ) + '</div>' +
				'<div class="cf7me-preview-body">' + DP.esc( bodyPreview || '（未設定）' ).replace( /\n/g, '<br>' ) + '</div>' +
			'</div></div>';
	}

	function updateMailPreview( sectionId, subject, body ) {
		var el = document.getElementById( 'cf7me-preview-' + sectionId );
		if ( ! el ) return;
		var subjPreview = DP.replaceTagsWithDummy( subject || '' );
		var bodyPreview = DP.replaceTagsWithDummy( body || '' );
		var subjDiv = el.querySelector( '.cf7me-preview-subject' );
		var bodyDiv = el.querySelector( '.cf7me-preview-body' );
		if ( subjDiv ) subjDiv.innerHTML = '<strong>件名:</strong> ' + DP.esc( subjPreview || '（未設定）' );
		if ( bodyDiv ) bodyDiv.innerHTML = DP.esc( bodyPreview || '（未設定）' ).replace( /\n/g, '<br>' );
	}

	var SENDER_NOTE = '※送信元には、サイトと同じドメイン（例: info@あなたのサイト.com）のメールアドレスを設定してください。そうしないとメールが届かない場合があります。';

	function buildMailDetailAccordion( prefix, m ) {
		var id = prefix === 'mail' ? 'admin' : 'auto';
		var recipientId = 'cf7me-' + prefix + '-recipient';
		var senderId = 'cf7me-' + prefix + '-sender';
		var headersId = 'cf7me-' + prefix + '-headers';
		var accordionId = 'cf7me-accordion-' + id;
		var contentId = 'cf7me-accordion-content-' + id;
		var showNote = prefix === 'mail';
		return '<div class="cf7me-accordion">' +
			'<button type="button" class="cf7me-accordion-trigger" id="' + accordionId + '" aria-expanded="false" aria-controls="' + contentId + '">詳細設定を表示</button>' +
			'<div id="' + contentId + '" class="cf7me-accordion-content" role="region" aria-labelledby="' + accordionId + '">' +
				( showNote ? '<p class="cf7me-mail-note">' + DP.esc( SENDER_NOTE ) + '</p>' : '' ) +
				'<div class="cf7me-mail-row">' +
					'<label for="' + recipientId + '" class="cf7me-label">送信先 (To)</label>' +
					'<input type="text" id="' + recipientId + '" class="cf7me-input" value="' + DP.esc( m.recipient || '' ) + '" placeholder="[_site_admin_email]">' +
				'</div>' +
				'<div class="cf7me-mail-row">' +
					'<label for="' + senderId + '" class="cf7me-label">送信元 (From)</label>' +
					'<input type="text" id="' + senderId + '" class="cf7me-input" value="' + DP.esc( m.sender || '' ) + '" placeholder="[_site_title] &lt;wordpress@ドメイン&gt;">' +
				'</div>' +
				'<div class="cf7me-mail-row">' +
					'<label for="' + headersId + '" class="cf7me-label">追加ヘッダー</label>' +
					'<textarea id="' + headersId + '" class="cf7me-input cf7me-textarea cf7me-headers-textarea" rows="3" placeholder="例: Reply-To: [your-email]">' + DP.esc( m.additional_headers || '' ) + '</textarea>' +
				'</div>' +
			'</div></div>';
	}

	function buildMailTab( mailSettings, tabState, items ) {
		var tag1 = buildTagButtons( 'cf7me-mail-body', items );
		var tag2 = buildTagButtons( 'cf7me-mail2-body', items );
		var preview1 = buildMailPreview( mailSettings.mail.subject, mailSettings.mail.body, 'admin' );
		var preview2 = buildMailPreview( mailSettings.mail_2.subject, mailSettings.mail_2.body, 'auto' );
		var activeCls = tabState === 'mail' ? ' cf7me-pane-active' : '';
		var accordion1 = buildMailDetailAccordion( 'mail', mailSettings.mail );
		var accordion2 = buildMailDetailAccordion( 'mail2', mailSettings.mail_2 );
		return '<div class="cf7me-mail-pane cf7me-pane' + activeCls + '">' +
			'<div class="cf7me-mail-section cf7me-mail-with-preview">' +
				'<div class="cf7me-mail-settings">' +
					'<h3 class="cf7me-panel-title">管理者宛て通知</h3>' +
					'<div class="cf7me-mail-row">' +
						'<label for="cf7me-mail-subject" class="cf7me-label">題名 (Subject)</label>' +
						'<input type="text" id="cf7me-mail-subject" class="cf7me-input" value="' + DP.esc( mailSettings.mail.subject ) + '" placeholder="例: [your-subject] 様からのお問い合わせ">' +
					'</div>' +
					'<div class="cf7me-mail-row cf7me-mail-row-body">' +
						'<div class="cf7me-body-wrap">' +
							'<label for="cf7me-mail-body" class="cf7me-label">本文</label>' +
							'<textarea id="cf7me-mail-body" class="cf7me-input cf7me-textarea" rows="12">' + DP.esc( mailSettings.mail.body ) + '</textarea>' +
						'</div>' +
						'<div class="cf7me-tags-wrap">' + tag1 + '</div>' +
					'</div>' +
					accordion1 +
					'<div class="cf7me-mail-row">' +
						'<button type="button" id="cf7me-apply-template-admin" class="button cf7me-template-btn">全項目をテンプレートに反映</button>' +
					'</div>' +
				'</div>' +
				'<div class="cf7me-mail-preview-wrap">' + preview1 + '</div>' +
			'</div>' +
			'<div class="cf7me-mail-section cf7me-mail-with-preview">' +
				'<div class="cf7me-mail-settings">' +
					'<h3 class="cf7me-panel-title">自動返信メール</h3>' +
					'<div class="cf7me-mail-row">' +
						'<label class="cf7me-check-label"><input type="checkbox" id="cf7me-mail2-active" ' + ( mailSettings.mail_2.active ? 'checked' : '' ) + '> 自動返信を有効にする</label>' +
					'</div>' +
					'<div class="cf7me-mail-row">' +
						'<label for="cf7me-mail2-subject" class="cf7me-label">題名 (Subject)</label>' +
						'<input type="text" id="cf7me-mail2-subject" class="cf7me-input" value="' + DP.esc( mailSettings.mail_2.subject ) + '" placeholder="例: お問い合わせありがとうございます">' +
					'</div>' +
					'<div class="cf7me-mail-row cf7me-mail-row-body">' +
						'<div class="cf7me-body-wrap">' +
							'<label for="cf7me-mail2-body" class="cf7me-label">本文</label>' +
							'<textarea id="cf7me-mail2-body" class="cf7me-input cf7me-textarea" rows="12">' + DP.esc( mailSettings.mail_2.body ) + '</textarea>' +
						'</div>' +
						'<div class="cf7me-tags-wrap">' + tag2 + '</div>' +
					'</div>' +
					accordion2 +
					'<div class="cf7me-mail-row">' +
						'<button type="button" id="cf7me-apply-template-auto" class="button cf7me-template-btn">全項目をテンプレートに反映</button>' +
					'</div>' +
				'</div>' +
				'<div class="cf7me-mail-preview-wrap">' + preview2 + '</div>' +
			'</div>' +
		'</div>';
	}

	function buildConfirmTab( confirmEnabled, thanksUrl, pages, tabState ) {
		var pagesData = pages || ( global.cf7meWizard && global.cf7meWizard.pages ) || [];
		var pageOpts = '<option value="">— 選択しない（デフォルト表示） —</option>' +
			pagesData.map( function( p ) {
				var sel = p.url === thanksUrl ? ' selected' : '';
				return '<option value="' + DP.esc( p.url ) + '"' + sel + '>' + DP.esc( p.title ) + '</option>';
			} ).join( '' );
		var checked = confirmEnabled ? ' checked' : '';
		var activeCls = tabState === 'confirm' ? ' cf7me-pane-active' : '';
		return '<div class="cf7me-confirm-pane cf7me-pane' + activeCls + '">' +
			'<div class="cf7me-confirm-section">' +
				'<h3 class="cf7me-panel-title">確認画面の設定</h3>' +
				'<div class="cf7me-confirm-row">' +
					'<label class="cf7me-label cf7me-label-inline">' +
						'<input type="checkbox" id="cf7me-confirm-enabled" class="cf7me-checkbox"' + checked + '> 確認画面を有効にする' +
					'</label>' +
				'</div>' +
			'</div>' +
			'<div class="cf7me-confirm-section">' +
				'<h3 class="cf7me-panel-title">完了画面（サンクスページ）の設定</h3>' +
				'<div class="cf7me-confirm-row">' +
					'<label for="cf7me-thanks-page" class="cf7me-label">送信完了後の遷移先ページ</label>' +
					'<select id="cf7me-thanks-page" class="cf7me-select cf7me-select-pages">' + pageOpts + '</select>' +
				'</div>' +
			'</div>' +
		'</div>';
	}

	function getPartTypeLabel( type ) {
		var def = Config.FIELD_DEFS.find( function( f ) { return f.type === type; } );
		return def ? def.label : type;
	}

	function getDisplayLabel( it ) {
		if ( it.type === 'submit' ) {
			return ( it.buttonText || '送信' ).trim() || '送信';
		}
		var label = ( it.label || '' ).trim();
		if ( label ) return label;
		return getPartTypeLabel( it.type ) + '（未設定）';
	}

	function getClassDisplayValue( it ) {
		var parts = [];
		if ( ( it.classAttribute || '' ).trim() ) parts.push( ( it.classAttribute || '' ).trim() );
		if ( Config.HORIZONTAL_TYPES.indexOf( it.type ) >= 0 && it.horizontal ) {
			parts.push( 'cf7me-inline' );
		}
		return parts.length ? 'class: ' + parts.join( ' ' ) : '';
	}

	function buildDragHandle() {
		return '<div class="cf7me-preview-drag-handle" title="ドラッグして並び替え" aria-label="並び替え">' +
			'<span class="cf7me-drag-dot"></span><span class="cf7me-drag-dot"></span><span class="cf7me-drag-dot"></span>' +
			'<span class="cf7me-drag-dot"></span><span class="cf7me-drag-dot"></span><span class="cf7me-drag-dot"></span>' +
			'</div>';
	}

	function buildPreviewItemCard( it, i ) {
		var displayLabel = getDisplayLabel( it );
		var slugDisplay = it.slug ? '[' + DP.esc( it.slug ) + ']' : '';
		var requiredBadge = ( it.type !== 'submit' && it.type !== 'acceptance' && it.required )
			? '<span class="cf7me-badge cf7me-badge-required">必須入力</span>' : '';
		var typeBadge = '<span class="cf7me-badge cf7me-badge-type">' + DP.esc( getPartTypeLabel( it.type ) ) + '</span>';
		var classStr = getClassDisplayValue( it );
		var classBadge = classStr
			? '<span class="cf7me-badge cf7me-badge-class">' + DP.esc( classStr ) + '</span>' : '';
		return '<div class="cf7me-preview-item cf7me-preview-card" data-index="' + i + '">' +
			buildDragHandle() +
			'<div class="cf7me-preview-item-body">' +
				'<div class="cf7me-preview-item-label-wrap">' +
					'<span class="cf7me-preview-item-label">' + DP.esc( displayLabel ) + '</span>' +
					( slugDisplay ? '<span class="cf7me-preview-item-slug">' + slugDisplay + '</span>' : '' ) +
					requiredBadge +
				'</div>' +
				'<div class="cf7me-preview-item-badges">' + typeBadge + classBadge + '</div>' +
			'</div>' +
			'<div class="cf7me-preview-item-actions">' +
				'<button type="button" class="cf7me-preview-edit button button-small">設定</button>' +
				'<button type="button" class="cf7me-preview-del button button-small">削除</button>' +
			'</div>' +
		'</div>';
	}

	function buildMain( items, tabState ) {
		var btns = Config.FIELD_DEFS.map( function( fd ) {
			return '<button type="button" class="cf7me-add-btn" data-type="' + DP.esc( fd.type ) +
				'" data-slug="' + DP.esc( fd.slug ) + '" data-label="' + DP.esc( fd.label ) + '">' + DP.esc( fd.label ) + '</button>';
		} ).join( '' );

		var list = items.map( function( it, i ) {
			return buildPreviewItemCard( it, i );
		} ).join( '' );

		if ( ! list ) list = '<p class="cf7me-preview-empty">左のボタンをクリックして項目を追加</p>';

		var formStr = DP.toCF7String( items );
		var activeCls = tabState === 'form' ? ' cf7me-pane-active' : '';
		return '<div class="cf7me-form-tab cf7me-pane' + activeCls + '">' +
			'<div class="cf7me-main cf7me-wizard-layout">' +
				'<div class="cf7me-sidebar parts-panel">' +
					'<h3 class="cf7me-panel-title">フォーム項目</h3>' +
					'<div class="cf7me-sidebar-btns">' + btns + '</div>' +
				'</div>' +
				'<div class="cf7me-preview preview-panel">' +
					'<h3 class="cf7me-panel-title">プレビュー</h3>' +
					'<div id="cf7me-preview-list" class="cf7me-preview-list">' + list + '</div>' +
				'</div>' +
			'</div>' +
			'<div class="cf7me-output">' +
				'<h3 class="cf7me-panel-title">CF7ショートコード</h3>' +
				'<textarea id="cf7me-cf7-output" class="cf7me-cf7-output" readonly>' + DP.esc( formStr ) + '</textarea>' +
			'</div>' +
		'</div>';
	}

	function buildModal( editingIndex, items ) {
		if ( editingIndex < 0 || ! items[ editingIndex ] ) return '';
		var it = items[ editingIndex ];
		var isSubmit = it.type === 'submit';
		var hasOptions = Config.SELECT_TYPES.indexOf( it.type ) >= 0;
		var hasHorizontal = Config.HORIZONTAL_TYPES.indexOf( it.type ) >= 0;

		var labelHtml = isSubmit
			? '<div class="cf7me-modal-row"><label class="cf7me-label">ボタンのテキスト</label>' +
				'<input type="text" id="cf7me-m-btn" class="cf7me-input" value="' + DP.esc( it.buttonText || '送信' ) + '"></div>'
			: '<div class="cf7me-modal-row"><label class="cf7me-label">ラベル</label>' +
				'<input type="text" id="cf7me-m-label" class="cf7me-input" value="' + DP.esc( it.label || '' ) + '"></div>';

		var requiredHtml = isSubmit ? '' : '<div class="cf7me-modal-row">' +
			'<label class="cf7me-check-label"><input type="checkbox" id="cf7me-m-required" ' + ( it.required ? 'checked' : '' ) + '> 必須入力の項目</label></div>';

		var classHtml = isSubmit ? '' : '<div class="cf7me-modal-row">' +
			'<label class="cf7me-label">クラス属性</label>' +
			'<input type="text" id="cf7me-m-class" class="cf7me-input" value="' + DP.esc( it.classAttribute || '' ) + '" placeholder="例: my-style">' +
			'</div>';

		var defaultHtml = isSubmit ? '' : '<div class="cf7me-modal-row">' +
			'<label class="cf7me-label">デフォルト値</label>' +
			'<input type="text" id="cf7me-m-default" class="cf7me-input" value="' + DP.esc( it.defaultValue || '' ) + '" placeholder="初期表示テキスト">' +
			'</div>' +
			'<div class="cf7me-modal-row">' +
			'<label class="cf7me-check-label"><input type="checkbox" id="cf7me-m-placeholder" ' + ( it.useAsPlaceholder ? 'checked' : '' ) + '> プレースホルダーとして使用する</label>' +
			'</div>';

		var optionsHtml = hasOptions ? '<div class="cf7me-modal-row">' +
			'<label class="cf7me-label">選択肢（1行1件）</label>' +
			'<textarea id="cf7me-m-options" class="cf7me-input" rows="4">' + DP.esc( ( it.options || [] ).join( '\n' ) ) + '</textarea></div>' : '';

		var horizontalHtml = hasHorizontal ? '<div class="cf7me-modal-row">' +
			'<label class="cf7me-check-label"><input type="checkbox" id="cf7me-m-horizontal" ' + ( it.horizontal ? 'checked' : '' ) + '> 横に並べる</label></div>' : '';

		return '<div id="cf7me-modal-overlay" class="cf7me-modal-overlay">' +
			'<div class="cf7me-modal">' +
				'<div class="cf7me-modal-header">' +
					'<h3>設定: ' + DP.esc( isSubmit ? '送信ボタン' : it.type ) + '</h3>' +
					'<button type="button" class="cf7me-modal-close" aria-label="閉じる">&times;</button>' +
				'</div>' +
				'<div class="cf7me-modal-body">' + labelHtml + requiredHtml + classHtml + defaultHtml + optionsHtml + horizontalHtml + '</div>' +
				'<div class="cf7me-modal-footer">' +
					'<button type="button" class="button cf7me-modal-cancel">キャンセル</button>' +
					'<button type="button" class="button button-primary cf7me-modal-ok">反映</button>' +
				'</div>' +
			'</div>' +
		'</div>';
	}

	global.CF7ME = global.CF7ME || {};
	global.CF7ME.UIManager = {
		buildTabs: buildTabs,
		buildHeader: buildHeader,
		buildEditArea: buildEditArea,
		buildTagButtons: buildTagButtons,
		buildMailPreview: buildMailPreview,
		updateMailPreview: updateMailPreview,
		buildMailTab: buildMailTab,
		buildConfirmTab: buildConfirmTab,
		buildMain: buildMain,
		buildModal: buildModal
	};
} )( typeof window !== 'undefined' ? window : this );
