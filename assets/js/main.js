/**
 * CF7 Modern Enhancer
 * - ウィザード画面（#wizard-app）の起動
 * - 確認画面フロー: cf7me_redirect によるページ遷移
 */
( function() {
	'use strict';

	function initWizard() {
		if ( typeof CF7ME === 'undefined' || ! CF7ME.App ) return;
		var c = document.getElementById( 'wizard-app' );
		if ( c ) CF7ME.App.init();
	}

	function initConfirmRedirect() {
		document.addEventListener( 'wpcf7submit', function( e ) {
			var r = e.detail && e.detail.apiResponse && e.detail.apiResponse.cf7me_redirect;
			if ( r ) {
				window.location.href = r;
			}
		} );
	}

	function init() {
		initWizard();
		initConfirmRedirect();
	}

	document.readyState === 'loading' ? document.addEventListener( 'DOMContentLoaded', init ) : init();
} )();
