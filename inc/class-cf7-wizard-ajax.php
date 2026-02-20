<?php
/**
 * CF7 Wizard Ajax
 *
 * Ajax リクエスト（保存・取得・メール設定）の処理を専門に行う
 *
 * @package CF7_Modern_Enhancer
 */

defined( 'ABSPATH' ) || exit;

/**
 * Class CF7_Wizard_Ajax
 */
final class CF7_Wizard_Ajax {

	/**
	 * アクション登録
	 */
	public static function register() {
		add_action( 'wp_ajax_cf7me_save_form', array( __CLASS__, 'handle_save' ) );
		add_action( 'wp_ajax_cf7me_get_form', array( __CLASS__, 'handle_get' ) );
		add_action( 'wp_ajax_cf7me_get_pages', array( __CLASS__, 'handle_get_pages' ) );
	}

	/**
	 * 保存 Ajax ハンドラ
	 */
	public static function handle_save() {
		self::verify_request();
		$params = self::parse_save_params();
		if ( is_wp_error( $params ) ) {
			wp_send_json_error( array( 'message' => $params->get_error_message() ), 400 );
		}

		$post_id = CF7_Wizard_Repository::save_form(
			$params['form_id'],
			$params['title'],
			$params['form_content'],
			$params['mail'],
			$params['mail_2'],
			$params['form_slug'],
			$params['confirm_enabled'],
			$params['thanks_url']
		);

		if ( is_wp_error( $post_id ) ) {
			wp_send_json_error( array( 'message' => $post_id->get_error_message() ), 500 );
		}
		if ( 0 === $post_id ) {
			wp_send_json_error( array( 'message' => __( '保存に失敗しました。', 'cf7-modern-enhancer' ) ), 500 );
		}

		wp_send_json_success( array(
			'id'    => $post_id,
			'url'   => admin_url( 'admin.php?page=wpcf7&post=' . $post_id . '&action=edit' ),
			'forms' => CF7_Wizard_Repository::get_form_list(),
		) );
	}

	/**
	 * 取得 Ajax ハンドラ
	 */
	public static function handle_get() {
		self::verify_request();
		$form_id = isset( $_POST['form_id'] ) ? absint( $_POST['form_id'] ) : 0;
		if ( 0 === $form_id ) {
			wp_send_json_error( array( 'message' => __( 'フォームIDが指定されていません。', 'cf7-modern-enhancer' ) ), 400 );
		}

		$data = CF7_Wizard_Repository::get_form_full( $form_id );
		wp_send_json_success( $data );
	}

	/**
	 * 固定ページ一覧取得 Ajax ハンドラ
	 */
	public static function handle_get_pages() {
		self::verify_request();

		$pages = CF7_Wizard_Repository::get_pages_list();
		wp_send_json_success( array( 'pages' => $pages ) );
	}

	/**
	 * ノンス・権限チェック
	 */
	private static function verify_request() {
		if ( ! check_ajax_referer( CF7_Wizard_Core::NONCE_ACTION, 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( '不正なリクエストです。', 'cf7-modern-enhancer' ) ), 403 );
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( '権限がありません。', 'cf7-modern-enhancer' ) ), 403 );
		}
	}

	/**
	 * 保存リクエストのパラメータをパース・検証
	 *
	 * @return array|WP_Error
	 */
	private static function parse_save_params() {
		$title        = isset( $_POST['title'] ) ? sanitize_text_field( wp_unslash( $_POST['title'] ) ) : '';
		$form_content = isset( $_POST['form_content'] ) ? wp_unslash( $_POST['form_content'] ) : ''; // phpcs:ignore
		$mail_json    = isset( $_POST['mail'] ) ? wp_unslash( $_POST['mail'] ) : ''; // phpcs:ignore
		$mail_2_json  = isset( $_POST['mail_2'] ) ? wp_unslash( $_POST['mail_2'] ) : ''; // phpcs:ignore

		if ( '' === $title ) {
			return new WP_Error( 'missing_title', __( 'フォームのタイトルを入力してください。', 'cf7-modern-enhancer' ) );
		}
		$form_slug_param = isset( $_POST['form_slug'] ) ? sanitize_key( wp_unslash( $_POST['form_slug'] ) ) : '';
		if ( '' === $form_slug_param ) {
			return new WP_Error( 'missing_slug', __( '英語スラッグ名を入力してください。', 'cf7-modern-enhancer' ) );
		}
		$form_content = trim( (string) $form_content );
		if ( '' === $form_content ) {
			return new WP_Error( 'missing_content', __( 'フォームの内容がありません。', 'cf7-modern-enhancer' ) );
		}

		$form_id = isset( $_POST['form_id'] ) ? absint( $_POST['form_id'] ) : 0;

		// 修正1: 既存フォーム更新時、送信されたスラッグがDBの値と異なる場合はエラー（UIのreadonlyをサーバー側でも担保）
		if ( $form_id > 0 ) {
			$stored_slug = get_post_meta( $form_id, '_cf7me_form_slug', true );
			$stored_slug = sanitize_key( (string) $stored_slug );
			if ( '' !== $stored_slug && $form_slug_param !== $stored_slug ) {
				return new WP_Error( 'slug_immutable', __( '既存フォームの英語スラッグは変更できません。', 'cf7-modern-enhancer' ) );
			}
		}

		// 修正1: 新規または未管理フォームの初回設定時、スラッグの一意性をチェック
		if ( CF7_Wizard_Repository::slug_exists( $form_slug_param, $form_id ) ) {
			return new WP_Error( 'slug_exists', __( 'この英語スラッグは既に使用されています。別の名前を入力してください。', 'cf7-modern-enhancer' ) );
		}

		$mail   = is_string( $mail_json ) ? json_decode( $mail_json, true ) : array();
		$mail_2 = is_string( $mail_2_json ) ? json_decode( $mail_2_json, true ) : array();

		$form_slug       = $form_slug_param;
		$confirm_enabled  = isset( $_POST['confirm_enabled'] ) && '1' === $_POST['confirm_enabled'];
		$thanks_url       = isset( $_POST['thanks_url'] ) ? esc_url_raw( wp_unslash( $_POST['thanks_url'] ) ) : '';

		return array(
			'form_id'         => $form_id,
			'title'           => $title,
			'form_content'    => $form_content,
			'mail'            => is_array( $mail ) ? $mail : array(),
			'mail_2'          => is_array( $mail_2 ) ? $mail_2 : array(),
			'form_slug'       => $form_slug,
			'confirm_enabled'  => $confirm_enabled,
			'thanks_url'      => $thanks_url,
		);
	}
}
