<?php
/**
 * CF7 Wizard Repository
 *
 * CF7 フォームの取得・保存（メタ操作）を担当
 *
 * @package CF7_Modern_Enhancer
 */

defined( 'ABSPATH' ) || exit;

/**
 * Class CF7_Wizard_Repository
 */
final class CF7_Wizard_Repository {

	const POST_TYPE = 'wpcf7_contact_form';

	/**
	 * フォーム一覧を取得（プルダウン用）
	 *
	 * @return array [ ['id' => int, 'title' => string], ... ]
	 */
	public static function get_form_list() {
		$posts = get_posts( array(
			'post_type'      => self::POST_TYPE,
			'post_status'    => 'any',
			'posts_per_page' => -1,
			'orderby'        => 'title',
			'order'          => 'ASC',
		) );

		$forms = array();
		foreach ( $posts as $post ) {
			$forms[] = array(
				'id'    => (int) $post->ID,
				'title' => $post->post_title,
			);
		}
		return $forms;
	}

	/**
	 * フォーム本体＋メール設定＋確認設定を一括取得
	 *
	 * @param int $form_id フォームID
	 * @return array [ 'content' => string, 'mail' => array, 'mail_2' => array, 'form_slug' => string, 'confirm_enabled' => bool ]
	 */
	public static function get_form_full( $form_id ) {
		$form_id = absint( $form_id );
		return array(
			'content'         => self::get_form_data( $form_id ),
			'mail'            => self::get_mail_meta( $form_id, '_mail' ),
			'mail_2'          => self::get_mail_meta( $form_id, '_mail_2' ),
			'form_slug'       => (string) get_post_meta( $form_id, '_cf7me_form_slug', true ),
			'confirm_enabled' => (bool) get_post_meta( $form_id, '_cf7me_confirm_enabled', true ),
			'thanks_url'      => (string) get_post_meta( $form_id, '_cf7me_thanks_url', true ),
		);
	}

	/**
	 * 公開済み固定ページ一覧を取得（プルダウン用）
	 * 確認ページ（confirm-* および [cf7me_confirm] を含むページ）は除外
	 *
	 * @return array [ ['id' => int, 'title' => string, 'url' => string ], ... ]
	 */
	public static function get_pages_list() {
		$pages = get_posts( array(
			'post_type'      => 'page',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'orderby'        => 'title',
			'order'          => 'ASC',
		) );

		$list = array();
		foreach ( $pages as $page ) {
			if ( self::is_excluded_from_thanks_pages( $page ) ) {
				continue;
			}
			$list[] = array(
				'id'    => (int) $page->ID,
				'title' => $page->post_title,
				'url'   => get_permalink( $page ),
			);
		}
		return $list;
	}

	/**
	 * スラッグが他フォームで既に使用されているか判定（新規作成時の一意性チェック用）
	 *
	 * @param string $slug チェックするスラッグ
	 * @param int    $exclude_form_id 除外するフォームID（更新時の自フォーム）
	 * @return bool
	 */
	public static function slug_exists( $slug, $exclude_form_id = 0 ) {
		$slug = sanitize_key( (string) $slug );
		if ( '' === $slug ) {
			return false;
		}
		$args = array(
			'post_type'      => self::POST_TYPE,
			'post_status'    => 'any',
			'posts_per_page' => 1,
			'meta_query'     => array(
				array(
					'key'   => '_cf7me_form_slug',
					'value' => $slug,
				),
			),
		);
		if ( $exclude_form_id > 0 ) {
			$args['post__not_in'] = array( $exclude_form_id );
		}
		$posts = get_posts( $args );
		return ! empty( $posts );
	}

	/**
	 * サンクスページ選択肢から除外するページか判定
	 *
	 * @param WP_Post $page
	 * @return bool
	 */
	private static function is_excluded_from_thanks_pages( $page ) {
		if ( false !== strpos( (string) $page->post_name, 'confirm-' ) ) {
			return true;
		}
		if ( false !== strpos( (string) $page->post_content, '[cf7me_confirm' ) ) {
			return true;
		}
		return false;
	}

	/**
	 * フォームのショートコード本体を取得
	 *
	 * @param int $form_id フォームID
	 * @return string
	 */
	public static function get_form_data( $form_id ) {
		$form_id = absint( $form_id );
		if ( 0 === $form_id ) {
			return '';
		}

		$post = get_post( $form_id );
		if ( ! $post || self::POST_TYPE !== $post->post_type ) {
			return '';
		}

		$form = get_post_meta( $form_id, '_form', true );
		return '' !== $form ? $form : ( $post->post_content ?: '' );
	}

