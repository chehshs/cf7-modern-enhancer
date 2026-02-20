/**
 * CF7 Wizard - DataProcessor
 * 項目→CF7タグ変換、パース、メールテンプレート生成
 */
( function( global ) {
	'use strict';

	var Config = global.CF7ME && global.CF7ME.Config;

	function esc( str ) {
		var d = document.createElement( 'div' );
		d.textContent = str == null ? '' : String( str );
		return d.innerHTML;
	}

	function getLabelForItem( it ) {
		if ( it.label && it.label !== 'テキスト' && it.label !== 'メール' && it.label !== 'メールアドレス' ) {
			return it.label;
		}
		var base = ( it.slug || '' ).replace( /-\d+$/, '' );
		return Config.SLUG_LABELS[ base ] || base.replace( /-/g, ' ' ) || '項目';
	}

	function getDummyForSlug( slug ) {
		var base = ( slug || '' ).replace( /-\d+$/, '' );
		if ( Config.DUMMY_DATA[ base ] ) return Config.DUMMY_DATA[ base ];
		if ( base.indexOf( 'email' ) >= 0 ) return 'sample@example.com';
		if ( base.indexOf( 'tel' ) >= 0 ) return '03-1234-5678';
		if ( base.indexOf( 'url' ) >= 0 ) return 'https://example.com';
		if ( base.indexOf( 'date' ) >= 0 ) return '2025/02/21';
		if ( base.indexOf( 'message' ) >= 0 ) return 'よろしくお願いいたします。';
		return 'サンプル';
	}

	/**
	 * 項目を CF7 タグ文字列に変換
	 */
	function toTag( it ) {
		var H = Config.HORIZONTAL_TYPES;
		var S = Config.SELECT_TYPES;
		if ( it.type === 'submit' ) {
			return '[submit "' + esc( it.buttonText || '送信' ) + '"]';
		}
		var star = it.required ? '*' : '';
		var parts = [ it.type + star, it.slug ];
		if ( ( it.classAttribute || '' ).trim() ) {
			( it.classAttribute || '' ).trim().split( /\s+/ ).forEach( function( c ) {
				if ( c ) parts.push( 'class:' + c );
			} );
		}
		if ( H.indexOf( it.type ) >= 0 && it.horizontal ) parts.push( 'class:cf7me-inline' );
		var opts = S.indexOf( it.type ) >= 0 && it.options && it.options.length
			? it.options.map( function( o ) { return '"' + esc( o ).replace( /"/g, '\\"' ) + '"'; } ).join( ' ' )
			: '';
		if ( it.label ) parts.push( '"' + esc( it.label ).replace( /"/g, '\\"' ) + '"' );
		if ( opts ) parts.push( opts );
		return '[' + parts.join( ' ' ) + ']';
	}

	/**
	 * 項目一覧を CF7 ショートコード文字列に
	 */
	function toCF7String( items ) {
		return items.map( toTag ).join( '\n' );
	}

	/**
	 * CF7 コンテンツをパースして項目オブジェクトに
	 */
	function parseItem( m, fieldDefs ) {
		var type = ( m[1] || '' ).replace( /\*$/, '' );
		var slug = m[2] || '';
		var rest = ( m[3] || '' );
		var req = m[0].indexOf( type + '*' ) >= 0;
		var opt = rest.match( /"([^"]*)"/g );
		var opts = opt ? opt.map( function( s ) { return s.slice( 1, -1 ).replace( /\\"/g, '"' ); } ) : [];
		var lab = ( type === 'select' && opts.length ) ? opts.shift() : '';
		var def = fieldDefs.find( function( f ) { return f.type === type; } );
		var classParts = [];
		rest.replace( /class:([\w-]+)/g, function( _, c ) {
			classParts.push( c );
		} );
		var classAttr = classParts.filter( function( c ) { return c !== 'cf7me-inline'; } ).join( ' ' );
		var it = {
			type: type || 'text',
			slug: slug || ( def ? def.slug : 'f' ),
			label: lab,
			required: req,
			classAttribute: classAttr,
			defaultValue: '',
			useAsPlaceholder: false
		};
		if ( Config.SELECT_TYPES.indexOf( type ) >= 0 ) it.options = opts.length ? opts : [ '選択肢1' ];
		if ( Config.HORIZONTAL_TYPES.indexOf( type ) >= 0 ) it.horizontal = /class:cf7me-inline/.test( rest );
		return it;
	}

	/**
	 * CF7 コンテンツ文字列から項目配列を生成
	 */
	function parseContent( content ) {
		var items = [];
		var s = ( content || '' ).replace( /\r\n/g, '\n' );
		var re = /\[(submit|text\*?|email\*?|url\*?|tel\*?|number\*?|date\*?|textarea\*?|select\*?|checkbox\*?|radio\*?|acceptance\*?|quiz\*?|file\*?)\s+([\w-]*)\s*(.*?)\]/g;
		var m;
		while ( ( m = re.exec( s ) ) !== null ) {
			if ( m[1] === 'submit' ) {
				var b = m[0].match( /"([^"]*)"/ );
				items.push( { type: 'submit', slug: 'submit', buttonText: b ? b[1] : '送信' } );
			} else {
				items.push( parseItem( m, Config.FIELD_DEFS ) );
			}
		}
		return items;
	}

	/**
	 * 使用可能なタグ一覧を取得（メール本文用）
	 */
	function getAvailableTags( items ) {
		var tags = [];
		items.forEach( function( it ) {
			if ( it.type !== 'submit' && it.type !== 'acceptance' && it.type !== 'quiz' && it.slug ) {
				tags.push( '[' + it.slug + ']' );
			}
		} );
		return tags;
	}

	/**
	 * メール本文テンプレートを生成（日本語ラベル付き）
	 */
	function generateMailBodyTemplate( items ) {
		var lines = [];
		items.forEach( function( it ) {
			if ( it.type === 'submit' || it.type === 'acceptance' || it.type === 'quiz' ) return;
			lines.push( '■' + getLabelForItem( it ) + '\n[' + it.slug + ']\n' );
		} );
		return lines.join( '\n' ).trim() || '';
	}

	/**
	 * Mail 2 用デフォルト本文（定型文＋テンプレート）
	 */
	function getMail2DefaultBody( items ) {
		var intro = Config.MAIL2_DEFAULT_BODY + '\n\n';
		var template = generateMailBodyTemplate( items );
		return template ? intro + template : intro.trim();
	}

	/**
	 * タグをダミーデータで置換
	 */
	function replaceTagsWithDummy( text ) {
		if ( ! text ) return '';
		return text.replace( /\[([\w-]+)\]/g, function( _, slug ) {
			return getDummyForSlug( slug );
		} );
	}

	global.CF7ME = global.CF7ME || {};
	global.CF7ME.DataProcessor = {
		esc: esc,
		toTag: toTag,
		toCF7String: toCF7String,
		parseContent: parseContent,
		getAvailableTags: getAvailableTags,
		generateMailBodyTemplate: generateMailBodyTemplate,
		getMail2DefaultBody: getMail2DefaultBody,
		replaceTagsWithDummy: replaceTagsWithDummy,
		getLabelForItem: getLabelForItem
	};
} )( typeof window !== 'undefined' ? window : this );
