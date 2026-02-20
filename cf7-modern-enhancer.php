<?php
/**
 * Plugin Name: CF7 Modern Enhancer
 * Plugin URI:  https://example.com/cf7-modern-enhancer
 * Description: Contact Form 7 をモダンにするアドオンプラグイン
 * Version:     1.0.0
 * Author:
 * Author URI:
 * License:     GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: cf7-modern-enhancer
 * Requires Plugins: contact-form-7
 */

defined( 'ABSPATH' ) || exit;

define( 'CF7ME_VERSION', '1.0.0' );
define( 'CF7ME_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'CF7ME_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'CF7ME_WIZARD_SLUG', 'cf7me-wizard' );

// クラスファイルの読み込み
require_once CF7ME_PLUGIN_DIR . 'inc/class-cf7-wizard-repository.php';
require_once CF7ME_PLUGIN_DIR . 'inc/class-cf7-wizard-core.php';
require_once CF7ME_PLUGIN_DIR . 'inc/class-cf7-wizard-ajax.php';
require_once CF7ME_PLUGIN_DIR . 'inc/class-cf7me-confirm-handler.php';

/**
 * プラグイン初期化
 */
add_action( 'plugins_loaded', 'cf7me_init' );

/**
 * Contact Form 7 が有効な場合にのみ初期化
 */
function cf7me_init() {
	if ( ! class_exists( 'WPCF7' ) ) {
		return;
	}

	// フロント: CF7 が読み込まれるページ
	add_action( 'wpcf7_enqueue_scripts', 'cf7me_enqueue_scripts' );
	add_action( 'wpcf7_enqueue_styles', 'cf7me_enqueue_styles' );

	// 管理画面: CF7 Wizard
	CF7_Wizard_Core::boot();
	CF7_Wizard_Ajax::register();

	// 固定ページ編集: 確認ページの警告メッセージ
	add_action( 'admin_notices', 'cf7me_confirm_page_edit_notice' );

	// 固定ページ保存時: ショートコード消失の復元
	add_action( 'save_post_page', 'cf7me_restore_confirm_shortcode_on_save', 20, 3 );

	// 確認画面機能（固定ページ遷移）
	CF7ME_Confirm_Handler::boot();

	// サンクスページリダイレクト（wpcf7mailsent）
	add_action( 'wpcf7_shortcode_callback', 'cf7me_collect_thanks_redirect', 10, 2 );
	add_action( 'wp_footer', 'cf7me_output_thanks_redirect_script', 20 );
}

/**
 * フォームIDとサンクスURLの対応を収集（wpcf7_shortcode_callback）
 *
 * @param WPCF7_ContactForm $contact_form
 * @param array             $atts
 */
function cf7me_collect_thanks_redirect( $contact_form, $atts ) {
	$thanks_url = get_post_meta( $contact_form->id(), '_cf7me_thanks_url', true );
	if ( is_string( $thanks_url ) && '' !== trim( $thanks_url ) ) {
		$thanks_url = esc_url( trim( $thanks_url ) );
		cf7me_add_thanks_redirect( (int) $contact_form->id(), $thanks_url );
	}
}

/**
 * サンクスリダイレクト用のフォームID・URLを追加
 *
 * @param int    $form_id
 * @param string $url
 */
function cf7me_add_thanks_redirect( $form_id, $url ) {
	static $redirects = array();
	if ( ! isset( $redirects[ $form_id ] ) ) {
		$redirects[ $form_id ] = $url;
	}
	// グローバルに渡すため
	global $cf7me_thanks_redirects;
	if ( ! is_array( $cf7me_thanks_redirects ) ) {
		$cf7me_thanks_redirects = array();
	}
	$cf7me_thanks_redirects[ $form_id ] = $url;
}

/**
 * wpcf7mailsent リダイレクトスクリプトをフッターに出力
 */