	/**
	 * フォームを保存
	 *
	 * @param int    $form_id        新規なら 0
	 * @param string $title          タイトル
	 * @param string $form_content   ショートコード群
	 * @param array  $mail           管理者宛て通知
	 * @param array  $mail_2         自動返信メール
	 * @param string $form_slug      英語名（スラッグ）
	 * @param bool   $confirm_enabled 確認画面を有効にするか
	 * @return int|WP_Error
	 */
	public static function save_form( $form_id, $title, $form_content, $mail = array(), $mail_2 = array(), $form_slug = '', $confirm_enabled = false, $thanks_url = '' ) {
		$post_id = self::upsert_post( $form_id, $title, $form_content );
		if ( is_wp_error( $post_id ) || 0 === $post_id ) {
			return $post_id;
		}

		self::save_form_meta( $post_id, $form_content );
		self::save_mail_metas( $post_id, $mail, $mail_2 );
		self::save_auxiliary_metas( $post_id );
		self::save_confirm_metas( $post_id, $form_slug, $confirm_enabled, $thanks_url );

		return $post_id;
	}

	/**
	 * 確認・完了設定メタを保存し、確認用固定ページを自動作成
	 *
	 * @param int    $post_id
	 * @param string $form_slug
	 * @param bool   $confirm_enabled
	 * @param string $thanks_url
	 */
	private static function save_confirm_metas( $post_id, $form_slug, $confirm_enabled, $thanks_url = '' ) {
		$form_slug = sanitize_key( (string) $form_slug );
		update_post_meta( $post_id, '_cf7me_form_slug', $form_slug );
		update_post_meta( $post_id, '_cf7me_confirm_enabled', $confirm_enabled ? '1' : '' );
		$thanks_url = esc_url_raw( trim( (string) $thanks_url ) );
		update_post_meta( $post_id, '_cf7me_thanks_url', $thanks_url );

		if ( $confirm_enabled && '' !== $form_slug ) {
			self::ensure_confirm_page( $form_slug );
		}
	}

	/**
	 * 確認用固定ページを作成または更新
	 * ショートコードが消えていた場合は、既存文章を維持し末尾に再挿入
	 *
	 * @param string $form_slug
	 * @return int|WP_Error ページID
	 */
	public static function ensure_confirm_page( $form_slug ) {
		$form_slug  = sanitize_key( $form_slug );
		$slug       = 'confirm-' . $form_slug;
		$shortcode  = '[cf7me_confirm slug="' . esc_attr( $form_slug ) . '"]';
		$shortcode_pattern = '[cf7me_confirm'; // ショートコードの存在チェック用

		$existing = get_page_by_path( $slug, OBJECT, 'page' );
		if ( $existing ) {
			$current_content = (string) $existing->post_content;
			$new_content     = $current_content;

			if ( false === strpos( $current_content, $shortcode_pattern ) ) {
				$preserved = trim( $current_content );
				$new_content = $preserved ? $preserved . "\n\n" . $shortcode : $shortcode;
			}

			wp_update_post( array(
				'ID'           => $existing->ID,
				'post_content' => $new_content,
				'post_status'  => 'publish',
			) );
			return $existing->ID;
		}

		return wp_insert_post( array(
			'post_type'    => 'page',
			'post_status'  => 'publish',
			'post_title'   => __( '入力内容の確認', 'cf7-modern-enhancer' ),
			'post_name'    => $slug,
			'post_content' => $shortcode,
		), true );
	}

	/**
	 * メールメタを取得（配列で返す）
	 *
	 * @param int    $form_id フォームID
	 * @param string $key     メタキー
	 * @return array
	 */
	private static function get_mail_meta( $form_id, $key ) {
		$val = get_post_meta( $form_id, $key, true );
		return is_array( $val ) ? $val : array();
	}

	/**
	 * 投稿を挿入または更新
	 *
	 * @param int    $form_id 0 なら新規
	 * @param string $title
	 * @param string $form_content
	 * @return int|WP_Error
	 */
	private static function upsert_post( $form_id, $title, $form_content ) {
		$form_id = absint( $form_id );
		$is_new  = ( 0 === $form_id );

		if ( $is_new ) {
			return wp_insert_post( array(
				'post_type'    => self::POST_TYPE,
				'post_status'  => 'publish',
				'post_title'   => $title,
				'post_content' => $form_content,
			), true );
		}

		$existing = get_post( $form_id );
		if ( ! $existing || self::POST_TYPE !== $existing->post_type ) {
			return new WP_Error( 'invalid_form', __( '指定されたフォームが見つかりません。', 'cf7-modern-enhancer' ) );
		}

		return wp_update_post( array(
			'ID'           => $form_id,
			'post_title'   => $title,
			'post_content' => $form_content,
			'post_status'  => 'publish',
		), true );
	}

