/**
 * CF7 Wizard - App
 * 状態管理、イベント、Ajax、各モジュールのオーケストレーション
 */
( function( global ) {
	'use strict';

	var Config = global.CF7ME && global.CF7ME.Config;
	var DP = global.CF7ME && global.CF7ME.DataProcessor;
	var UI = global.CF7ME && global.CF7ME.UIManager;

	var items = [];
	var editingIndex = -1;
	var tabState = 'form';
	var formTitle = '';
	var formSelectValue = '0';
	var formSlug = '';
	var confirmEnabled = false;
	var thanksUrl = '';

	function getMailDefaults() {
		var d = ( global.cf7meWizard && global.cf7meWizard.mailDefaults ) || {};
		return { recipient: d.recipient || '[_site_admin_email]', sender: d.sender || '', additional_headers: d.additional_headers || 'Reply-To: [your-email]' };
	}
	function getMail2Defaults() {
		var d = ( global.cf7meWizard && global.cf7meWizard.mail2Defaults ) || {};
		return { recipient: d.recipient || '[your-email]', sender: d.sender || '', additional_headers: d.additional_headers || '' };
	}

	var mailSettings = {
		mail: { subject: '', body: '', recipient: '', sender: '', additional_headers: '' },
		mail_2: {
			subject: Config.MAIL2_DEFAULT_SUBJECT,
			body: Config.MAIL2_DEFAULT_BODY,
			active: false,
			recipient: '',
			sender: '',
			additional_headers: ''
		}
	};

	function initMailSettingsFromDefaults() {
		var m1 = getMailDefaults();
		var m2 = getMail2Defaults();
		mailSettings.mail.recipient = m1.recipient;
		mailSettings.mail.sender = m1.sender;
		mailSettings.mail.additional_headers = m1.additional_headers;
		mailSettings.mail_2.recipient = m2.recipient;
		mailSettings.mail_2.sender = m2.sender;
		mailSettings.mail_2.additional_headers = m2.additional_headers;
	}

	function sanitizeSlugFromTitle( title ) {
		if ( ! title || typeof title !== 'string' ) return '';
		return title.trim()
			.replace( /[^a-zA-Z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\s-]/g, '' )
			.replace( /[\s]+/g, '-' )
			.replace( /-+/g, '-' )
			.replace( /^-|-$/g, '' )
			.replace( /[^a-z0-9-]/gi, '' )
			.toLowerCase() || 'form';
	}

	function getUniqueSlug( base, excl ) {
		if ( base === 'submit' ) return 'submit';
		var root = base.replace( /-\d+$/, '' );
		var n = 0;
		items.forEach( function( it, i ) {
			if ( i === excl ) return;
			if ( it.slug === base || it.slug.indexOf( root + '-' ) === 0 ) n++;
		} );
		return n === 0 ? base : root + '-' + ( n + 1 );
	}

	function addItem( fd ) {
		var slug = getUniqueSlug( fd.slug, -1 );
		var it = {
			type: fd.type,
			slug: slug,
			label: fd.label,
			required: fd.type !== 'submit' && fd.type !== 'acceptance',
			classAttribute: '',
			defaultValue: '',
			useAsPlaceholder: false
		};
		if ( fd.type === 'submit' ) { it.buttonText = '送信'; delete it.required; }
		if ( fd.type === 'acceptance' ) it.required = false;
		if ( Config.SELECT_TYPES.indexOf( fd.type ) >= 0 ) it.options = [ '選択肢1', '選択肢2' ];
		if ( Config.HORIZONTAL_TYPES.indexOf( fd.type ) >= 0 ) it.horizontal = false;
		items.push( it );
		if ( fd.type === 'email' ) {
			var defRec = getMail2Defaults().recipient;
			if ( ! mailSettings.mail_2.recipient || mailSettings.mail_2.recipient === defRec ) {
				mailSettings.mail_2.recipient = '[' + slug + ']';
			}
		}
	}

	function resetMailSettingsForNew() {
		var m1 = getMailDefaults();
		var m2 = getMail2Defaults();
		mailSettings = {
			mail: { subject: '', body: '', recipient: m1.recipient, sender: m1.sender, additional_headers: m1.additional_headers },
			mail_2: {
				subject: Config.MAIL2_DEFAULT_SUBJECT,
				body: DP.getMail2DefaultBody( [] ),
				active: false,
				recipient: m2.recipient,
				sender: m2.sender,
				additional_headers: m2.additional_headers
			}
		};
	}

	function getForms() {
		return ( global.cf7meWizard && global.cf7meWizard.forms ) || [];
	}

	function collectMailSettingsFromDOM() {
		var subj = document.getElementById( 'cf7me-mail-subject' );
		var body = document.getElementById( 'cf7me-mail-body' );
		var r1 = document.getElementById( 'cf7me-mail-recipient' );
		var s1 = document.getElementById( 'cf7me-mail-sender' );
		var h1 = document.getElementById( 'cf7me-mail-headers' );
		var subj2 = document.getElementById( 'cf7me-mail2-subject' );
		var body2 = document.getElementById( 'cf7me-mail2-body' );
		var act2 = document.getElementById( 'cf7me-mail2-active' );
		var r2 = document.getElementById( 'cf7me-mail2-recipient' );
		var s2 = document.getElementById( 'cf7me-mail2-sender' );
		var h2 = document.getElementById( 'cf7me-mail2-headers' );
		if ( subj ) mailSettings.mail.subject = subj.value;
		if ( body ) mailSettings.mail.body = body.value;
		if ( r1 ) mailSettings.mail.recipient = r1.value;
		if ( s1 ) mailSettings.mail.sender = s1.value;
		if ( h1 ) mailSettings.mail.additional_headers = h1.value;
		if ( subj2 ) mailSettings.mail_2.subject = subj2.value;
		if ( body2 ) mailSettings.mail_2.body = body2.value;
		if ( act2 ) mailSettings.mail_2.active = act2.checked;
		if ( r2 ) mailSettings.mail_2.recipient = r2.value;
		if ( s2 ) mailSettings.mail_2.sender = s2.value;
		if ( h2 ) mailSettings.mail_2.additional_headers = h2.value;
	}

	function bindPreviewListeners() {
		function bindOne( subjId, bodyId, sectionId ) {
			var subj = document.getElementById( subjId );
			var body = document.getElementById( bodyId );
			function update() {
				UI.updateMailPreview( sectionId,
					subj ? subj.value : '',
					body ? body.value : ''
				);
			}
			if ( subj ) { subj.addEventListener( 'input', update ); subj.addEventListener( 'change', update ); }
			if ( body ) { body.addEventListener( 'input', update ); body.addEventListener( 'change', update ); }
		}
		bindOne( 'cf7me-mail-subject', 'cf7me-mail-body', 'admin' );
		bindOne( 'cf7me-mail2-subject', 'cf7me-mail2-body', 'auto' );
	}

	function applyTemplateToBody( target ) {
		if ( target === 'admin' ) {
			var template = DP.generateMailBodyTemplate( items );
			if ( ! template ) return;
			mailSettings.mail.body = template;
			var el = document.getElementById( 'cf7me-mail-body' );
			if ( el ) el.value = template;
			UI.updateMailPreview( 'admin', mailSettings.mail.subject, template );
		} else {
			var body = DP.getMail2DefaultBody( items );
			mailSettings.mail_2.body = body;
			var el2 = document.getElementById( 'cf7me-mail2-body' );
			if ( el2 ) el2.value = body;
			UI.updateMailPreview( 'auto', mailSettings.mail_2.subject, body );
		}
	}

	function insertTagAtCursor( targetId, tag ) {
		var ta = document.getElementById( targetId );
		if ( ! ta ) return;
		var start = ta.selectionStart, end = ta.selectionEnd, val = ta.value;
		ta.value = val.slice( 0, start ) + tag + val.slice( end );
		ta.selectionStart = ta.selectionEnd = start + tag.length;
		ta.focus();
	}

	function showMsg( txt, err ) {
		var el = document.getElementById( 'cf7me-save-msg' );
		if ( ! el ) return;
		el.textContent = txt;
		el.className = 'cf7me-save-msg' + ( err ? ' cf7me-save-msg-error' : ' cf7me-save-msg-success' );
		setTimeout( function() { el.textContent = ''; el.className = 'cf7me-save-msg'; }, 3000 );
	}

	function updateSelect( forms ) {
		var se = document.getElementById( 'cf7me-form-select' );
		if ( ! se || ! forms || ! forms.length ) return;
		var v = se.value;
		se.innerHTML = '<option value="0">— 新規作成 —</option>' + forms.map( function( f ) {
			return '<option value="' + DP.esc( f.id ) + '">' + DP.esc( f.title ) + '</option>';
		} ).join( '' );
		se.value = v || '0';
		if ( global.cf7meWizard ) global.cf7meWizard.forms = forms;
	}

	function applyModal() {
		if ( editingIndex < 0 || ! items[ editingIndex ] ) return;
		var it = items[ editingIndex ];
		if ( it.type === 'submit' ) {
			var el = document.getElementById( 'cf7me-m-btn' );
			if ( el ) it.buttonText = el.value.trim() || '送信';
		} else {
			var le = document.getElementById( 'cf7me-m-label' );
			var re = document.getElementById( 'cf7me-m-required' );
			var ce = document.getElementById( 'cf7me-m-class' );
			var de = document.getElementById( 'cf7me-m-default' );
			var pe = document.getElementById( 'cf7me-m-placeholder' );
			var oe = document.getElementById( 'cf7me-m-options' );
			var he = document.getElementById( 'cf7me-m-horizontal' );
			if ( le ) it.label = le.value.trim();
			if ( re ) it.required = re.checked;
			if ( ce ) it.classAttribute = ce.value.trim();
			if ( de ) it.defaultValue = de.value.trim();
			if ( pe ) it.useAsPlaceholder = pe.checked;
			if ( oe && Config.SELECT_TYPES.indexOf( it.type ) >= 0 ) {
				it.options = oe.value.split( '\n' ).map( function( s ) { return s.trim(); } ).filter( Boolean );
				if ( ! it.options.length ) it.options = [ '選択肢1' ];
			}
			if ( he ) it.horizontal = he.checked;
		}
		closeModal();
		render();
	}

	function openModal( i ) {
		editingIndex = i;
		var wrap = document.getElementById( 'wizard-app' );
		if ( ! wrap ) return;
		var c = document.getElementById( 'cf7me-modal-container' );
		if ( c ) c.innerHTML = UI.buildModal( editingIndex, items );
		else {
			c = document.createElement( 'div' );
			c.id = 'cf7me-modal-container';
			c.innerHTML = UI.buildModal( editingIndex, items );
			wrap.appendChild( c );
		}
		var ov = document.getElementById( 'cf7me-modal-overlay' );
		if ( ov ) ov.classList.add( 'cf7me-modal-visible' );
		bindModalEvents();
	}

	function closeModal() {
		editingIndex = -1;
		var o = document.getElementById( 'cf7me-modal-overlay' );
		if ( o ) o.classList.remove( 'cf7me-modal-visible' );
	}

	function bindModalEvents() {
		var ov = document.getElementById( 'cf7me-modal-overlay' );
		if ( ! ov ) return;
		ov.onclick = function( e ) { if ( e.target === ov ) { closeModal(); render(); } };
		var c = ov.querySelector( '.cf7me-modal-close' );
		var x = ov.querySelector( '.cf7me-modal-cancel' );
		var o = ov.querySelector( '.cf7me-modal-ok' );
		if ( c ) c.onclick = function() { closeModal(); render(); };
		if ( x ) x.onclick = function() { closeModal(); render(); };
		if ( o ) o.onclick = applyModal;
	}

	function onClick( e ) {
		var tagBtn = e.target.closest( '.cf7me-tag-btn' );
		if ( tagBtn ) {
			var targetId = tagBtn.dataset.target;
			var tag = tagBtn.dataset.tag;
			if ( targetId && tag ) insertTagAtCursor( targetId, tag );
			return;
		}
		var add = e.target.closest( '.cf7me-add-btn' );
		if ( add ) {
			addItem( { type: add.dataset.type, slug: add.dataset.slug, label: add.dataset.label } );
			render();
			return;
		}
		if ( e.target.closest( '.cf7me-preview-del' ) ) {
			var row = e.target.closest( '.cf7me-preview-item' );
			if ( row ) {
				var i = parseInt( row.dataset.index, 10 );
				if ( ! isNaN( i ) ) { items.splice( i, 1 ); render(); }
			}
			return;
		}
		if ( e.target.closest( '.cf7me-preview-edit' ) ) {
			var row = e.target.closest( '.cf7me-preview-item' );
			if ( row ) {
				var i = parseInt( row.dataset.index, 10 );
				if ( ! isNaN( i ) ) openModal( i );
			}
		}
	}

	function handleFormSelect() {
		var se = document.getElementById( 'cf7me-form-select' );
		var te = document.getElementById( 'cf7me-form-title' );
		if ( ! se || ! te ) return;
		var id = parseInt( se.value, 10 );
		if ( id <= 0 ) {
			items = [];
			formTitle = '';
			formSlug = '';
			confirmEnabled = false;
			thanksUrl = '';
			resetMailSettingsForNew();
			addItem( { type: 'submit', slug: 'submit', label: '送信ボタン' } );
			render();
			return;
		}
		var forms = getForms();
		var f = forms.find( function( x ) { return x.id === id; } );
		if ( f ) { formTitle = f.title; te.value = f.title; }
		if ( global.cf7meWizard && global.cf7meWizard.ajaxUrl ) {
			var fd = new FormData();
			fd.append( 'action', 'cf7me_get_form' );
			fd.append( 'nonce', global.cf7meWizard.nonce );
			fd.append( 'form_id', id );
			fetch( global.cf7meWizard.ajaxUrl, { method: 'POST', body: fd } )
				.then( function( r ) { return r.json(); } )
				.then( function( res ) {
					if ( res.success && res.data ) {
						loadFormContent( res.data.content, res.data.mail, res.data.mail_2, formTitle, res.data.form_slug, res.data.confirm_enabled, res.data.thanks_url );
					} else {
						render();
					}
				} )
				.catch( function() { render(); } );
		} else render();
	}

	function loadFormContent( content, mail, mail2, loadedTitle, loadedSlug, loadedConfirm, loadedThanksUrl ) {
		items = DP.parseContent( content );
		if ( loadedTitle ) formTitle = loadedTitle;
		if ( loadedSlug !== undefined && loadedSlug !== null ) formSlug = String( loadedSlug );
		if ( loadedConfirm !== undefined ) confirmEnabled = !! loadedConfirm;
		if ( loadedThanksUrl !== undefined && loadedThanksUrl !== null ) thanksUrl = String( loadedThanksUrl );
		var m1 = getMailDefaults();
		var m2 = getMail2Defaults();
		if ( mail && typeof mail === 'object' ) {
			mailSettings.mail.subject = mail.subject || '';
			mailSettings.mail.body = mail.body || '';
			mailSettings.mail.recipient = mail.recipient !== undefined ? mail.recipient : m1.recipient;
			mailSettings.mail.sender = mail.sender !== undefined ? mail.sender : m1.sender;
			mailSettings.mail.additional_headers = mail.additional_headers !== undefined ? mail.additional_headers : m1.additional_headers;
		}
		if ( mail2 && typeof mail2 === 'object' ) {
			mailSettings.mail_2.subject = mail2.subject || Config.MAIL2_DEFAULT_SUBJECT;
			mailSettings.mail_2.body = mail2.body || DP.getMail2DefaultBody( items );
			mailSettings.mail_2.active = !! mail2.active;
			mailSettings.mail_2.recipient = mail2.recipient !== undefined ? mail2.recipient : m2.recipient;
			mailSettings.mail_2.sender = mail2.sender !== undefined ? mail2.sender : m2.sender;
			mailSettings.mail_2.additional_headers = mail2.additional_headers !== undefined ? mail2.additional_headers : m2.additional_headers;
		} else {
			mailSettings.mail_2.subject = Config.MAIL2_DEFAULT_SUBJECT;
			mailSettings.mail_2.body = DP.getMail2DefaultBody( items );
			mailSettings.mail_2.active = false;
			mailSettings.mail_2.recipient = m2.recipient;
			mailSettings.mail_2.sender = m2.sender;
			mailSettings.mail_2.additional_headers = m2.additional_headers;
		}
		render();
	}

	function handleSave() {
		var te = document.getElementById( 'cf7me-form-title' );
		var se = document.getElementById( 'cf7me-form-select' );
		var oe = document.getElementById( 'cf7me-cf7-output' );
		var sb = document.getElementById( 'cf7me-save-btn' );
		var slugEl = document.getElementById( 'cf7me-form-slug' );
		if ( ! te || ! se || ! oe ) return;
		collectMailSettingsFromDOM();
		collectHeaderFromDOM();
		var title = te.value.trim();
		var slugVal = slugEl ? slugEl.value.trim() : '';
		var fid = parseInt( se.value, 10 ) || 0;
		var body = oe.value.trim() || '[submit "送信"]';
		if ( ! title ) { showMsg( 'フォームのタイトルを入力してください。', true ); return; }
		if ( ! slugVal ) { showMsg( '英語スラッグ名を入力してください。', true ); return; }
		if ( ! global.cf7meWizard || ! global.cf7meWizard.ajaxUrl ) { showMsg( '設定が読み込まれていません。', true ); return; }
		if ( sb && sb.disabled ) return;
		if ( sb ) { sb.disabled = true; sb.textContent = '保存中...'; }
		var fd = new FormData();
		fd.append( 'action', 'cf7me_save_form' );
		fd.append( 'nonce', global.cf7meWizard.nonce );
		fd.append( 'form_id', fid );
		fd.append( 'title', title );
		fd.append( 'form_content', body );
		fd.append( 'mail', JSON.stringify( {
			subject: mailSettings.mail.subject,
			body: mailSettings.mail.body,
			recipient: mailSettings.mail.recipient,
			sender: mailSettings.mail.sender,
			additional_headers: mailSettings.mail.additional_headers
		} ) );
		fd.append( 'mail_2', JSON.stringify( {
			subject: mailSettings.mail_2.subject,
			body: mailSettings.mail_2.body,
			active: mailSettings.mail_2.active,
			recipient: mailSettings.mail_2.recipient,
			sender: mailSettings.mail_2.sender,
			additional_headers: mailSettings.mail_2.additional_headers
		} ) );
		var confirmEl = document.getElementById( 'cf7me-confirm-enabled' );
		var thanksEl = document.getElementById( 'cf7me-thanks-page' );
		fd.append( 'confirm_enabled', confirmEl && confirmEl.checked ? '1' : '0' );
		fd.append( 'thanks_url', thanksEl ? ( thanksEl.value || '' ) : '' );
		fd.append( 'form_slug', slugVal );
		fetch( global.cf7meWizard.ajaxUrl, { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } } )
			.then( function( r ) { return r.json().then( function( d ) { return { ok: r.ok, status: r.status, data: d }; } ); } )
			.then( function( res ) {
				if ( sb ) { sb.disabled = false; sb.textContent = '保存'; }
				var payload = res.data;
				if ( res.ok && payload && payload.success ) {
					showMsg( '✅ 保存完了！', false );
					if ( payload.data && payload.data.forms ) updateSelect( payload.data.forms );
					if ( payload.data && payload.data.id ) se.value = String( payload.data.id );
				} else {
					var msg = ( payload && payload.data && payload.data.message ) ? payload.data.message : ( res.ok ? '保存に失敗しました。' : 'HTTP ' + res.status );
					showMsg( msg, true );
				}
			} )
			.catch( function() {
				if ( sb ) { sb.disabled = false; sb.textContent = '保存'; }
				showMsg( '通信エラーが発生しました。', true );
			} );
	}

	var sortableInstance = null;

	function reorderItemsBySort( oldIndex, newIndex ) {
		if ( oldIndex === newIndex ) return;
		var moved = items.splice( oldIndex, 1 )[ 0 ];
		items.splice( newIndex, 0, moved );
	}

	function updateOutputAndIndices() {
		var oe = document.getElementById( 'cf7me-cf7-output' );
		if ( oe ) oe.value = DP.toCF7String( items );
		var list = document.getElementById( 'cf7me-preview-list' );
		if ( ! list ) return;
		var cards = list.querySelectorAll( '.cf7me-preview-card' );
		cards.forEach( function( card, idx ) {
			card.setAttribute( 'data-index', String( idx ) );
		} );
	}

	function initSortable() {
		var listEl = document.getElementById( 'cf7me-preview-list' );
		if ( ! listEl || items.length === 0 ) return;
		if ( sortableInstance ) {
			sortableInstance.destroy();
			sortableInstance = null;
		}
		if ( typeof Sortable === 'undefined' ) return;
		sortableInstance = new Sortable( listEl, {
			handle: '.cf7me-preview-drag-handle',
			animation: 200,
			ghostClass: 'cf7me-sortable-ghost',
			chosenClass: 'cf7me-sortable-chosen',
			dragClass: 'cf7me-sortable-drag',
			onEnd: function( evt ) {
				var oldIndex = evt.oldIndex;
				var newIndex = evt.newIndex;
				if ( oldIndex == null || newIndex == null ) return;
				reorderItemsBySort( oldIndex, newIndex );
				updateOutputAndIndices();
			}
		} );
	}

	function bindSlugAutoGenerate() {
		var te = document.getElementById( 'cf7me-form-title' );
		var slugEl = document.getElementById( 'cf7me-form-slug' );
		if ( ! te || ! slugEl ) return;
		te.removeEventListener( 'input', onTitleInputForSlug );
		te.addEventListener( 'input', onTitleInputForSlug );
		function onTitleInputForSlug() {
			var fid = parseInt( document.getElementById( 'cf7me-form-select' )?.value || '0', 10 );
			if ( fid > 0 ) return;
			if ( slugEl.readOnly ) return;
			formSlug = sanitizeSlugFromTitle( te.value );
			slugEl.value = formSlug;
		}
	}

	function bindEvents() {
		var c = document.getElementById( 'wizard-app' );
		if ( ! c ) return;
		c.removeEventListener( 'click', onClick );
		c.addEventListener( 'click', onClick );
		var sb = document.getElementById( 'cf7me-save-btn' );
		if ( sb ) sb.onclick = handleSave;
		var se = document.getElementById( 'cf7me-form-select' );
		if ( se ) se.onchange = handleFormSelect;
		var tabs = c.querySelectorAll( '.cf7me-tab' );
		tabs.forEach( function( t ) {
			t.onclick = function() {
				var tab = t.dataset.tab;
				if ( tab === 'form' || tab === 'mail' || tab === 'confirm' ) { tabState = tab; render(); }
			};
		} );
		bindPreviewListeners();
		var btnAdmin = document.getElementById( 'cf7me-apply-template-admin' );
		var btnAuto = document.getElementById( 'cf7me-apply-template-auto' );
		if ( btnAdmin ) btnAdmin.onclick = function() { applyTemplateToBody( 'admin' ); };
		if ( btnAuto ) btnAuto.onclick = function() { applyTemplateToBody( 'auto' ); };
		c.querySelectorAll( '.cf7me-accordion-trigger' ).forEach( function( btn ) {
			btn.onclick = function() {
				var content = document.getElementById( btn.getAttribute( 'aria-controls' ) );
				if ( ! content ) return;
				var open = content.classList.toggle( 'cf7me-accordion-open' );
				btn.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
				btn.textContent = open ? '詳細設定を閉じる' : '詳細設定を表示';
			};
		} );
		initSortable();
	}

	function collectHeaderFromDOM() {
		var te = document.getElementById( 'cf7me-form-title' );
		var se = document.getElementById( 'cf7me-form-select' );
		var slugEl = document.getElementById( 'cf7me-form-slug' );
		if ( te ) formTitle = te.value;
		if ( se ) formSelectValue = se.value;
		if ( slugEl ) formSlug = slugEl.value.trim();
	}

	function collectConfirmSettingsFromDOM() {
		var confirmEl = document.getElementById( 'cf7me-confirm-enabled' );
		var thanksEl = document.getElementById( 'cf7me-thanks-page' );
		if ( confirmEl ) confirmEnabled = confirmEl.checked;
		if ( thanksEl ) thanksUrl = thanksEl.value || '';
	}

	function render() {
		if ( tabState === 'mail' ) collectMailSettingsFromDOM();
		collectConfirmSettingsFromDOM();
		collectHeaderFromDOM();
		var c = document.getElementById( 'wizard-app' );
		if ( ! c ) return;
		var forms = getForms();
		var pages = ( global.cf7meWizard && global.cf7meWizard.pages ) || [];
		// 修正4: 未管理フォーム（_cf7me_form_slug 未設定）は初回のみスラッグ入力を許可
		var isSlugLocked = ( parseInt( formSelectValue, 10 ) || 0 ) > 0 && ( formSlug !== '' && formSlug !== null );
		c.innerHTML = UI.buildHeader( forms, formTitle, formSlug, isSlugLocked ) +
			UI.buildTabs( tabState ) +
			UI.buildEditArea(
				UI.buildMain( items, tabState ),
				UI.buildMailTab( mailSettings, tabState, items ),
				UI.buildConfirmTab( confirmEnabled, thanksUrl, pages, tabState )
			);
		bindEvents();
		bindSlugAutoGenerate();
		var se = document.getElementById( 'cf7me-form-select' );
		if ( se && formSelectValue ) se.value = formSelectValue;
		var slugEl = document.getElementById( 'cf7me-form-slug' );
		if ( slugEl ) slugEl.value = formSlug;
		var confirmEl = document.getElementById( 'cf7me-confirm-enabled' );
		var thanksEl = document.getElementById( 'cf7me-thanks-page' );
		if ( confirmEl ) confirmEl.checked = confirmEnabled;
		if ( thanksEl ) thanksEl.value = thanksUrl;
	}

	function init() {
		initMailSettingsFromDefaults();
		if ( items.length === 0 && ( parseInt( formSelectValue, 10 ) || 0 ) <= 0 ) {
			addItem( { type: 'submit', slug: 'submit', label: '送信ボタン' } );
		}
		var c = document.getElementById( 'wizard-app' );
		if ( c ) render();
	}

	global.CF7ME = global.CF7ME || {};
	global.CF7ME.App = {
		init: init,
		render: render
	};
} )( typeof window !== 'undefined' ? window : this );
