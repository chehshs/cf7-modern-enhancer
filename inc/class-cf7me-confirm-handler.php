<?php
/**
 * CF7ME Confirm Handler
 *
 * 確認画面機能: セッション管理、送信の一時停止、確認ページ表示、最終送信
 *
 * @package CF7_Modern_Enhancer
 */

defined( 'ABSPATH' ) || exit;

/**
 * Class CF7ME_Confirm_Handler
 */
final class CF7ME_Confirm_Handler {

	const SESSION_KEY = 'cf7me_data';
	const META_FORM_SLUG   = '_cf7me_form_slug';
	const META_CONFIRM_ENABLED = '_cf7me_confirm_enabled';
	const META_THANKS_URL = '_cf7me_thanks_url';

	/**
	 * 初期化
	 */
	public static function boot() {
		add_action( 'init', array( __CLASS__, 'maybe_start_session' ), 1 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_confirm_styles' ) );
		add_action( 'wpcf7_before_send_mail', array( __CLASS__, 'intercept_submit' ), 10, 3 );
		add_filter( 'wpcf7_feedback_response', array( __CLASS__, 'add_redirect_to_response' ), 10, 2 );
		add_shortcode( 'cf7me_confirm', array( __CLASS__, 'render_confirm_shortcode' ) );
		add_action( 'template_redirect', array( __CLASS__, 'handle_confirm_submit' ), 5 );
	}

	/**
	 * 確認画面ページでプラグインのCSSを読み込む
	 */
	public static function enqueue_confirm_styles() {
		if ( is_admin() ) {
			return;
		}
		$page = get_queried_object();
		if ( ! $page || ! isset( $page->post_content ) ) {
			return;
		}
		if ( false === strpos( $page->post_content, '[cf7me_confirm' ) ) {
			return;
		}
		wp_enqueue_style(
			'cf7-modern-enhancer',
			CF7ME_PLUGIN_URL . 'assets/css/style.css',
			array(),
			CF7ME_VERSION
		);
	}

	/**
	 * フロントエンドでのみセッション開始
	 */
	public static function maybe_start_session() {
		if ( is_admin() && ! wp_doing_ajax() ) {
			return;
		}
		if ( wp_doing_cron() ) {
			return;
		}
		if ( headers_sent() ) {
			return;
		}
		if ( session_status() === PHP_SESSION_NONE ) {
			session_start();
		}
	}

	/**
	 * CF7 送信を横取りし、確認有効時はセッション保存＋リダイレクト
	 *
	 * @param WPCF7_ContactForm $form CF7 フォーム
	 * @param bool              $abort 参照渡し：true でメール送信を中止
	 * @param object            $submission WPCF7_Submission
	 */
	public static function intercept_submit( $form, &$abort, $submission ) {
		if ( self::$is_confirm_final_submit ) {
			return;
		}

		$form_id = $form->id();
		$confirm_enabled = get_post_meta( $form_id, self::META_CONFIRM_ENABLED, true );
		$form_slug = get_post_meta( $form_id, self::META_FORM_SLUG, true );

		if ( empty( $confirm_enabled ) || empty( $form_slug ) ) {
			return;
		}

		$posted_data = $submission->get_posted_data();
		if ( empty( $posted_data ) ) {
			return;
		}

		// 確認用固定ページのURL
		$confirm_page = get_page_by_path( 'confirm-' . $form_slug );
		if ( ! $confirm_page ) {
			return;
		}

		if ( ! isset( $_SESSION[ self::SESSION_KEY ] ) || ! is_array( $_SESSION[ self::SESSION_KEY ] ) ) {
			$_SESSION[ self::SESSION_KEY ] = array();
		}

		// 修正2: セッションキーを form_id + ランダム文字列で一意化し、複数タブ・複数フォームでの上書きを防止
		$store_token = $form_id . '_' . wp_generate_password( 16, false );
		$uploaded_files = method_exists( $submission, 'uploaded_files' ) ? $submission->uploaded_files() : array();

		// 修正3: ファイル添付情報の器を用意（将来の添付欠落対策）
		$_SESSION[ self::SESSION_KEY ][ $store_token ] = array(
			'posted_data'   => $posted_data,
			'uploaded_files' => is_array( $uploaded_files ) ? $uploaded_files : array(),
			'form_id'       => $form_id,
			'form_slug'     => $form_slug,
			'form_url'      => wp_get_referer() ?: home_url( '/' ),
		);

		$abort = true;
		$redirect_url = add_query_arg( 'cf7me_token', $store_token, get_permalink( $confirm_page ) );
		self::set_pending_redirect( $redirect_url );

		// 通常 POST 時はリダイレクト
		if ( ! WPCF7_Submission::is_restful() ) {
			wp_safe_redirect( $redirect_url );
			exit;
		}
	}

	/**
	 * Ajax レスポンスに cf7me_redirect を追加
	 *
	 * @param array $response
	 * @param array $result
	 * @return array
	 */
	public static function add_redirect_to_response( $response, $result ) {
		if ( 'aborted' === ( $result['status'] ?? '' ) && self::get_pending_redirect() ) {
			$response['cf7me_redirect'] = self::get_pending_redirect();
			self::clear_pending_redirect();
		}
		return $response;
	}

	private static function set_pending_redirect( $url ) {
		self::$pending_redirect = $url;
	}

	private static function get_pending_redirect() {
		return isset( self::$pending_redirect ) ? self::$pending_redirect : '';
	}

	private static function clear_pending_redirect() {
		self::$pending_redirect = '';
	}

	/**
	 * @var string
	 */
	private static $pending_redirect = '';

	/**
	 * 確定送信フロー中か（intercept をスキップするため）
	 *
	 * @var bool
	 */
	private static $is_confirm_final_submit = false;

	/**
	 * ショートコード [cf7me_confirm slug="xxx"] の出力
	 *
	 * @param array $atts slug（必須）
	 * @return string
	 */
	public static function render_confirm_shortcode( $atts ) {
		$atts  = shortcode_atts( array( 'slug' => '' ), $atts );
		$slug  = sanitize_key( $atts['slug'] );
		$token = isset( $_GET['cf7me_token'] ) ? sanitize_text_field( wp_unslash( $_GET['cf7me_token'] ) ) : '';

		if ( '' === $slug ) {
			return '<p>' . esc_html__( '確認画面: スラッグが指定されていません。', 'cf7-modern-enhancer' ) . '</p>';
		}

		// 修正2: トークンでセッションを特定（なければ slug で後方互換）
		$data = $token ? self::get_session_data_by_token( $token, $slug ) : self::get_session_data_by_slug( $slug );
		if ( ! $data ) {
			return '<p>' . esc_html__( 'セッションが切れているか、データがありません。再度フォームから送信してください。', 'cf7-modern-enhancer' ) . '</p>';
		}

		$form_id = (int) ( $data['form_id'] ?? 0 );
		$form_url = esc_url( $data['form_url'] ?? home_url( '/' ) );
		$posted_data = $data['posted_data'] ?? array();

		// ラベル取得のため CF7 フォームタグをスキャン
		$labels = self::get_field_labels( $form_id );
		$rows = array();
		foreach ( $posted_data as $name => $value ) {
			if ( '' !== $name && '_' === (string) $name[0] ) {
				continue;
			}
			$label = $labels[ $name ] ?? $name;
			$display_value = is_array( $value ) ? implode( ', ', $value ) : (string) $value;
			$rows[] = array(
				'label' => $label,
				'value' => $display_value,
			);
		}

		$html = '<div class="cf7me-confirm-wrap">';
		$html .= '<table class="cf7me-confirm-table">';
		$html .= '<tbody>';
		foreach ( $rows as $row ) {
			$html .= '<tr><th>' . esc_html( $row['label'] ) . '</th><td>' . esc_html( $row['value'] ) . '</td></tr>';
		}
		$html .= '</tbody></table>';

		$confirm_url = get_permalink();
		$html .= '<form method="post" action="' . esc_url( $confirm_url ) . '" class="cf7me-confirm-actions">';
		$html .= wp_nonce_field( 'cf7me_confirm_submit', 'cf7me_confirm_nonce', true, false );
		$html .= '<input type="hidden" name="cf7me_confirm_submit" value="1" />';
		$html .= '<input type="hidden" name="cf7me_slug" value="' . esc_attr( $slug ) . '" />';
		$html .= '<input type="hidden" name="cf7me_token" value="' . esc_attr( $token ) . '" />';
		// 修正6: history.back() で戻る（入力値復元の可能性）。フォールバックとして href をフォームURLに
		$html .= '<a href="' . esc_url( $form_url ) . '" class="cf7me-btn cf7me-btn-back" onclick="if (window.history.length > 1) { history.back(); return false; }">' . esc_html__( '修正する（戻る）', 'cf7-modern-enhancer' ) . '</a> ';
		$html .= '<button type="submit" name="cf7me_confirm_ok" value="1" class="cf7me-btn cf7me-btn-submit">' . esc_html__( '送信を確定する', 'cf7-modern-enhancer' ) . '</button>';
		$html .= '</form>';
		$html .= '</div>';

		return $html;
	}

	/**
	 * CF7 フォームのフィールドラベルを取得
	 *
	 * @param int $form_id
	 * @return array [field_name => label]
	 */
	private static function get_field_labels( $form_id ) {
		$form = wpcf7_contact_form( $form_id );
		if ( ! $form ) {
			return array();
		}
		$tags = $form->scan_form_tags( array( 'feature' => 'name-attr' ) );
		$labels = array();
		foreach ( $tags as $tag ) {
			if ( empty( $tag->name ) ) {
				continue;
			}
			if ( ! empty( $tag->labels ) && is_array( $tag->labels ) && isset( $tag->labels[0] ) ) {
				$labels[ $tag->name ] = $tag->labels[0];
			} elseif ( ! empty( $tag->values ) && is_array( $tag->values ) && isset( $tag->values[0] ) ) {
				$labels[ $tag->name ] = $tag->values[0];
			} else {
				$labels[ $tag->name ] = str_replace( array( '-', '_' ), ' ', $tag->name );
			}
		}
		return $labels;
	}

	/**
	 * 「確定」ボタン押下時の処理
	 */
	public static function handle_confirm_submit() {
		if ( empty( $_POST['cf7me_confirm_submit'] ) || empty( $_POST['cf7me_slug'] ) ) {
			return;
		}
		if ( ! check_admin_referer( 'cf7me_confirm_submit', 'cf7me_confirm_nonce' ) ) {
			return;
		}

		$slug  = sanitize_key( wp_unslash( $_POST['cf7me_slug'] ) );
		$token = isset( $_POST['cf7me_token'] ) ? sanitize_text_field( wp_unslash( $_POST['cf7me_token'] ) ) : '';
		$data  = $token ? self::get_session_data_by_token( $token, $slug ) : self::get_session_data_by_slug( $slug );
		if ( ! $data ) {
			wp_die( esc_html__( 'セッションが切れています。再度フォームから送信してください。', 'cf7-modern-enhancer' ) );
		}

		$form_id = (int) ( $data['form_id'] ?? 0 );
		$posted_data = $data['posted_data'] ?? array();
		if ( ! $form_id || empty( $posted_data ) ) {
			self::clear_session_data( $slug, $token );
			wp_die( esc_html__( 'データが不正です。', 'cf7-modern-enhancer' ) );
		}

		$form = wpcf7_contact_form( $form_id );
		if ( ! $form ) {
			self::clear_session_data( $slug, $token );
			wp_die( esc_html__( 'フォームが見つかりません。', 'cf7-modern-enhancer' ) );
		}

		// 修正3: 将来的に uploaded_files を $_FILES 等に反映する処理をここに追加可能
		$uploaded_files = $data['uploaded_files'] ?? array();

		// $_POST を一時的に差し替えて CF7 のメール送信を実行
		$backup_post = $_POST;
		$_POST = array_merge(
			$posted_data,
			array(
				'_wpcf7'             => (string) $form_id,
				'_wpcf7_unit_tag'    => 'wpcf7-f' . $form_id . '-p' . get_queried_object_id() . '-o1',
				'_wpcf7_container_post' => (string) get_queried_object_id(),
			)
		);

		self::$is_confirm_final_submit = true;
		$form->submit();
		self::$is_confirm_final_submit = false;
		$_POST = $backup_post;

		self::clear_session_data( $slug, $token );

		$thanks_url = get_post_meta( $form_id, self::META_THANKS_URL, true );
		if ( is_string( $thanks_url ) && '' !== trim( $thanks_url ) ) {
			$thanks_url = esc_url_raw( trim( $thanks_url ) );
		} else {
			$thanks_url = home_url( '/' );
		}
		$thanks_url = add_query_arg( 'cf7me_thanks', '1', $thanks_url );

		wp_safe_redirect( $thanks_url );
		exit;
	}

	/**
	 * トークンでセッションからデータ取得（form_slug と一致することを検証）
	 *
	 * @param string $token ストア時に発行したトークン
	 * @param string $slug  ショートコードの slug（検証用）
	 * @return array|null
	 */
	private static function get_session_data_by_token( $token, $slug ) {
		if ( empty( $token ) || ! isset( $_SESSION[ self::SESSION_KEY ][ $token ] ) || ! is_array( $_SESSION[ self::SESSION_KEY ][ $token ] ) ) {
			return null;
		}
		$data = $_SESSION[ self::SESSION_KEY ][ $token ];
		if ( ( $data['form_slug'] ?? '' ) !== $slug ) {
			return null;
		}
		return $data;
	}

	/**
	 * スラッグでセッションからデータ取得（後方互換）
	 *
	 * @param string $slug
	 * @return array|null
	 */
	private static function get_session_data_by_slug( $slug ) {
		if ( ! isset( $_SESSION[ self::SESSION_KEY ] ) || ! is_array( $_SESSION[ self::SESSION_KEY ] ) ) {
			return null;
		}
		foreach ( $_SESSION[ self::SESSION_KEY ] as $key => $data ) {
			if ( is_array( $data ) && ( $data['form_slug'] ?? '' ) === $slug ) {
				return $data;
			}
		}
		// 旧形式: キーがスラッグだった場合
		if ( isset( $_SESSION[ self::SESSION_KEY ][ $slug ] ) && is_array( $_SESSION[ self::SESSION_KEY ][ $slug ] ) ) {
			return $_SESSION[ self::SESSION_KEY ][ $slug ];
		}
		return null;
	}

	/**
	 * セッションの該当エントリを削除
	 *
	 * @param string $slug
	 * @param string $token トークンがある場合はそれで削除
	 */
	private static function clear_session_data( $slug, $token = '' ) {
		if ( '' !== $token && isset( $_SESSION[ self::SESSION_KEY ][ $token ] ) ) {
			unset( $_SESSION[ self::SESSION_KEY ][ $token ] );
			return;
		}
		if ( isset( $_SESSION[ self::SESSION_KEY ][ $slug ] ) ) {
			unset( $_SESSION[ self::SESSION_KEY ][ $slug ] );
		}
	}
}