	/**
	 * _form メタを保存
	 *
	 * @param int    $post_id
	 * @param string $form_content
	 */
	private static function save_form_meta( $post_id, $form_content ) {
		$normalized = function_exists( 'wpcf7_normalize_newline_deep' )
			? wpcf7_normalize_newline_deep( $form_content )
			: $form_content;
		update_post_meta( $post_id, '_form', $normalized );
	}

	/**
	 * _mail / _mail_2 を保存
	 *
	 * @param int   $post_id
	 * @param array $mail
	 * @param array $mail_2
	 */
	private static function save_mail_metas( $post_id, $mail, $mail_2 ) {
		if ( ! empty( $mail ) && is_array( $mail ) ) {
			$merged = array_merge( self::get_default_mail(), $mail );
			update_post_meta( $post_id, '_mail', $merged );
		} else {
			$current = get_post_meta( $post_id, '_mail', true );
			if ( empty( $current ) || ! is_array( $current ) ) {
				update_post_meta( $post_id, '_mail', self::get_default_mail() );
			}
		}

		if ( ! empty( $mail_2 ) && is_array( $mail_2 ) ) {
			$merged = array_merge( self::get_default_mail_2(), $mail_2 );
			update_post_meta( $post_id, '_mail_2', $merged );
		} else {
			$current = get_post_meta( $post_id, '_mail_2', true );
			if ( empty( $current ) || ! is_array( $current ) ) {
				update_post_meta( $post_id, '_mail_2', self::get_default_mail_2() );
			}
		}
	}

	/**
	 * _messages, _locale, _hash などを保存
	 *
	 * @param int $post_id
	 */
	private static function save_auxiliary_metas( $post_id ) {
		$messages = get_post_meta( $post_id, '_messages', true );
		if ( empty( $messages ) || ! is_array( $messages ) ) {
			update_post_meta( $post_id, '_messages', self::get_default_messages() );
		}
		update_post_meta( $post_id, '_locale', determine_locale() );

		if ( function_exists( 'wpcf7_generate_contact_form_hash' ) ) {
			delete_post_meta( $post_id, '_hash' );
			add_post_meta( $post_id, '_hash', wpcf7_generate_contact_form_hash( $post_id ), true );
		}
	}

	/**
	 * CF7 互換デフォルトメール（Mail 1）
	 *
	 * @return array
	 */
	public static function get_default_mail() {
		if ( class_exists( 'WPCF7_ContactFormTemplate' ) ) {
			$t = WPCF7_ContactFormTemplate::get_default( 'mail' );
			if ( is_array( $t ) ) {
				return $t;
			}
		}
		return array(
			'active'            => true,
			'subject'           => sprintf( '[%s] %s', get_bloginfo( 'name' ), '[your-subject]' ),
			'sender'            => sprintf( '%s <%s>', get_bloginfo( 'name' ), get_option( 'admin_email' ) ),
			'body'              => "From: [your-name] <[your-email]>\nSubject: [your-subject]\n\nMessage Body:\n[your-message]\n\n--\n" . sprintf( 'Sent from %s', home_url() ),
			'recipient'         => '[_site_admin_email]',
			'additional_headers' => 'Reply-To: [your-email]',
			'attachments'       => '',
			'use_html'          => 0,
			'exclude_blank'     => 0,
		);
	}

	/**
	 * CF7 互換デフォルトメール（Mail 2）
	 *
	 * @return array
	 */
	public static function get_default_mail_2() {
		if ( class_exists( 'WPCF7_ContactFormTemplate' ) ) {
			$t = WPCF7_ContactFormTemplate::get_default( 'mail_2' );
			if ( is_array( $t ) ) {
				return $t;
			}
		}
		return array(
			'active'            => false,
			'subject'           => '',
			'sender'            => '',
			'body'              => '',
			'recipient'         => '[your-email]',
			'additional_headers' => '',
			'attachments'       => '',
			'use_html'          => 0,
			'exclude_blank'     => 0,
		);
	}

	/**
	 * CF7 互換デフォルトメッセージ
	 *
	 * @return array
	 */
	public static function get_default_messages() {
		if ( function_exists( 'wpcf7_messages' ) ) {
			$messages = array();
			foreach ( wpcf7_messages() as $key => $arr ) {
				$messages[ $key ] = isset( $arr['default'] ) ? $arr['default'] : '';
			}
			return $messages;
		}
		return array(
			'mail_sent_ok'     => __( 'Thank you for your message. It has been sent.', 'cf7-modern-enhancer' ),
			'mail_sent_ng'     => __( 'There was an error trying to send your message. Please try again later.', 'cf7-modern-enhancer' ),
			'validation_error' => __( 'One or more fields have an error. Please check and try again.', 'cf7-modern-enhancer' ),
		);
	}
}