function cf7me_output_thanks_redirect_script() {
	global $cf7me_thanks_redirects;
	if ( empty( $cf7me_thanks_redirects ) || ! is_array( $cf7me_thanks_redirects ) ) {
		return;
	}
	// 修正5: wp_json_encode の出力はそのまま JS オブジェクトとして有効。esc_js は JSON を破壊するため使用しない
	?>
	<script>
	(function() {
		var redirects = <?php echo wp_json_encode( $cf7me_thanks_redirects ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>;
		document.addEventListener( 'wpcf7mailsent', function( event ) {
			var id = event.detail && event.detail.contactFormId;
			if ( id && redirects[ id ] ) {
				location = redirects[ id ];
			}
		}, false );
	})();
	</script>
	<?php
}

/**
 * 既存フォーム一覧取得（後方互換エイリアス）
 *
 * @return array [ ['id' => int, 'title' => string], ... ]
 */
/**
 * 確認ページ編集時の警告メッセージ
 */
function cf7me_confirm_page_edit_notice() {
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	if ( ! $screen || 'page' !== $screen->post_type || 'post' !== $screen->base ) {
		return;
	}

	$post_id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0;
	if ( ! $post_id ) {
		return;
	}

	$post = get_post( $post_id );
	if ( ! $post || 'page' !== $post->post_type ) {
		return;
	}

	$is_confirm = ( 0 === strpos( (string) $post->post_name, 'confirm-' ) )
		|| ( false !== strpos( (string) $post->post_content, '[cf7me_confirm' ) );
	if ( ! $is_confirm ) {
		return;
	}

	echo '<div class="notice notice-info"><p>' . esc_html__( 'このページはCF7ウィザード専用の確認画面です。本文に書かれた文章は項目確認の上に表示されます。末尾のショートコードは削除しないでください。', 'cf7-modern-enhancer' ) . '</p></div>';
}

/**
 * 確認ページ保存時にショートコードが消えていれば末尾に再挿入
 *
 * @param int      $post_id
 * @param WP_Post  $post
 * @param bool     $update
 */
function cf7me_restore_confirm_shortcode_on_save( $post_id, $post, $update ) {
	if ( ! $post || 'page' !== $post->post_type ) {
		return;
	}
	if ( false === strpos( (string) $post->post_name, 'confirm-' ) ) {
		return;
	}
	if ( false !== strpos( (string) $post->post_content, '[cf7me_confirm' ) ) {
		return;
	}
	$form_slug = str_replace( 'confirm-', '', $post->post_name );
	$form_slug = sanitize_key( $form_slug );
	if ( '' === $form_slug ) {
		return;
	}
	$shortcode  = '[cf7me_confirm slug="' . esc_attr( $form_slug ) . '"]';
	$preserved  = trim( (string) $post->post_content );
	$new_content = $preserved ? $preserved . "\n\n" . $shortcode : $shortcode;

	remove_action( 'save_post_page', 'cf7me_restore_confirm_shortcode_on_save', 20 );
	wp_update_post( array(
		'ID'           => $post_id,
		'post_content' => $new_content,
	) );
	add_action( 'save_post_page', 'cf7me_restore_confirm_shortcode_on_save', 20, 3 );
}

function cf7me_get_contact_forms() {
	return CF7_Wizard_Repository::get_form_list();
}

/**
 * フロント: CF7 フォームページ用の JS
 */
function cf7me_enqueue_scripts() {
	wp_enqueue_script(
		'cf7-modern-enhancer',
		CF7ME_PLUGIN_URL . 'assets/js/main.js',
		array( 'contact-form-7' ),
		CF7ME_VERSION,
		array( 'in_footer' => true )
	);
}

/**
 * フロント: CF7 フォームページ用の CSS
 */
function cf7me_enqueue_styles() {
	wp_enqueue_style(
		'cf7-modern-enhancer',
		CF7ME_PLUGIN_URL . 'assets/css/style.css',
		array( 'contact-form-7' ),
		CF7ME_VERSION,
		'all'
	);
}
