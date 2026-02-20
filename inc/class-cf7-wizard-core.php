<?php
/**
 * CF7 Wizard Core
 *
 * メニュー登録、スクリプト読み込み、ノンス発行を担当
 *
 * @package CF7_Modern_Enhancer
 */

defined( 'ABSPATH' ) || exit;

/**
 * Class CF7_Wizard_Core
 */
final class CF7_Wizard_Core {

	const NONCE_ACTION = 'cf7me_save_form';

	/**
	 * 初期化・フック登録
	 */
	public static function boot() {
		add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ), 10, 1 );
	}

	/**
	 * 管理メニューに CF7 Wizard を登録
	 */
	public static function register_menu() {
		add_menu_page(
			__( 'CF7 Wizard', 'cf7-modern-enhancer' ),
			__( 'CF7 Wizard', 'cf7-modern-enhancer' ),
			'manage_options',
			CF7ME_WIZARD_SLUG,
			array( __CLASS__, 'render_page' ),
			'dashicons-edit-page',
			30
		);
	}

	/**
	 * ウィザードページのHTMLを描画
	 */
	public static function render_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'このページにアクセスする権限がありません。', 'cf7-modern-enhancer' ) );
		}
		?>
		<div class="wrap cf7me-wizard-wrap">
			<h1><?php esc_html_e( 'フォーム作成ウィザード', 'cf7-modern-enhancer' ); ?></h1>
			<div id="wizard-app"></div>
		</div>
		<?php
	}

	/**
	 * ウィザード画面でのみ CSS/JS を読み込む
	 *
	 * @param string $hook_suffix 現在の管理画面フック
	 */
	public static function enqueue_assets( $hook_suffix ) {
		if ( ! self::is_wizard_screen( $hook_suffix ) ) {
			return;
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		wp_enqueue_style(
			'cf7me-wizard',
			CF7ME_PLUGIN_URL . 'assets/css/style.css',
			array(),
			CF7ME_VERSION
		);

		wp_enqueue_script(
			'cf7me-sortablejs',
			'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js',
			array(),
			'1.15.0',
			true
		);

		wp_enqueue_script(
			'cf7me-wizard-config',
			CF7ME_PLUGIN_URL . 'assets/js/wizard/config.js',
			array(),
			CF7ME_VERSION,
			true
		);
		wp_enqueue_script(
			'cf7me-wizard-data-processor',
			CF7ME_PLUGIN_URL . 'assets/js/wizard/data-processor.js',
			array( 'cf7me-wizard-config' ),
			CF7ME_VERSION,
			true
		);
		wp_enqueue_script(
			'cf7me-wizard-ui-manager',
			CF7ME_PLUGIN_URL . 'assets/js/wizard/ui-manager.js',
			array( 'cf7me-wizard-data-processor' ),
			CF7ME_VERSION,
			true
		);
		wp_enqueue_script(
			'cf7me-wizard-app',
			CF7ME_PLUGIN_URL . 'assets/js/wizard/app.js',
			array( 'cf7me-wizard-ui-manager', 'cf7me-sortablejs' ),
			CF7ME_VERSION,
			true
		);
		wp_enqueue_script(
			'cf7me-wizard',
			CF7ME_PLUGIN_URL . 'assets/js/main.js',
			array( 'cf7me-wizard-app' ),
			CF7ME_VERSION,
			true
		);

		wp_localize_script( 'cf7me-wizard-config', 'cf7meWizard', self::get_localize_data() );
	}

	/**
	 * ウィザード画面かどうかを判定
	 *
	 * @param string $hook_suffix フックサフィックス
	 * @return bool
	 */
	private static function is_wizard_screen( $hook_suffix ) {
		return 'toplevel_page_' . CF7ME_WIZARD_SLUG === $hook_suffix;
	}

	/**
	 * wp_localize_script に渡すデータを取得
	 *
	 * @return array
	 */
	private static function get_localize_data() {
		$mail_default  = CF7_Wizard_Repository::get_default_mail();
		$mail2_default = CF7_Wizard_Repository::get_default_mail_2();
		return array(
			'ajaxUrl'     => admin_url( 'admin-ajax.php' ),
			'nonce'       => wp_create_nonce( self::NONCE_ACTION ),
			'forms'       => CF7_Wizard_Repository::get_form_list(),
			'pages'       => CF7_Wizard_Repository::get_pages_list(),
			'mailDefaults' => array(
				'recipient'         => isset( $mail_default['recipient'] ) ? $mail_default['recipient'] : '[_site_admin_email]',
				'sender'            => isset( $mail_default['sender'] ) ? $mail_default['sender'] : '',
				'additional_headers' => isset( $mail_default['additional_headers'] ) ? $mail_default['additional_headers'] : 'Reply-To: [your-email]',
			),
			'mail2Defaults' => array(
				'recipient'         => isset( $mail2_default['recipient'] ) ? $mail2_default['recipient'] : '[your-email]',
				'sender'            => isset( $mail2_default['sender'] ) ? $mail2_default['sender'] : '',
				'additional_headers' => isset( $mail2_default['additional_headers'] ) ? $mail2_default['additional_headers'] : '',
			),
		);
	}
}
