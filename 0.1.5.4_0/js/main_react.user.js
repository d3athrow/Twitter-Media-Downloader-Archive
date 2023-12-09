// ==UserScript==
// @name            Twitter Media Downloader for new Twitter.com 2019
// @description     Download media files on new Twitter.com 2019.
// @version         0.1.5.0
// @namespace       https://memo.furyutei.work/
// @author          furyu
// @include         https://twitter.com/*
// @include         https://mobile.twitter.com/*
// @include         https://api.twitter.com/*
// @include         https://nazo.furyutei.work/oauth/*
// @grant           GM_xmlhttpRequest
// @grant           GM_setValue
// @grant           GM_getValue
// @grant           GM_deleteValue
// @connect         mobile.twitter.com
// @connect         twitter.com
// @connect         twimg.com
// @connect         cdn.vine.co
// @require         https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.4/jszip.min.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/decimal.js/7.3.0/decimal.min.js
// @require         https://furyutei.github.io/twMediaDownloader/src/js/twitter-oauth/sha1.js
// @require         https://furyutei.github.io/twMediaDownloader/src/js/twitter-oauth/oauth.js
// @require         https://furyutei.github.io/twMediaDownloader/src/js/twitter-oauth/twitter-api.js
// @require         https://furyutei.github.io/twMediaDownloader/src/js/timeline.js
// ==/UserScript==

/*
■ 外部ライブラリ
- [jQuery](https://jquery.com/), [jquery/jquery: jQuery JavaScript Library](https://github.com/jquery/jquery)  
    [License | jQuery Foundation](https://jquery.org/license/)  
    The MIT License  

- [JSZip](https://stuk.github.io/jszip/)  
    Copyright (c) 2009-2014 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso  
    The MIT License  
    [jszip/LICENSE.markdown](https://github.com/Stuk/jszip/blob/master/LICENSE.markdown)  

- [MikeMcl/decimal.js: An arbitrary-precision Decimal type for JavaScript](https://github.com/MikeMcl/decimal.js)  
    Copyright (c) 2016, 2017 Michael Mclaughlin  
    The MIT Licence  
    [decimal.js/LICENCE.md](https://github.com/MikeMcl/decimal.js/blob/master/LICENCE.md)  

- [sha1.js](http://pajhome.org.uk/crypt/md5/sha1.html)  
    Copyright Paul Johnston 2000 - 2009
    The BSD License

- [oauth.js](http://code.google.com/p/oauth/source/browse/code/javascript/oauth.js)(^1)  
    Copyright 2008 Netflix, Inc.
    [The Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)  
    (^1) archived: [oauth.js](https://web.archive.org/web/20130921042751/http://code.google.com/p/oauth/source/browse/code/javascript/oauth.js)  


■ 関連記事など
- [Twitter メディアダウンローダ：ユーザータイムラインの原寸画像や動画をまとめてダウンロードするユーザースクリプト(PC用Google Chrome・Firefox等対応) - 風柳メモ](http://furyu.hatenablog.com/entry/20160723/1469282864)  

- [furyutei/twMediaDownloader: Download images of user's media-timeline on Twitter.](https://github.com/furyutei/twMediaDownloader)  

- [lambtron/chrome-extension-twitter-oauth-example: Chrome Extension Twitter Oauth Example](https://github.com/lambtron/chrome-extension-twitter-oauth-example)  
    Copyright (c) 2017 Andy Jiang  
    The MIT Licence  
    [chrome-extension-twitter-oauth-example/LICENSE](https://github.com/lambtron/chrome-extension-twitter-oauth-example/blob/master/LICENSE)  
*/

/*
The MIT License (MIT)

Copyright (c) 2020 furyu <furyutei@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/


( function ( w, d ) {

'use strict';

// ■ パラメータ {
var OPTIONS = {
    IMAGE_DOWNLOAD_LINK : true // true: 個別ツイートに画像ダウンロードボタンを追加
,   VIDEO_DOWNLOAD_LINK : true // true: 個別ツイートに動画ダウンロードボタンを追加
,   OPEN_MEDIA_LINK_BY_DEFAULT : false // true: デフォルトでメディアリンクを開く（[Alt]＋Click時にダウンロード）
,   ENABLE_FILTER : true // true: 検索タイムライン使用時に filter: をかける
    // ※検索タイムライン使用時、filter: をかけない場合にヒットする画像や動画が、filter: をかけるとヒットしないことがある
,   DOWNLOAD_SIZE_LIMIT_MB : 500 // ダウンロード時のサイズ制限(MB)
,   ENABLE_VIDEO_DOWNLOAD : true // true: 動画ダウンロードを有効にする（ユーザー認証が必要）
,   AUTO_CONTINUE : true // true: 個数または容量制限にて止まった際、保存後に自動継続
    
,   OPERATION : true // true: 動作中、false: 停止中

,   QUICK_LOAD_GIF : true // true: アニメーションGIF（から変換された動画）の情報(URL)取得を簡略化

,   DEFAULT_LIMIT_TWEET_NUMBER : 0 // ダウンロードできる画像付きツイート数制限のデフォルト値
,   DEFAULT_SUPPORT_IMAGE : true // true: 画像をダウンロード対象にする
,   DEFAULT_SUPPORT_GIF : true // true: アニメーションGIF（から変換された動画）をダウンロード対象にする
,   DEFAULT_SUPPORT_VIDEO : true // true: 動画をダウンロード対象にする
,   DEFAULT_INCLUDE_RETWEETS : false // true: RTを含む
,   DEFAULT_SUPPORT_NOMEDIA : false // false: メディアを含まないツイートもログ・CSVやCSVに記録する
,   DEFAULT_DRY_RUN : false // true: 走査のみ

,   ENABLE_ZIPREQUEST : false // true: ZipRequest を使用してバックグラウンドでダウンロード＆アーカイブ(拡張機能の場合)
,   INCOGNITO_MODE : false // true: 秘匿モード（シークレットウィンドウ内で起動・拡張機能の場合のみ）
    // TODO: Firefox でシークレットウィンドウ内で実行する場合、ENABLE_ZIPREQUEST が true だと zip_request.generate() で失敗
    // → 暫定的に、判別して ZipRequest を使用しないようにする

,   TWITTER_OAUTH_POPUP : true // true: OAuth 認証時、ポップアップウィンドウを使用 / false: 同、別タブを使用

,   TWITTER_API_DELAY_TIME_MS : 1100 // Twitter API コール時、前回からの最小間隔(ms)
    // Twitter API には Rate Limit があるため、続けてコールする際に待ち時間を挟む
    // /statuses/show.json の場合、15分で900回（正確に 900回／15分というわけではなく、15分毎にリセットされる）→1秒以上は空けておく
    // TODO: 別のタブで並列して実行されている場合や、別ブラウザでの実行は考慮していない

,   TWITTER_API2_DELAY_TIME_MS : 5100 // Twitter API2 コール時、前回からの最小間隔(ms)
    // ※ api.twitter.com/2/timeline/conversation/:id の場合、15分で180回
    // TODO: 別のタブで並列して実行されている場合や、別ブラウザでの実行は考慮していない
};

// }


// ■ 共通変数 {
var SCRIPT_NAME = 'twMediaDownloader',
    IS_CHROME_EXTENSION = !! ( w.is_chrome_extension ),
    OAUTH_POPUP_WINDOW_NAME = SCRIPT_NAME + '-OAuthAuthorization',
    DEBUG = false,
    self = undefined;

if ( ! /^https:\/\/(?:mobile\.)?twitter\.com(?!\/account\/login_verification)/.test( w.location.href ) ) {
    if ( ( ! IS_CHROME_EXTENSION ) && ( typeof Twitter != 'undefined' ) ) {
        // Twitter OAuth 認証用ポップアップとして起動した場合は、Twitter.initialize() により tokens 取得用処理を実施（内部でTwitter.initializePopupWindow()を呼び出し）
        // ※ユーザースクリプトでの処理（拡張機能の場合、session.jsにて実施）
        Twitter.initialize( {
            popup_window_name : OAUTH_POPUP_WINDOW_NAME
        } );
    }
    return;
}

if ( /^https:\/\/(?:mobile\.)?twitter\.com\/i\/cards/.test( w.location.href ) ) {
    // https://twitter.com/i/cards/～ では実行しない
    return;
}


if ( ! d.querySelector( 'div#react-root' ) ) {
    return;
}

[ 'jQuery', 'JSZip', 'Decimal', 'TwitterTimeline' ].map( ( library_name ) => {
    if ( typeof window[ library_name ] ) {
        return;
    }
    
    const
        message = SCRIPT_NAME + '(' + location.href + '): Library not found - ' +  library_name;
    
    if ( w === w.top ) {
        console.error( message );
    }
    throw new Error( message );
} );

var $ = jQuery,
    IS_TOUCHED = ( function () {
        var touched_id = SCRIPT_NAME + '_touched',
            $touched = $( '#' + touched_id );
        
        if ( 0 < $touched.length ) {
            return true;
        }
        
        $( '<b>' ).attr( 'id', touched_id ).css( 'display', 'none' ).appendTo( $( d.documentElement ) );
        
        return false;
    } )();

if ( IS_TOUCHED ) {
    console.error( SCRIPT_NAME + ': Already loaded.' );
    return;
}


if ( ( w.name == OAUTH_POPUP_WINDOW_NAME ) && ( /^\/(?:home\/?)?$/.test( new URL( location.href ).pathname ) ) ) {
    // OAuth 認証の前段階でポップアップブロック対策用ダミーとして起動した home 画面については表示を消す
    d.body.style.display = 'none';
    return;
}


var LANGUAGE = ( function () {
        try {
            return $( 'html' ).attr( 'lang' );
        }
        catch ( error ) {
            try{
                return ( w.navigator.browserLanguage || w.navigator.language || w.navigator.userLanguage ).substr( 0, 2 );
            }
            catch ( error ) {
                return 'en';
            }
        }
    } )(),
    
    USERAGENT =  w.navigator.userAgent.toLowerCase(),
    PLATFORM = w.navigator.platform.toLowerCase(),
    IS_FIREFOX = ( window.IS_FIREFOX ) || ( 0 <= USERAGENT.indexOf( 'firefox' ) ),
        // TODO: GoodTwitter等を併用していると、User-Agent では判別できなくなる（"Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; AS; rv:11.0) Waterfox/56.2"のようになる）
        // → browser が定義されているかで判別(browser_info.js)
    IS_MAC = ( 0 <= PLATFORM.indexOf( 'mac' ) ),
    
    //BASE64_BLOB_THRESHOLD = 30000000, // Data URL(base64) → Blob URL 切替の閾値(Byte) (Firefox用)(TODO: 値は要調整)
    BASE64_BLOB_THRESHOLD = 0, // Data URL(base64) → Blob URL 切替の閾値(Byte) (Firefox用)(TODO: 値は要調整)
    // TODO: Firefox の場合、Blob URL だと警告が出る場合がある・その一方、Data URL 形式だと大きいサイズはダウンロード不可
    // → Data URL 形式だとかなり重く、動作が不安定になるため、全て Blob URL に
    //   ※警告を出さないためには、「≡」→「オプション」→「プライバシーとセキュリティ」（about:preferences#privacy）にて、
    //     「セキュリティ」→「詐欺コンテンツと危険なソフトウェアからの防護」にある、
    //     「☑不要な危険ソフトウェアを警告する(C)」のチェックを外す
    
    //{ "timeline.js" より
    TwitterTimeline = ( ( TwitterTimeline ) => {
        TwitterTimeline.debug_mode = DEBUG;
        TwitterTimeline.logged_script_name = SCRIPT_NAME;
        
        return TwitterTimeline;
    } )( window.TwitterTimeline ),
    
    TIMELINE_TYPE = TwitterTimeline.TIMELINE_TYPE,
    TIMELINE_STATUS = TwitterTimeline.TIMELINE_STATUS,
    REACTION_TYPE = TwitterTimeline.REACTION_TYPE,
    MEDIA_TYPE = TwitterTimeline.MEDIA_TYPE,
    CLASS_TIMELINE_SET = TwitterTimeline.CLASS_TIMELINE_SET,
    TWITTER_API = TwitterTimeline.TWITTER_API,
    //}
    
    API_RATE_LIMIT_STATUS = 'https://api.twitter.com/1.1/application/rate_limit_status.json',
    API_VIDEO_CONFIG_BASE = 'https://api.twitter.com/1.1/videos/tweet/config/#TWEETID#.json',
    API_TWEET_SHOW_BASE = 'https://api.twitter.com/1.1/statuses/show.json?include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&skip_status=1&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_reply_count=1&tweet_mode=extended&trim_user=false&include_ext_media_color=true&id=#TWEETID#',
    GIF_VIDEO_URL_BASE = 'https://video.twimg.com/tweet_video/#VIDEO_ID#.mp4',
    
    LOADING_IMAGE_URL = 'https://abs.twimg.com/a/1460504487/img/t1/spinner-rosetta-gray-32x32.gif',
    
    TEMPORARY_PAGE_URL = ( () => {
        // ポップアップブロック対策に一時的に読み込むページのURLを取得
        // ※なるべく軽いページが望ましい
        // ※非同期で設定しているが、ユーザーがアクションを起こすまでには読み込まれているだろうことを期待
        var test_url = new URL( '/favicon.ico?_temporary_page=true', d.baseURI ).href;
        
        fetch( test_url ).then( ( response ) => {
            TEMPORARY_PAGE_URL = test_url;
        } );
        return null;
    } )(),
    
    limit_tweet_number = OPTIONS.DEFAULT_LIMIT_TWEET_NUMBER,
    support_image = false,
    support_gif = false,
    support_video = false,
    include_retweets = false,  // true: ユーザータイムライン上の RT のメディアも対象とする
    support_nomedia = false,
    dry_run = false; // true: 走査のみ

switch ( LANGUAGE ) {
    case 'ja' :
        OPTIONS.DOWNLOAD_BUTTON_TEXT = '⇩';
        OPTIONS.DOWNLOAD_BUTTON_TEXT_LONG = 'メディア ⇩';
        OPTIONS.DOWNLOAD_BUTTON_HELP_TEXT = 'タイムラインの画像/動画を保存';
        OPTIONS.DIALOG_TWEET_ID_RANGE_HEADER = '対象 Tweet ID 範囲 (空欄時は制限なし)';
        OPTIONS.DIALOG_TWEET_ID_RANGE_MARK = '＜ ID ＜';
        OPTIONS.DIALOG_TWEET_ID_PLACEHOLDER_LEFT = '下限IDまたは日時';
        OPTIONS.DIALOG_TWEET_ID_PLACEHOLDER_RIGHT = '上限IDまたは日時';
        OPTIONS.DIALOG_LIMIT_TWEET_NUMBER_TEXT = '制限数';
        OPTIONS.DIALOG_BUTTON_START_TEXT = '開始';
        OPTIONS.DIALOG_BUTTON_STOP_TEXT = '停止';
        OPTIONS.DIALOG_BUTTON_CLOSE_TEXT = '閉じる';
        OPTIONS.CHECKBOX_IMAGE_TEXT = '画像';
        OPTIONS.CHECKBOX_GIF_TEXT = '動画(GIF)';
        OPTIONS.CHECKBOX_VIDEO_TEXT = '動画';
        OPTIONS.CHECKBOX_NOMEDIA_TEXT = 'メディア無し';
        OPTIONS.CHECKBOX_INCLUDE_RETWEETS = 'RTを含む';
        OPTIONS.CHECKBOX_DRY_RUN = '走査のみ';
        OPTIONS.CHECKBOX_ALERT = '少なくとも一つのメディアタイプにはチェックを入れて下さい';
        OPTIONS.IMAGE_DOWNLOAD_LINK_TEXT = '画像⇩';
        OPTIONS.VIDEO_DOWNLOAD_LINK_TEXT = 'MP4⇩';
        OPTIONS.DOWNLOAD_MEDIA_TITLE = 'ダウンロード';
        OPTIONS.OPEN_MEDIA_LINK = 'メディアを開く';
        
        OPTIONS.LIKES_DOWNLOAD_BUTTON_TEXT_LONG = 'いいね ⇩';
        OPTIONS.LIKES_DOWNLOAD_BUTTON_HELP_TEXT = '『いいね』をしたツイートの画像/動画を保存';
        OPTIONS.DIALOG_DATE_RANGE_HEADER_LIKES = '対象『いいね』日時範囲 (空欄時は制限なし)';
        OPTIONS.DIALOG_DATE_RANGE_HEADER_NOTIFICATIONS = '対象『通知』日時範囲 (空欄時は制限なし)';
        OPTIONS.DIALOG_DATE_RANGE_HEADER_BOOKMARKS = '対象『ブックマーク』日時範囲 (空欄時は制限なし)';
        OPTIONS.DIALOG_DATE_RANGE_MARK = '＜ 日時 ＜';
        OPTIONS.DIALOG_DATE_PLACEHOLDER_LEFT = '下限日時';
        OPTIONS.DIALOG_DATE_PLACEHOLDER_RIGHT = '上限日時';
        OPTIONS.DIALOG_DUPLICATE_WARNING = 'ダウンロードダイアログを閉じてから開き直してください';
        
        OPTIONS.MENTIONS_DOWNLOAD_BUTTON_TEXT_LONG = '@ツイート ⇩';
        OPTIONS.MENTIONS_DOWNLOAD_BUTTON_HELP_LONG = '通知(@ツイート)の画像/動画を保存';
        
        OPTIONS.BOOKMARKS_DOWNLOAD_BUTTON_HELP_LONG = 'ブックマークの画像/動画を保存';
        break;
    default:
        OPTIONS.DOWNLOAD_BUTTON_TEXT = '⇩';
        OPTIONS.DOWNLOAD_BUTTON_TEXT_LONG = 'Media ⇩';
        OPTIONS.DOWNLOAD_BUTTON_HELP_TEXT = 'Download images/videos from timeline';
        OPTIONS.DIALOG_TWEET_ID_RANGE_HEADER = 'Download Tweet ID range (There is no limit when left blank)';
        OPTIONS.DIALOG_TWEET_ID_RANGE_MARK = '< ID <';
        OPTIONS.DIALOG_TWEET_ID_PLACEHOLDER_LEFT = 'Since ID or datetime';
        OPTIONS.DIALOG_TWEET_ID_PLACEHOLDER_RIGHT = 'Until ID or datetime';
        OPTIONS.DIALOG_LIMIT_TWEET_NUMBER_TEXT = 'Limit';
        OPTIONS.DIALOG_BUTTON_START_TEXT = 'Start';
        OPTIONS.DIALOG_BUTTON_STOP_TEXT = 'Stop';
        OPTIONS.DIALOG_BUTTON_CLOSE_TEXT = 'Close';
        OPTIONS.CHECKBOX_IMAGE_TEXT = 'Images';
        OPTIONS.CHECKBOX_GIF_TEXT = 'Videos(GIF)';
        OPTIONS.CHECKBOX_VIDEO_TEXT = 'Videos';
        OPTIONS.CHECKBOX_NOMEDIA_TEXT = 'No media';
        OPTIONS.CHECKBOX_INCLUDE_RETWEETS = 'include RTs';
        OPTIONS.CHECKBOX_DRY_RUN = 'Dry run';
        OPTIONS.CHECKBOX_ALERT = 'Please check the checkbox of at least one media type !';
        OPTIONS.IMAGE_DOWNLOAD_LINK_TEXT = 'IMG⇩';
        OPTIONS.VIDEO_DOWNLOAD_LINK_TEXT = 'MP4⇩';
        OPTIONS.DOWNLOAD_MEDIA_TITLE = 'Download';
        OPTIONS.OPEN_MEDIA_LINK = 'Open media links';
        
        OPTIONS.LIKES_DOWNLOAD_BUTTON_TEXT_LONG = 'Likes ⇩';
        OPTIONS.LIKES_DOWNLOAD_BUTTON_HELP_TEXT = 'Download images/videos from Likes-timeline';
        OPTIONS.DIALOG_DATE_RANGE_HEADER_LIKES = 'Download "Likes" date-time range (There is no limit when left blank)';
        OPTIONS.DIALOG_DATE_RANGE_HEADER_NOTIFICATIONS = 'Download "Notifications" date-time range (There is no limit when left blank)';
        OPTIONS.DIALOG_DATE_RANGE_HEADER_BOOKMARKS = 'Download "Bookmarks" date-time range (There is no limit when left blank)';
        OPTIONS.DIALOG_DATE_RANGE_MARK = '< DATETIME <';
        OPTIONS.DIALOG_DATE_PLACEHOLDER_LEFT = 'Since datetime';
        OPTIONS.DIALOG_DATE_PLACEHOLDER_RIGHT = 'Until datetime';
        OPTIONS.DIALOG_DUPLICATE_WARNING = 'Close the download dialog and reopen it';
        
        OPTIONS.MENTIONS_DOWNLOAD_BUTTON_TEXT_LONG = 'Mentions ⇩';
        OPTIONS.MENTIONS_DOWNLOAD_BUTTON_HELP_LONG = 'Download images/videos of mentions from Notifications-timeline';
        
        OPTIONS.BOOKMARKS_DOWNLOAD_BUTTON_HELP_LONG = 'Download images/videos of mentions from Bookmarks-timeline';
        break;
}


// }


// ■ 関数 {
function to_array( array_like_object ) {
    return Array.prototype.slice.call( array_like_object );
} // end of to_array()


if ( typeof console.log.apply == 'undefined' ) {
    // MS-Edge 拡張機能では console.log.apply 等が undefined
    // → apply できるようにパッチをあてる
    // ※参考：[javascript - console.log.apply not working in IE9 - Stack Overflow](https://stackoverflow.com/questions/5538972/console-log-apply-not-working-in-ie9)
    
    [ 'log', 'info', 'warn', 'error', 'assert', 'dir', 'clear', 'profile', 'profileEnd' ].forEach( function ( method ) {
        console[ method ] = this.bind( console[ method ], console );
    }, Function.prototype.call );
    
    console.log( 'note: console.log.apply is undefined => patched' );
}


function log_debug() {
    if ( ! DEBUG ) {
        return;
    }
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.log.apply( console, arg_list.concat( to_array( arguments ) ) );
} // end of log_debug()


function log_info() {
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.info.apply( console, arg_list.concat( to_array( arguments ) ) );
} // end of log_info()


function log_error() {
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.error.apply( console, arg_list.concat( to_array( arguments ) ) );
} // end of log_error()


var object_extender = ( function () {
    // 参考: [newを封印して、JavaScriptでオブジェクト指向する(1): Architect Note](http://blog.tojiru.net/article/199670885.html?seesaa_related=related_article)
    function object_extender( base_object ) {
        var template = object_extender.template,
            mixin_object_list = Array.prototype.slice.call( arguments, 1 ),
            expanded_object;
        
        template.prototype = base_object;
        
        expanded_object = new template();
        
        mixin_object_list.forEach( function ( object ) {
            Object.keys( object ).forEach( function ( name ) {
                expanded_object[ name ] = object[ name ];
            } );
        } );
        
        return expanded_object;
    } // end of object_extender()
    
    
    object_extender.template = function () {};
    
    return object_extender;
} )(); // end of object_extender()


// 参考: [複数のクラス名の存在を確認（判定） | jQuery逆引き | Webサイト制作支援 | ShanaBrian Website](http://shanabrian.com/web/jquery/has-classes.php)
$.fn.hasClasses = function( selector, or_flag ) {
    var self = this,
        class_names,
        counter = 0;
    
    if ( typeof selector === 'string' ) {
        selector = selector.trim();
        class_names = ( selector.match( /^\./ ) ) ? selector.replace( /^\./, '' ).split( '.' ) : selector.split( ' ' );
    }
    else {
        class_names = selector;
    }
    class_names.forEach( function( class_name ) {
        if ( self.hasClass( class_name ) ) {
            counter ++;
        }
    } );
    
    if ( or_flag && 0 < counter ) {
        return true;
    }
    if ( counter === class_names.length ) {
        return true;
    }
    return false;
}; // end of $.fn.hasClasses()


// 参考: [日付フォーマットなど 日付系処理 - Qiita](http://qiita.com/osakanafish/items/c64fe8a34e7221e811d0)
function format_date( date, format, flag_utc ) {
    if ( ! format ) {
        format = 'YYYY-MM-DD hh:mm:ss.SSS';
    }
    
    var msec = ( '00' + ( ( flag_utc ) ? date.getUTCMilliseconds() : date.getMilliseconds() ) ).slice( -3 ),
        msec_index = 0;
    
    if ( flag_utc ) {
        format = format
            .replace( /YYYY/g, date.getUTCFullYear() )
            .replace( /MM/g, ( '0' + ( 1 + date.getUTCMonth() ) ).slice( -2 ) )
            .replace( /DD/g, ( '0' + date.getUTCDate() ).slice( -2 ) )
            .replace( /hh/g, ( '0' + date.getUTCHours() ).slice( -2 ) )
            .replace( /mm/g, ( '0' + date.getUTCMinutes() ).slice( -2 ) )
            .replace( /ss/g, ( '0' + date.getUTCSeconds() ).slice( -2 ) )
            .replace( /S/g, function ( all ) {
                return msec.charAt( msec_index ++ );
            } );
    }
    else {
        format = format
            .replace( /YYYY/g, date.getFullYear() )
            .replace( /MM/g, ( '0' + ( 1 + date.getMonth() ) ).slice( -2 ) )
            .replace( /DD/g, ( '0' + date.getDate() ).slice( -2 ) )
            .replace( /hh/g, ( '0' + date.getHours() ).slice( -2 ) )
            .replace( /mm/g, ( '0' + date.getMinutes() ).slice( -2 ) )
            .replace( /ss/g, ( '0' + date.getSeconds() ).slice( -2 ) )
            .replace( /S/g, function ( all ) {
                return msec.charAt( msec_index ++ );
            } );
    }
    
    return format;
} // end of format_date()


// Twitter のツイートID は 64 ビットで、以下のような構成をとっている
//   [63:63]( 1) 0(固定)
//   [62:22](41) timestamp: 現在の Unix Time(ms) から、1288834974657(ms) (2010/11/04 01:42:54 UTC) を引いたもの
//   [21:12](10) machine id: 生成器に割り当てられたID。datacenter id + worker id
//   [11: 0](12) 生成器ごとに採番するsequence番号
//
// 参考:[Twitterのsnowflakeについて](https://www.slideshare.net/moaikids/20130901-snowflake)
//      [ツイートID生成とツイッターリアルタイム検索システムの話](https://www.slideshare.net/pfi/id-15755280)
function tweet_id_to_date( tweet_id ) {
    var bignum_tweet_id = new Decimal( tweet_id );
    
    if ( bignum_tweet_id.cmp( '300000000000000' ) < 0 ) {
        // ツイートID仕様の切替(2010/11/04 22時 UTC頃)以前のものは未サポート
        return null;
    }
    return new Date( parseInt( bignum_tweet_id.div( Decimal.pow( 2, 22 ) ).floor().add( 1288834974657 ), 10 ) );
} // end of tweet_id_to_date()


function datetime_to_tweet_id( datetime ) {
    try {
        var date = new Date( datetime ),
            utc_ms = date.getTime();
        
        if ( isNaN( utc_ms ) ) {
            return null;
        }
        
        var tweet_timestamp = Decimal.sub( utc_ms, 1288834974657 );
        
        if ( tweet_timestamp.cmp( 0 ) < 0 ) {
            return null;
        }
        
        var bignum_tweet_id = tweet_timestamp.mul( Decimal.pow( 2, 22 ) );
        
        if ( bignum_tweet_id.cmp( '300000000000000' ) < 0 ) {
            // ツイートID仕様の切替(2010/11/04 22時 UTC頃)以前のものは未サポート
            return null;
        }
        return bignum_tweet_id.toString();
    }
    catch ( error ) {
        return null;
    }
} // end of datetime_to_tweet_id()


function like_id_to_date( like_id ) {
    var bignum_like_id = new Decimal( like_id );
    return new Date( parseInt( bignum_like_id.div( Decimal.pow( 2, 20 ) ).floor(), 10 ) );
} // end of like_id_to_date()


function datetime_to_like_id( datetime ) {
    try {
        var date = new Date( datetime ),
            utc_ms = date.getTime();
        
        if ( isNaN( utc_ms ) ) {
            return null;
        }
        
        var bignum_like_id = Decimal.mul( utc_ms, Decimal.pow( 2, 20 ) );
        
        return bignum_like_id.toString();
    }
    catch ( error ) {
        return null;
    }
} // end of datetime_to_like_id()


function bignum_cmp( tweet_id1, tweet_id2 ) {
    return new Decimal( tweet_id1 ).cmp( tweet_id2 );
} // end of bignum_cmp()


function get_url_info( url ) {
    var url_parts = url.split( '?' ),
        query_map = {},
        url_info = { base_url : url_parts[ 0 ], query_map : query_map };
    
    if ( url_parts.length < 2 ) {
        return url_info;
    }
    
    url_parts[ 1 ].split( '&' ).forEach( function ( query_part ) {
        var parts = query_part.split( '=' );
        
        query_map[ parts[ 0 ] ] = ( parts.length < 2 ) ? '' : parts[ 1 ];
    } );
    
    return url_info;
} // end of get_url_info()


function normalize_img_url( source_url ) {
    var url_info = get_url_info( source_url ),
        base_url = url_info.base_url,
        format = url_info.query_map.format,
        name = url_info.query_map.name;
    
    if ( ! format ) {
        return source_url;
    }
    
    return base_url + '.' + format + ( ( name ) ? ':' + name : '' );
} // end of normalize_img_url()


function get_img_url( img_url, kind, old_format ) {
    img_url = normalize_img_url( img_url );
    
    if ( old_format ) {
        if ( ! kind ) {
            kind = '';
        }
        else {
            if ( kind.search( ':' ) != 0 ) {
                kind = ':' + kind;
            }
        }
        img_url = img_url.replace( /:\w*$/, '' ) + kind;
    }
    else {
        if ( ! kind ) {
            kind = 'orig';
        }
        kind = kind.replace( /:/g, '' );
        
        if ( ! /:\w*$/.test( img_url ) ) {
            img_url += ':' + kind;
        }
        
        img_url = img_url.replace( /\.([^.]+):\w*$/, '' ) + '?format=' + RegExp.$1 + '&name=' + kind;
    }
    
    return img_url;
} // end of get_img_url()


function get_img_url_orig( img_url ) {
    if ( /^https?:\/\/ton\.twitter\.com\//.test( img_url ) ) {
        // DM の画像は :orig が付かないものが最大
        return get_img_url( img_url );
    }
    return get_img_url( img_url, 'orig' );
} // end of get_img_url_orig()


function get_img_extension( img_url, extension_list ) {
    img_url = normalize_img_url( img_url );
    
    var extension = '';
    
    extension_list = ( extension_list ) ? extension_list : [ 'png', 'jpg', 'gif' ];
    
    if ( img_url.match( new RegExp( '\.(' + extension_list.join('|') + ')' ) ) ) {
        extension = RegExp.$1;
    }
    return extension;
} // end of get_img_extension()


function is_video_url( url ) {
    return /\.mp4(?:$|\?)/.test( url );
} // end of is_video_url()


function get_video_extension( video_url ) {
    if ( ! is_video_url( video_url ) ) {
        return 'mp4';
    }
    return video_url.match( /\.([^.?]*)(?:$|\?)/ )[ 1 ];
} // end of get_video_extension()


function get_gif_video_url_from_playable_media( $target ) {
    var video_url = $target.find( 'video[src*="video.twimg.com/tweet_video/"]' ).attr( 'src' );
    
    if ( video_url && video_url.match( /\.mp4/ ) ) {
        return video_url;
    }
    
    // 動画GIFの背景画像 URL から MP4 の URL を割り出す
    // background-image:url('https://pbs.twimg.com/tweet_video_thumb/#VIDEO_ID#.jpg') => https://video.twimg.com/tweet_video/#VIDEO_ID#.mp4
    return GIF_VIDEO_URL_BASE.replace( '#VIDEO_ID#', $target.find( '.PlayableMedia-player' ).attr( 'style' ).match( /tweet_video_thumb\/([^.?]+)[.?]/ )[ 1 ] );
} // end of get_gif_video_url_from_playable_media()


var get_logined_screen_name = ( () => {
    var logined_screen_name = '';
    
    return () => {
        if ( logined_screen_name ) {
            // 一度アカウントが確定するとアカウント切替でページが変わるまでそのままの想定
            return logined_screen_name;
        }
        
        var screen_name,
            $user_link;
        
        ////$user_link = $( 'nav[role="navigation"] > a[role="link"]:has(img[src*="profile_images/"])' ); // 遅い→ :has() を未使用にすることで効果大
        //$user_link = $( 'nav[role="navigation"] > a[role="link"]' ).filter( function () {return ( 0 < $( this ).find( 'img[src*="profile_images/"]' ).length );} );
        //
        //screen_name = ( $user_link.attr( 'href' ) || '' ).replace( /^.*\//g, '' );
        screen_name = $('header[role="banner"] div[role="button"][data-testid="SideNav_AccountSwitcher_Button"] div[dir="ltr"]>span').text().trim().replace( /^@/, '' );
        
        if ( screen_name ) {
            logined_screen_name = screen_name;
        }
        
        return screen_name;
    };
} )(); // end of get_logined_screen_name()


var get_logined_user_id = () => {
    return ( $( 'aside[role="complementary"] > a[role="link"][href*="?user_id="]' ).attr( 'href' ) || '' ).replace( /^.*?\?user_id=(\d+)$/, '$1' );
};


function get_screen_name( url ) {
    if ( ! url ) {
        url = w.location.href;
    }
    
    if ( ! url.trim().match( /^https?:\/\/[^\/]+\/([^\/?#]+)/ ) ) {
        return null;
    }
    
    var screen_name = RegExp.$1;
    
    switch ( screen_name ) {
        case 'search' :
        case 'mentions' :
        case 'i' :
        case 'notifications' :
        case 'messages' :
            return null;
    }
    
    if ( screen_name.length < 2 ) {
        // ログイン時に『いいね』タイムラインは https://twitter.com/i/likes になってしまう
        screen_name = $( 'h2.ProfileHeaderCard-screenname span.username b.u-linkComplex-target' ).text().trim();
    }
    
    return screen_name;
} // end of get_screen_name()


function get_profile_container() {
    //return $( 'div[data-testid="primaryColumn"] > div > div > div:first h2[role="heading"] > div > div > div > span > span' );
    var $header = $( 'div[data-testid="primaryColumn"] h2[role="heading"]:first' );
    
    if ( $header.length < 1 ) {
        return $();
    }
    
    var $work = $header,
        $child = $work.children( 'div:first' );
    
    while ( 0 < $child.length ) {
        $work = $child;
        $child = $work.children( 'div:first' );
    }
    
    if ( ( $work.length < 1 ) || ( $work.get(0).tagName != 'DIV' ) ) {
        return $();
    }
    
    $child = $work.children( 'span:first' );
    
    while ( 0 < $child.length ) {
        $work = $child;
        if ( 1 < $work.children().length ) {
            // 絵文字が含まれていたりするとSPAN, IMGがchildrenとして並ぶ
            break;
        }
        $child = $work.children( 'span:first' );
    }
    
    if ( ( $work.length < 1 ) || ( $work.get(0).tagName != 'SPAN' ) ) {
        return $();
    }
    return $work;
} // end of get_profile_container()


function extract_text( $parent ) {
    var text = '';
    $( $parent ).contents().each( function () {
        switch ( this.nodeType ) {
            case Node.TEXT_NODE :
                text += this.textContent || '';
                break;
            case Node.ELEMENT_NODE:
                switch ( this.tagName ) {
                    case 'IMG' :
                        text += this.alt || ' ';
                        break;
                    case 'SPAN' :
                        text += extract_text( $( this ) );
                        break;
                }
                break;
        }
    } );
    return text;
} // end of extract_text()


function get_profile_name() {
    /*
    ////return $( 'div[data-testid="primaryColumn"] > div > div > div:first h2[role="heading"] > div[aria-haspopup="false"] span > span > span' ).text().trim();
    ////return $( 'div[data-testid="primaryColumn"] > div > div > div:first h2[role="heading"] > div[aria-haspopup="false"] span > span > span' ).get().reduce( ( previousValue, currentValue ) => {
    //return $( 'div[data-testid="primaryColumn"] > div > div > div:first h2[role="heading"] > div > div > div > span > span > span' ).get().reduce( ( previousValue, currentValue ) => {
    //    var $span = $( currentValue ),
    //        $span_img = $span.find( 'img' ),
    //        text = '';
    //    
    //    try {
    //        text = $span.text().trim() || ( ( 0 < $span_img.length ) ? $span_img.attr( 'alt' ).trim() : '' ); // 絵文字は text() では取れない→ img.alt から取得
    //    }
    //    catch ( error ) {
    //    }
    //    
    //    if ( ! text ) {
    //        text = ' ';
    //    }
    //    
    //    return previousValue + text;
    //}, '' );
    */
    return extract_text( get_profile_container() );
} // end of get_profile_name()


function get_tweet_id( url ) {
    if ( ! url ) {
        url = w.location.href;
    }
    
    url = url.trim();
    if ( /^\d+$/.test( url ) ) {
        return url;
    }
    
    url = url.trim();
    
    if ( url.match( /^https?:\/\/(?:mobile\.)?twitter\.com\/[^\/]+\/[^\/]+\/(\d+)(?:$|\/)/ ) ) {
        return RegExp.$1;
    }
    
    if ( url.match( /^\/[^\/]+\/status(?:es)?\/(\d+)(?:$|\/)/ ) ) {
        return RegExp.$1;
    }
    
    return null;
} // end of get_tweet_id()


function judge_profile_timeline( url ) {
    if ( ! url ) {
        url = w.location.href;
    }
    
    return ( !! get_screen_name( url ) ) && ( !! get_profile_name() );
} // end of judge_profile_timeline()


function judge_search_timeline( url ) {
    if ( ! url ) {
        url = w.location.href;
    }
    return /^\/(?:search|hashtag)/.test( new URL( url ).pathname );
} // end of judge_search_timeline()


function judge_notifications_timeline( url ) {
    if ( ! url ) {
        url = w.location.href;
    }
    
    return /^\/(?:notifications)(?:\/mentions|$)/.test( new URL( url ).pathname );
} // end of judge_notifications_timeline()


function judge_bookmarks_timeline( url ) {
    if ( ! url ) {
        url = w.location.href;
    }
    
    return /^\/i\/bookmarks/.test( new URL( url ).pathname );
} // end of judge_bookmarks_timeline()


function datetime_to_timestamp( datetime ) {
    return datetime.replace( /[\/:]/g, '' ).replace( / /g, '_' );
} // end of datetime_to_timestamp()


// TODO: zip.file() で date オプションを指定した際、ZIP のタイムスタンプがずれてしまう
// → 標準では UTC で保存される模様（https://stuk.github.io/jszip/CHANGES.html#v300-2016-04-13）
// → タイムゾーンに合わせて調整することで対処
function adjust_date_for_zip( date ) {
    // TODO: なぜかタイムスタンプに1秒前後の誤差が出てしまう
    // → ZIP の仕様上、タイムスタンプは2秒単位で丸められてしまう（拡張フィールドを使用しない場合）
    // 参考：[ZIP (ファイルフォーマット) - Wikipedia](https://ja.wikipedia.org/wiki/ZIP_(%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB%E3%83%95%E3%82%A9%E3%83%BC%E3%83%9E%E3%83%83%E3%83%88))
    return new Date( date.getTime() - date.getTimezoneOffset() * 60000 );
} // end of adjust_date_for_zip()


function download_url( filename, url ) {
    var download_button = d.createElement( 'a' );
    
    download_button.href = url;
    download_button.download = filename;
    
    document.documentElement.appendChild( download_button );
    
    download_button.click();
    
    download_button.parentNode.removeChild( download_button );
} // end of download_url()


function download_blob( filename, blob ) {
    var blob_url = URL.createObjectURL( blob );
    
    download_url( filename, blob_url );
} // end of download_blob()


function download_base64( filename, base64, mimetype ) {
    if ( ! mimetype ) {
        mimetype = 'application/octet-stream';
    }
    
    var data_url = 'data:' + mimetype + ';base64,' + base64;
    
    download_url( filename, data_url );
} // end of download_base64()


function string_to_arraybuffer( source_string ) {
    var charcode_list = [].map.call( source_string, function ( ch ) {
            return ch.charCodeAt( 0 );
        } ),
        arraybuffer = ( new Uint16Array( charcode_list ) ).buffer;
    
    return arraybuffer;
} // end of string_to_arraybuffer()


var fetch_url = ( function () {
    if ( IS_CHROME_EXTENSION || ( typeof GM_xmlhttpRequest != 'function' ) ) {
        return function ( url, options ) {
            var xhr = new XMLHttpRequest();
            
            xhr.open( 'GET', url, true );
            xhr.responseType = ( options.responseType ) ? ( options.responseType ) : 'arraybuffer';
            xhr.onload = function () {
                if ( xhr.readyState != 4 ) {
                    return;
                }
                if ( typeof options.onload == 'function' ) {
                    options.onload( xhr );
                }
                if ( typeof options.oncomplete == 'function' ) {
                    options.oncomplete( xhr );
                }
            };
            xhr.onerror = function () {
                if ( typeof options.onerror == 'function' ) {
                    options.onerror( xhr );
                }
                if ( typeof options.oncomplete == 'function' ) {
                    options.oncomplete( xhr );
                }
            };
            xhr.send();
        };
    }
    return function ( url, options ) {
        GM_xmlhttpRequest( {
            method : 'GET'
        ,   url : url
        ,   responseType : ( options.responseType ) ? ( options.responseType ) : 'arraybuffer'
        ,   onload : function ( response ) {
                if ( typeof options.onload == 'function' ) {
                    options.onload( response );
                }
                if ( typeof options.oncomplete == 'function' ) {
                    options.oncomplete( response );
                }
            }
        ,   onerror : function ( response ) {
                if ( typeof options.onerror == 'function' ) {
                    options.onerror( response );
                }
                if ( typeof options.oncomplete == 'function' ) {
                    options.oncomplete( response );
                }
            }
        } );
    };
} )();


var set_value = ( function () {
    if ( typeof GM_setValue != 'undefined' ) {
        return function ( name, value ) {
            return GM_setValue( name, value );
        };
    }
    return function ( name, value ) {
        return localStorage.setItem( name, value );
    };
} )(); // end of set_value()


var get_value = ( function () {
    if ( typeof GM_getValue != 'undefined' ) {
        return function ( name ) {
            var value = GM_getValue( name );
            
            // メモ： 値が存在しない場合、GM_getValue( name ) は undefined を返す
            return ( value === undefined ) ? null : value;
        };
    }
    return function ( name ) {
        // メモ： 値が存在しない場合、localStorage[ name ] は undefined を、localStorage.getItem( name ) は null を返す
        return localStorage.getItem( name );
    };
} )(); // end of get_value()


var set_values = ( function () {
    if ( typeof async_set_values == 'function' ) {
        return function ( name_value_map, callback ) {
            async_set_values( name_value_map )
            .then( function () {
                if ( typeof callback == 'function' ) {
                    callback();
                }
            } );
        };
    }
    
    return function ( name_value_map, callback ) {
        Object.keys( name_value_map ).forEach( function ( name ) {
            set_value( name, name_value_map[ name ] );
        } );
        
        if ( typeof callback == 'function' ) {
            callback();
        }
    };
} )(); // end of set_values()


var get_values = ( function () {
    if ( typeof async_get_values == 'function' ) {
        return function ( name_list, callback ) {
            async_get_values( name_list )
            .then( function ( name_value_map ) {
                callback( name_value_map );
            } );
        };
    }
    
    return function ( name_list, callback ) {
        var name_value_map = {};
        
        name_list.forEach( function ( name ) {
            name_value_map[ name ] = get_value( name );
        } );
        callback( name_value_map );
    };
} )(); // end of get_values()


function is_night_mode() {
    return ( getComputedStyle( d.body ).backgroundColor != 'rgb(255, 255, 255)' );
} // end of is_night_mode()


var [
    update_twitter_api_info,
    twitter_api_is_enabled,
    initialize_twitter_api,
    twitter_api_get_json,
    api2_get_tweet_info,
] = ( () => {
    var OAUTH_CONSUMER_KEY = 'kyxX7ZLs2D3efqDbpK8Mqnpnr',
        OAUTH_CONSUMER_SECRET = 'D85tY89jQoWWVH8oNjIg28PJfK4S2louq5NPxw8VzvlKBwSR0x',
        OAUTH_CALLBACK_URL = 'https://nazo.furyutei.work/oauth/',
        
        API_AUTHORIZATION_BEARER = 'AAAAAAAAAAAAAAAAAAAAAF7aAAAAAAAASCiRjWvh7R5wxaKkFp7MM%2BhYBqM%3DbQ0JPmjU9F6ZoMhDfI4uTNAaQuTDm2uO9x3WFVr2xBZ2nhjdP0',
        API2_AUTHORIZATION_BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        // ※ https://abs.twimg.com/responsive-web/web/main.<version>.js (例：https://abs.twimg.com/responsive-web/web/main.bd8d7749ae1a70054.js) 内で定義されている値
        // TODO: 継続して使えるかどうか不明→変更された場合の対応を要検討
        API2_CONVERSATION_BASE = 'https://api.twitter.com/2/timeline/conversation/#TWEETID#.json?include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&skip_status=1&cards_platform=Web-12&include_cards=1&include_composer_source=true&include_ext_alt_text=true&include_reply_count=1&tweet_mode=extended&include_entities=true&include_user_entities=true&include_ext_media_color=true&include_ext_media_availability=true&send_error_codes=true&count=20&ext=mediaStats%2ChighlightedLabel%2CcameraMoment',
        
        twitter_api_1st_call = true,
        
        twitter_api_info_map = {},
        
        get_csrf_token = () => {
            var csrf_token;
            
            try {
                csrf_token = document.cookie.match( /ct0=(.*?)(?:;|$)/ )[ 1 ];
            }
            catch ( error ) {
            }
            
            return csrf_token;
        }, // end of get_csrf_token()
        
        get_guest_token = () => {
            var guest_token;
            
            try {
                guest_token = document.cookie.match( /gt=(.*?)(?:;|$)/ )[ 1 ];
            }
            catch ( error ) {
            }
            
            return guest_token;
        }, // end of get_guest_token()
        
        get_language = () => {
            var language;
            
            try {
                language = document.cookie.match( /lang=(.*?)(?:;|$)/ )[ 1 ];
            }
            catch ( error ) {
                language = LANGUAGE;
            }
            
            return language;
        }, // end of get_language()
        
        get_twitter_api = ( screen_name ) => {
            if ( ! screen_name ) {
                screen_name = get_logined_screen_name();
            }
            
            return ( twitter_api_info_map[ screen_name ] || {} ).api;
        }, // end of get_twitter_api()
        
        update_twitter_api_info = ( () => {
            var api2_is_checked = false,
                
                update_api2_info = () => {
                    if ( api2_is_checked ) {
                        return;
                    }
                    
                    api2_is_checked = true;
                    
                    // API2 (api.twitter.com/2/) が有効かどうかをツイート（https://twitter.com/jack/status/20）を読みこんで確認
                    var target_tweet_id = 20;
                    
                    api2_get_tweet_info( target_tweet_id )
                    .done( ( json, textStatus, jqXHR ) => {
                        log_debug( 'API2 (api.twitter.com/2/) is available.' );
                    } )
                    .fail( ( jqXHR, textStatus, errorThrown ) => {
                        log_error( 'API2 (api.twitter.com/2/) is not available. (', jqXHR.statusText, ':', textStatus, ')' );
                        
                        get_csrf_token = () => false; // API2 無効化
                    } )
                    .always( () => {
                    } );
                };
            
            return ( screen_name ) => {
                update_api2_info();
                
                if ( typeof Twitter == 'undefined' ) {
                    return;
                }
                
                if ( ! screen_name ) {
                    screen_name = get_logined_screen_name();
                }
                
                if ( ( twitter_api_info_map[ screen_name ] || {} ).is_checked ) {
                    return;
                }
                
                var twitter_api_info = twitter_api_info_map[ screen_name ] = {
                        is_checked : true,
                        api : null,
                    };
                
                // OAuth 1.0a 用のキャッシュされたtokenが有効かを確認
                Twitter.initialize( {
                    consumer_key : OAUTH_CONSUMER_KEY,
                    consumer_secret : OAUTH_CONSUMER_SECRET,
                    screen_name : screen_name,
                    use_cache : true,
                    auto_reauth : false,
                } )
                .isAuthenticated()
                .done( ( api, result ) => {
                    twitter_api_info.api = api;
                    
                    var current_user = Twitter.getCurrentUser();
                    
                    log_debug( 'Specified screen_name: "' + screen_name + '" => User authentication (OAuth 1.0a) is enabled. (screen_name:' + current_user.screen_name + ', user_id:' + current_user.user_id + ')' );
                } )
                .fail( ( result ) => {
                    log_debug( 'Specified screen_name: "' + screen_name + '" => Invalid cached token (' + result + ')' );
                } )
                .always( function () {
                } );
            };
        } )(), // end of update_twitter_api_info()
        
        twitter_api_is_enabled = () => {
            return ( get_twitter_api() || get_csrf_token() );
        }, // end of twitter_api_is_enabled()
        
        initialize_twitter_api = () => {
            var $deferred = new $.Deferred(),
                $promise = $deferred.promise(),
                logined_screen_name = get_logined_screen_name(),
                
                finish = () => {
                    $deferred.resolve();
                };
            
            if ( ! twitter_api_1st_call ) {
                finish();
                return $promise;
            }
            
            twitter_api_1st_call = false;
            
            if ( typeof Twitter == 'undefined' ) {
                finish();
                return $promise;
            }
            
            if ( ( ! OPTIONS.ENABLE_VIDEO_DOWNLOAD ) || get_twitter_api( logined_screen_name ) ) {
                finish();
                return $promise;
            }
            
            // OAuth 1.0a 認証処理
            var popup_window_width = Math.floor( window.outerWidth * 0.8 ),
                popup_window_height = Math.floor( window.outerHeight * 0.5 ),
                popup_window_top = 0,
                popup_window_left = 0,
                
                popup_window_option = ( () => {
                    if ( ! OPTIONS.TWITTER_OAUTH_POPUP ) {
                        return null;
                    }
                    if ( popup_window_width < 1000 ) {
                        popup_window_width = 1000;
                    }
                    
                    if ( popup_window_height < 700 ) {
                        popup_window_height = 700;
                    }
                    
                    popup_window_top = Math.floor( window.screenY + ( window.outerHeight - popup_window_height ) / 8 );
                    popup_window_left = Math.floor( window.screenX + ( window.outerWidth - popup_window_width ) / 2 );
                    
                    return [
                        'width=' + popup_window_width,
                        'height=' + popup_window_height,
                        'top=' + popup_window_top,
                        'left=' + popup_window_left,
                        'toolbar=0,scrollbars=1,status=1,resizable=1,location=1,menuBar=0'
                    ];
                } )(),
                
                user_specified_window = window.open( ( TEMPORARY_PAGE_URL || new URL( '/home', d.baseURI ).href ), OAUTH_POPUP_WINDOW_NAME, popup_window_option ),
                // 非同期にウィンドウを開くと、ポップアップブロックが働いてしまうため、ユーザーアクションの直後に予めウィンドウを開いておく
                // ※ 第一引数(URL) を 'about:blank' にすると、Firefox では window.name が変更できない（『DOMException: "Permission denied to access property "name" on cross-origin object"』発生）
                
                wait_window_ready = ( callback ) => {
                    try {
                        user_specified_window.name = OAUTH_POPUP_WINDOW_NAME;
                        
                        log_debug( 'wait_window_ready(): OK' );
                        
                        callback();
                    }
                    catch ( error ) {
                        log_debug( 'wait_window_ready(): ', error );
                        
                        // Firefox の場合、開いた直後には window.name が変更できない場合がある→変更可能になるまで待つ
                        setTimeout( () => {
                            wait_window_ready( callback );
                        }, 100 );
                    }
                };
            
            wait_window_ready( () => {
                Twitter.initialize( {
                    consumer_key : OAUTH_CONSUMER_KEY,
                    consumer_secret : OAUTH_CONSUMER_SECRET,
                    callback_url : OAUTH_CALLBACK_URL,
                    screen_name : logined_screen_name,
                    popup_window_name : OAUTH_POPUP_WINDOW_NAME,
                    use_cache : false,
                    auto_reauth : false,
                    user_specified_window : user_specified_window
                } )
                .authenticate()
                .done( ( api ) => {
                    api( 'account/verify_credentials', 'GET' )
                    .done( ( result ) => {
                        twitter_api_info_map[ logined_screen_name ] = {
                            is_checked : true,
                            api : api,
                        };
                        
                        var current_user = Twitter.getCurrentUser();
                        
                        log_debug( 'User authentication (OAuth 1.0a) is enabled. (screen_name:' + current_user.screen_name + ', user_id:' + current_user.user_id + ')' );
                        
                        finish();
                    } )
                    .fail( ( error ) => {
                        log_error( 'api( "account/verify_credentials" ) failure:', error );
                        
                        finish();
                    } );
                } )
                .fail( ( error ) => {
                    log_error( 'Twitter.authenticate() failure:', error );
                    
                    if ( ( ! /refused/i.test( error ) ) && confirm( 'Authorization failed. Retry ?' ) ) {
                        initialize_twitter_api()
                        .then( function () {
                            finish();
                        } );
                        return;
                    }
                    
                    finish();
                });
            } );
            
            return $promise;
        }, // end of initialize_twitter_api()
        
        twitter_api_delay = ( () => {
            var last_called_time_ms = new Date().getTime();
            
            return function ( min_wait_ms ) {
                if ( ! min_wait_ms ) {
                    min_wait_ms = OPTIONS.TWITTER_API2_DELAY_TIME_MS;
                }
                
                var $deferred = new $.Deferred(),
                    delay_time_ms = ( min_wait_ms ) ? ( last_called_time_ms + min_wait_ms - new Date().getTime() ) : 1;
                
                if ( delay_time_ms < 0 ) {
                    delay_time_ms = 1;
                }
                setTimeout( function () {
                    last_called_time_ms = new Date().getTime();
                    $deferred.resolve();
                }, delay_time_ms );
                
                return $deferred.promise();
            };
        } )(), // end of twitter_api_delay()
        
        api2_get_tweet_info = ( tweet_id ) => {
            var $deferred = new $.Deferred(),
                csrf_token = get_csrf_token(),
                api2_url = API2_CONVERSATION_BASE.replace( '#TWEETID#', tweet_id );
            
            if ( ! csrf_token ) {
                $deferred.reject( {
                    status : 0
                ,   statusText : 'Illegal condition'
                }, 'Invalid csrf token' );
                
                return $deferred.promise();
            }
            
            /*
            //var api_headers = {
            //        'Authorization' : 'Bearer ' + API2_AUTHORIZATION_BEARER
            //    ,   'x-csrf-token' : csrf_token
            //    ,   'x-twitter-active-user' : 'yes'
            //    ,   'x-twitter-auth-type' : 'OAuth2Session'
            //    ,   'x-twitter-client-language' : get_language()
            //    };
            */
            
            var create_api_headers = ( api_url ) => {
                    var headers = {
                            'Authorization' : 'Bearer ' + ( ( ( api_url || '' ).indexOf( '/2/' ) < 0 ) ? API_AUTHORIZATION_BEARER : API2_AUTHORIZATION_BEARER ),
                            'x-csrf-token' : csrf_token,
                            'x-twitter-active-user' : 'yes',
                            'x-twitter-auth-type' : 'OAuth2Session',
                            'x-twitter-client-language' : get_language(),
                        };
                    
                    if ( csrf_token.length == 32 ) {
                        var guest_token = get_guest_token();
                            
                        if ( guest_token ) {
                            headers[ 'x-guest-token' ] = guest_token;
                        }
                    }
                    return headers;
                };
            
            if (
                ( ! IS_CHROME_EXTENSION ) ||
                IS_FIREFOX
            ) {
                $.ajax( {
                    type : 'GET'
                ,   url : api2_url
                ,   headers : create_api_headers( api2_url )
                ,   dataType : 'json'
                ,   xhrFields : {
                        withCredentials : true
                    }
                } )
                .done( function ( json, textStatus, jqXHR ) {
                    log_debug( api2_url, json );
                    try {
                        $deferred.resolve( json.globalObjects.tweets[ tweet_id ] );
                    }
                    catch ( error ) {
                        $deferred.reject( jqXHR, error );
                    }
                } )
                .fail( function ( jqXHR, textStatus, errorThrown ) {
                    log_error( api2_url, textStatus, jqXHR.status + ' ' + jqXHR.statusText );
                    $deferred.reject( jqXHR, textStatus, errorThrown );
                } );
                
                return $deferred.promise();
            }
            
            /*
            // Chrome 拡張機能の場合 api.twitter.com を呼ぶと、
            // > Cross-Origin Read Blocking (CORB) blocked cross-origin response <url> with MIME type application/json. See https://www.chromestatus.com/feature/5629709824032768 for more details.
            // のような警告が出て、レスポンスボディが空になってしまう
            // 参考：
            //   [Changes to Cross-Origin Requests in Chrome Extension Content Scripts - The Chromium Projects](https://www.chromium.org/Home/chromium-security/extension-content-script-fetches)
            //   [Cross-Origin Read Blocking (CORB) とは - ASnoKaze blog](https://asnokaze.hatenablog.com/entry/2018/04/10/205717)
            */
            chrome.runtime.sendMessage( {
                type : 'FETCH_JSON',
                url : api2_url,
                options : {
                    method : 'GET',
                    headers : create_api_headers( api2_url ),
                    mode: 'cors',
                    credentials: 'include',
                },
            }, function ( response ) {
                log_debug( 'FETCH_JSON => response', response );
                
                if ( response.error ) {
                    $deferred.reject( { status : response.error, statusText : '' }, 'fetch error' );
                    return;
                }
                
                try {
                    $deferred.resolve( response.json.globalObjects.tweets[ tweet_id ] );
                    // TODO: シークレット(incognito)モードだと、{"errors":[{"code":353,"message":"This request requires a matching csrf cookie and header."}]} のように返されてしまう
                    // → manifest.json に『"incognito" : "split"』が必要だが、煩雑になる(Firefoxでは manifest.json 読み込み時にエラーとなる)ため、保留
                }
                catch ( error ) {
                    $deferred.reject( { status : 0, statusText : '' }, error );
                }
            } );
            
            return $deferred.promise();
        }, // end of api2_get_tweet_info()
        
        twitter_api_get_json = ( api_url, options ) => {
            if ( ! options ) {
                options = {};
            }
            
            var csrf_token = get_csrf_token(),
                tweet_id = ( function () {
                    var tweet_id;
                    
                    try {
                        tweet_id = ( api_url.match( /\/(\d+)\.json/ ) || api_url.match( /&id=(\d+)/ ) )[ 1 ];
                    }
                    catch ( error ) {
                    }
                    
                    return tweet_id;
                } )(),
                twitter_api = get_twitter_api(),
                min_wait_ms = ( twitter_api ) ? OPTIONS.TWITTER_API_DELAY_TIME_MS : OPTIONS.TWITTER_API2_DELAY_TIME_MS;
            
            return twitter_api_delay( min_wait_ms )
                .then( function () {
                    if ( twitter_api ) {
                        // API1.1 (OAuth 1.0a ユーザー認証) 使用
                        var parameters = {};
                        
                        /*
                        //if ( options.auto_reauth ) {
                        //    parameters.api_options = {
                        //        auto_reauth : options.auto_reauth
                        //    };
                        //}
                        // TODO: auto_reauth を有効にしていると認証ポップアップが非同期で表示されるのでポップアップブロックにひっかかる
                        // →保留
                        */
                        return twitter_api( api_url, 'GET', parameters );
                    }
                    else if ( csrf_token && tweet_id ) {
                        // API2 使用
                        return api2_get_tweet_info( tweet_id );
                    }
                    else {
                        return $.ajax( {
                            type : 'GET'
                        ,   url : api_url
                        ,   dataType : 'json'
                        } );
                    }
                } );
        }; // end of twitter_api_get_json()
    
    return [
        update_twitter_api_info,
        twitter_api_is_enabled,
        initialize_twitter_api,
        twitter_api_get_json,
        api2_get_tweet_info,
    ];
} )();



var Csv = {
    init : function () {
        var self = this;
        
        self.csv_rows = [];
        self.csv_content = null;
        
        return self;
    }, // end of init()
    
    
    push_row : function ( column_item_list ) {
        var self = this,
            csv_columns = [];
        
        column_item_list.forEach( function ( column_item ) {
            column_item = ( '' + column_item ).trim();
            
            if ( /^[\-+]?\d+\.?\d*(?:E[\-+]?\d+)?$/.test( column_item ) ) {
                csv_columns.push( column_item );
            }
            else {
                csv_columns.push( '"' + column_item.replace( /"/g, '""' ) + '"' );
            }
        } );
        
        self.csv_rows.push( csv_columns.join( ',' ) );
        
        return self;
    }, // end of push_row()
    
    
    create_csv_content : function () {
        var self = this,
            //csv = self.csv_rows.join( '\r\n' ),
            //bom = new Uint8Array( [ 0xEF, 0xBB, 0xBF ] ),
            //csv_content = self.csv_content = new Blob( [ bom, csv ], { 'type' : 'text/csv' } );
            csv_content = self.csv_content = '\ufeff' + self.csv_rows.join( '\r\n' );
        
        return self;
    }, // end of create_csv_content()
    
    
    get_csv_content : function () {
        var self = this;
        
        return self.csv_content;
    } // end of get_csv_content()
}; // end of Csv


function is_ziprequest_usable() {
    /*
    //var is_usable = ( ( OPTIONS.ENABLE_ZIPREQUEST ) && ( typeof ZipRequest == 'function' ) && ( ( ! IS_FIREFOX ) || ( ! OPTIONS.INCOGNITO_MODE ) ) );
    //    // TODO: Firefox はシークレットモードでは ZipRequest が使用できない（zip_request.generate()
    //
    //return is_usable;
    */
    // TODO: background 側の処理メモリを圧迫してしまったとしても、content_scripts 側では感知／タブを閉じて解放が出来ない
    // → 2020.08.12: 暫定的に ZipRequest は使用不可にして対応
    return false;
} // end of is_ziprequest_usable()


var download_media_timeline = ( function () {
    var TemplateMediaDownload = {
            downloading : false
        ,   stopping : false
        ,   closing : false
        
        ,   is_for_likes_timeline : false
        ,   is_for_notifications_timeline : false
        ,   is_for_bookmarks_timeline : false
        
        ,   cursor_to_continue : null // Like / Bookmarks タイムラインで継続する際の cursor
        
        ,   $container : null
        ,   $log : null
        ,   $since_id : null
        ,   $until_id : null
        ,   $limit_tweet_number : null
        ,   $button_start : null
        ,   $button_stop : null
        ,   $button_close : null
        
        ,   save_value : async function ( storage_key, storage_value ) {
                return await new Promise( ( resolve, reject ) => {
                    set_values( { [ storage_key ] : storage_value }, () => resolve() );
                } );
            } // end of save_value()
        
        ,   load_value : async function ( storage_key ) {
                return await new Promise( ( resolve, reject ) => {
                    get_values( [ storage_key ], ( storage_key_value_map ) => resolve( storage_key_value_map[ storage_key ] ) );
                } );
            } // end of load_value()
        
        ,   date_range_infos_storage_key : SCRIPT_NAME + '-date-range-info'
        
        ,   reset_date_range_infos : async function () {
                const
                    self = this,
                    storage_key = self.date_range_infos_storage_key;
                
                await self.save_value( storage_key, '{}' );
            } // end of reset_date_range_infos()
        
        ,   save_date_range_info : async function( date_range_info ) {
                const
                    self = this,
                    storage_key = self.date_range_infos_storage_key;
                
                let storage_value = await self.load_value( storage_key ),
                    all_data = ( () => {
                        try {
                            return JSON.parse( storage_value || '{}' );
                        }
                        catch ( error ) {
                            return {};
                        }
                    } )(),
                    target_screen_name = ( () => {
                        switch ( self.timeline_type ) {
                            case TIMELINE_TYPE.notifications :
                            case TIMELINE_TYPE.bookmarks :
                                return self.logined_screen_name;
                            default:
                                return self.screen_name;
                        }
                    } )(),
                    target_timeline_data = all_data[ self.timeline_type ] = all_data[ self.timeline_type ] || {};
                
                target_timeline_data[ target_screen_name ] = date_range_info;
                
                await self.save_value( storage_key, JSON.stringify( all_data ) );
            } // end of save_date_range_info()
        
        ,   load_date_range_info : async function () {
                const
                    self = this,
                    storage_key = self.date_range_infos_storage_key;
                
                let storage_value = await self.load_value( storage_key ),
                    date_range_info_map = ( () => {
                        try {
                            return JSON.parse( storage_value || '{}' )[ self.timeline_type ] || {};
                        }
                        catch ( error ) {
                            return {};
                        }
                    } )(),
                    target_screen_name = ( () => {
                        switch ( self.timeline_type ) {
                            case TIMELINE_TYPE.notifications :
                            case TIMELINE_TYPE.bookmarks :
                                return self.logined_screen_name;
                            default:
                                return self.screen_name;
                        }
                    } )(),
                    date_range_info = date_range_info_map[ target_screen_name ] || {};
                
                return date_range_info;
            } // end of load_date_range_info()
        
        ,   init : function () {
                var self = this;
                
                self.media_url_cache = {};
                
                return self;
            } // end of init()
        
        ,   init_container : function () {
                var self = this,
                    container_id = SCRIPT_NAME + '_container',
                    $container,
                    $dialog,
                    $toolbox,
                    $range_container,
                    $range_header,
                    $since_id,
                    $until_id,
                    $limit_tweet_number,
                    $since_date,
                    $until_date,
                    $button_container,
                    $button_start,
                    $button_stop,
                    $button_close,
                    $status_container,
                    $status_bar,
                    $checkbox_container,
                    $checkbox_image,
                    $checkbox_gif,
                    $checkbox_video,
                    $checkbox_nomedia,
                    $checkbox_include_retweets,
                    $checkbox_dry_run,
                    $log,
                    $log_mask;
                
                $( '#' + container_id ).remove();
                
                self.$checkbox_image = $checkbox_image = $( '<label><input type="checkbox" name="image">' + OPTIONS.CHECKBOX_IMAGE_TEXT + '</label>' )
                    .addClass( SCRIPT_NAME + '_checkbox_image' );
                $checkbox_image
                    .find( 'input' )
                    .prop( 'checked', support_image )
                    .change( function ( event ) {
                        var $input = $( this );
                        
                        event.stopPropagation();
                        event.preventDefault();
                        
                        support_image = $input.is( ':checked' );
                        set_values( {
                            [ SCRIPT_NAME + '_support_image' ] : ( support_image ) ? '1' : '0'
                        } );
                    } );
                
                self.$checkbox_gif = $checkbox_gif = $( '<label><input type="checkbox" name="gif">' + OPTIONS.CHECKBOX_GIF_TEXT + '</label>' )
                    .addClass( SCRIPT_NAME + '_checkbox_gif' );
                $checkbox_gif
                    .find( 'input' )
                    .prop( 'checked', support_gif )
                    .change( function ( event ) {
                        var $input = $( this );
                        
                        event.stopPropagation();
                        event.preventDefault();
                        
                        support_gif = $input.is( ':checked' );
                        set_values( {
                            [ SCRIPT_NAME + '_support_gif' ] : ( support_gif ) ? '1' : '0'
                        } );
                    } );
                
                self.$checkbox_video = $checkbox_video = $( '<label><input type="checkbox" name="video">' + OPTIONS.CHECKBOX_VIDEO_TEXT + '</label>' )
                    .addClass( SCRIPT_NAME + '_checkbox_video' );
                $checkbox_video
                    .find( 'input' )
                    .prop( 'checked', support_video )
                    .change( function ( event ) {
                        var $input = $( this );
                        
                        event.stopPropagation();
                        event.preventDefault();
                        
                        support_video = $input.is( ':checked' );
                        set_values( {
                            [ SCRIPT_NAME + '_support_video' ] : ( support_video ) ? '1' : '0'
                        } );
                    } );
                
                self.$checkbox_nomedia = $checkbox_nomedia = $( '<label><input type="checkbox" name="image">' + OPTIONS.CHECKBOX_NOMEDIA_TEXT + '</label>' )
                    .addClass( SCRIPT_NAME + '_checkbox_nomedia' );
                $checkbox_nomedia
                    .find( 'input' )
                    .prop( 'checked', support_nomedia )
                    .change( function ( event ) {
                        var $input = $( this );
                        
                        event.stopPropagation();
                        event.preventDefault();
                        
                        support_nomedia = $input.is( ':checked' );
                        set_values( {
                            [ SCRIPT_NAME + '_support_nomedia' ] : ( support_nomedia ) ? '1' : '0'
                        } );
                    } );
                
                self.$checkbox_include_retweets = $checkbox_include_retweets = $( '<label>(<input type="checkbox" name="include_retweets">' + OPTIONS.CHECKBOX_INCLUDE_RETWEETS + ')</label>' )
                    .addClass( SCRIPT_NAME + '_checkbox_include_retweets' );
                $checkbox_include_retweets
                    .find( 'input' )
                    .prop( 'checked', include_retweets )
                    .change( function ( event ) {
                        var $input = $( this );
                        
                        event.stopPropagation();
                        event.preventDefault();
                        
                        include_retweets = $input.is( ':checked' );
                        set_values( {
                            [ SCRIPT_NAME + '_include_retweets' ] : ( include_retweets ) ? '1' : '0'
                        } );
                    } );
                
                self.$checkbox_dry_run = $checkbox_dry_run = $( '<label><input type="checkbox" name="dry_run">' + OPTIONS.CHECKBOX_DRY_RUN + '</label>' )
                    .addClass( SCRIPT_NAME + '_checkbox_dry_run' );
                $checkbox_dry_run
                    .find( 'input' )
                    .prop( 'checked', dry_run )
                    .css( {
                        'margin-left' : '8px',
                        'margin-bottom' : '8px'
                    } )
                    .change( function ( event ) {
                        var $input = $( this );
                        
                        event.stopPropagation();
                        event.preventDefault();
                        
                        dry_run = $input.is( ':checked' );
                        set_values( {
                            [ SCRIPT_NAME + '_dry_run' ] : ( dry_run ) ? '1' : '0'
                        } );
                    } );
                
                self.$button_start = $button_start = $( '<button />' )
                    .text( OPTIONS.DIALOG_BUTTON_START_TEXT )
                    .addClass( SCRIPT_NAME + '_button_start' )
                    .click( function ( event ) {
                        event.stopPropagation();
                        event.preventDefault();
                        
                        $button_start.blur();
                        
                        if ( $checkbox_container.find( 'input[type=checkbox][name!="include_retweets"]:enabled:checked' ).length <= 0 ) {
                            alert( OPTIONS.CHECKBOX_ALERT );
                            return;
                        }
                        self.on_start( event );
                    } );
                
                self.$button_stop = $button_stop = $( '<button />' )
                    .text( OPTIONS.DIALOG_BUTTON_STOP_TEXT )
                    .addClass( SCRIPT_NAME + '_button_stop' )
                    .click( function ( event ) {
                        event.stopPropagation();
                        event.preventDefault();
                        
                        $button_stop.blur();
                        
                        self.on_stop( event );
                    } );
                
                self.$button_close = $button_close = $( '<span />' )
                    .addClass( SCRIPT_NAME + '_button_close Icon Icon--close Icon--large' )
                    .attr( {
                        title : OPTIONS.DIALOG_BUTTON_CLOSE_TEXT
                    } )
                    .css( {
                        'float' : 'right'
                    ,   'cursor' : 'pointer'
                    } )
                    .click( function ( event ) {
                        event.stopPropagation();
                        event.preventDefault();
                        
                        self.on_close( event );
                    } );
                
                $button_close
                    .html( '&#215;' ) // ×
                    .css( {
                        'font-size' : '32px'
                    ,   'display' : 'inline-block'
                    ,   'position' : 'absolute'
                    ,   'top' : '0'
                    ,   'right' : '10px'
                    } );
                
                self.$container = $container = $( '<div />' )
                    .attr( {
                        id : container_id
                    } )
                    .css( {
                        'position' : 'fixed'
                    ,   'top' : 0
                    ,   'bottom' : 0
                    ,   'left' : 0
                    ,   'right' : 0
                    ,   'overflow' : 'auto'
                    ,   'zIndex' : 10000
                    //,   'background' : 'rgba( 0, 0, 0, 0.8 )'
                    } )
                    .click( function ( event ) {
                        if ( ( ! event.target ) || ( $( event.target ).attr( 'id' ) != container_id ) ) {
                            return;
                        }
                        
                        event.stopPropagation();
                        event.preventDefault();
                        
                        //self.on_close( event );
                        // ※誤ってダウンロード中にダイアログ外をクリックし閉じてしまうため、無効化
                    } );
                
                $dialog = $( '<div />' )
                    .addClass( SCRIPT_NAME + '_dialog' )
                    .attr( {
                    } )
                    .css( {
                        'position' : 'absolute'
                    ,   'top' : '50%'
                    ,   'left' : '50%'
                    //,   'background' : 'white'
                    ,   'width' : '640px'
                    ,   'height' : '480px'
                    ,   'margin' : '-240px 0 0 -320px'
                    ,   'border-radius' : '6px'
                    ,   'overflow' : 'hidden'
                    } );
                
                $toolbox = $( '<div />' )
                    .addClass( SCRIPT_NAME + '_toolbox' )
                    .attr( {
                    } )
                    .css( {
                        'position' : 'relative'
                    ,   'overflow' : 'hidden'
                    //,   'background' : 'lightblue'
                    ,   'height' : '30%'
                    } );
                
                $range_container = self.$range_container = $( [
                        '<div class="range_container">'
                    ,   '  <h3><span class="range_header_text"></span></h3>'
                    ,   '  <table><tbody>'
                    ,   '    <tr>'
                    ,   '      <td><input type="text" name="since_id" value="" class="tweet_id" /></td>'
                    ,   '      <td><span class="range_text"></span></td>'
                    ,   '      <td><input type="text" name="until_id" class="tweet_id" /></td>'
                    ,   '      <td><label class="limit"></label><input type="text" name="limit" class="tweet_number" /></td>'
                    ,   '    </tr>'
                    ,   '    <tr class="date-range">'
                    ,   '      <td class="date since-date"></td>'
                    ,   '      <td></td>'
                    ,   '      <td class="date until-date"></td>'
                    ,   '      <td></td>'
                    ,   '    </tr>'
                    ,   '  </tbody></table>'
                    ,   '</div>'
                    ].join( '\n' ) )
                    .attr( {
                    } )
                    .css( {
                    } );
                
                $range_header = $range_container.find( 'h3' )
                    .append( $button_close )
                    .attr( {
                    } )
                    .css( {
                        'margin' : '12px 16px 6px 16px'
                    //,   'color' : '#66757f'
                    ,   'font-size' : '14px'
                    } );
                
                $range_header.find( 'span.range_header_text' )
                    .text( OPTIONS.DIALOG_TWEET_ID_RANGE_HEADER );
                
                $range_container.find( 'table' )
                    .attr( {
                    } )
                    .css( {
                        'width' : '560px'
                    ,   'margin' : '0 auto 0 auto'
                    ,   'text-align' : 'center'
                    //,   'color' : '#14171a'
                    } );
                
                $range_container.find( 'span.range_text' )
                    .text( OPTIONS.DIALOG_TWEET_ID_RANGE_MARK )
                    .attr( {
                    } )
                    .css( {
                        'margin-left' : '8px'
                    ,   'margin-right' : '8px'
                    ,   'white-space': 'nowrap'
                    } )
                    .parent()
                    .css( {
                        'min-width' : '80px'
                    } );
                
                $range_container.find( 'input.tweet_id' )
                    .attr( {
                    } )
                    .css( {
                        'width' : '160px'
                    //,   'color' : '#14171a'
                    //,   'background' : 'white'
                    //,   'border-color' : '#e6ecf0'
                    } )
                    .parent()
                    .css( {
                        'width' : '160px'
                    } );
                
                $range_container.find( 'label.limit' )
                    .text( OPTIONS.DIALOG_LIMIT_TWEET_NUMBER_TEXT )
                    .attr( {
                    } )
                    .css( {
                        'margin-left' : '8px'
                    ,   'margin-right' : '8px'
                    } )
                    .parent()
                    .css( {
                        'width' : '160px'
                    ,   'text-align' : 'right'
                    } );
                
                $range_container.find( 'input.tweet_number' )
                    .attr( {
                    } )
                    .css( {
                        'width' : '48px'
                    //,   'color' : '#14171a'
                    //,   'background' : 'white'
                    //,   'border-color' : '#e6ecf0'
                    } );
                
                $range_container.find( 'tr.date-range' )
                    .attr( {
                    } )
                    .css( {
                        'height' : '20px'
                    } );
                
                self.$since_id = $since_id = $range_container.find( 'input[name="since_id"]' );
                self.$until_id = $until_id = $range_container.find( 'input[name="until_id"]' );
                self.$since_date = $since_date = $range_container.find( 'tr.date-range td.since-date' );
                self.$until_date = $until_date = $range_container.find( 'tr.date-range td.until-date' );
                
                
                function get_reg_time_string( time_string )  {
                    if ( time_string.match( /^(\d{4})(\d{2})(\d{2})[_\-](\d{2})(\d{2})(\d{2})$/ ) ) {
                        time_string = RegExp.$1 + '/' + RegExp.$2 + '/' + RegExp.$3 + ' ' + RegExp.$4 + ':' + RegExp.$5 + ':' + RegExp.$6;
                    }
                    return time_string;
                } // end of get_reg_time_string()
                
                
                function set_change_event( $target_id, $target_date ) {
                    $target_id.change( function ( event ) {
                        var val = $target_id.val().trim(),
                            tweet_id = '',
                            date = null,
                            date_string = '';
                        
                        if ( self.is_for_likes_timeline || self.is_for_notifications_timeline || self.is_for_bookmarks_timeline ) {
                            val = get_reg_time_string( val );
                            
                            date = new Date( val );
                            
                            if ( isNaN( date.getTime() ) ) {
                                $target_id.val( '' );
                                $target_date.text( '' );
                                return;
                            }
                            
                            date_string = format_date( date, 'YYYY/MM/DD hh:mm:ss' );
                            
                            $target_id.val( date_string );
                            $target_date.text( date_string ).hide();
                        }
                        else {
                            tweet_id = get_tweet_id( val );
                            
                            if ( ! tweet_id ) {
                                val = get_reg_time_string( val );
                                tweet_id = datetime_to_tweet_id( val );
                            }
                            if ( ! tweet_id ) {
                                $target_id.val( '' );
                                $target_date.text( '' );
                                return;
                            }
                            date = tweet_id_to_date( tweet_id );
                            $target_id.val( tweet_id );
                            $target_date.text( ( date ) ? format_date( date, 'YYYY/MM/DD hh:mm:ss' ) : '' ).show();
                        }
                    } );
                } // end of set_change_event()
                
                
                set_change_event( $since_id, $since_date );
                set_change_event( $until_id, $until_date );
                
                self.$limit_tweet_number = $limit_tweet_number = $range_container.find( 'input[name="limit"]' );
                $limit_tweet_number
                    .val( limit_tweet_number )
                    .change( function ( event ) {
                        var val = $limit_tweet_number.val().trim();
                        
                        if ( ! val ) {
                            val = 0;
                        }
                        else if ( isNaN( val ) ) {
                            val = OPTIONS.OPTIONS.DEFAULT_LIMIT_TWEET_NUMBER;
                        }
                        limit_tweet_number = parseInt( val, 10 );
                        set_values( {
                            [ SCRIPT_NAME + '_limit_tweet_number' ] : String( limit_tweet_number )
                        } );
                        $limit_tweet_number.val( limit_tweet_number );
                    } );
                
                self.$checkbox_container = $checkbox_container = $( '<div />' )
                    .addClass( SCRIPT_NAME + '_checkbox_container' )
                    .attr( {
                    } )
                    .css( {
                        'position' : 'absolute'
                    ,   'left' : '32px'
                    ,   'bottom' : '12px'
                    ,   'width' : '480px'
                    ,   'text-align' : 'left'
                    } );
                
                self.$button_container = $button_container = $( '<div />' )
                    .addClass( SCRIPT_NAME + '_button_container' )
                    .attr( {
                    } )
                    .css( {
                        'position' : 'absolute'
                    ,   'right' : '8px'
                    ,   'bottom' : '8px'
                    } );
                
                self.$status_container = $status_container = $( '<div />' )
                    .addClass( SCRIPT_NAME + '_status' )
                    .attr( {
                    } )
                    .css( {
                        'position' : 'relative'
                    ,   'width' : '100%'
                    //,   'height' : '70%'
                    ,   'height' : '65%'
                    //,   'background' : 'ghostwhite'
                    } );
                
                self.$status_bar = $status_bar = $( '<div />' )
                    .addClass( SCRIPT_NAME + '_status_bar' )
                    .attr( {
                    } )
                    .css( {
                        'position' : 'relative'
                    ,   'width' : '100%'
                    ,   'height' : '5%'
                    } );
                
                self.$log = $log = $( '<div />' )
                    .addClass( SCRIPT_NAME + '_log' )
                    .attr( {
                        readonly : 'readonly'
                    } )
                    .css( {
                        'position' : 'absolute'
                    ,   'top' : '50%'
                    ,   'left' : '50%'
                    ,   'transform' : 'translate(-50%, -50%)'
                    ,   'width' : '95%'
                    ,   'height' : '90%'
                    ,   'overflow' : 'scroll'
                    //,   'border' : 'inset ghostwhite 1px'
                    ,   'padding' : '4px 4px 4px 4px'
                    //,   'color' : '#14171a'
                    //,   'background' : 'snow'
                    } );
                
                self.$log_mask = $log_mask = $log.clone()
                    .removeClass( SCRIPT_NAME + '_log' )
                    .addClass( SCRIPT_NAME + '_log_mask' )
                    .css( {
                        'display' : 'none'
                    ,   'z-index' : '10001'
                    //,   'background' : 'rgba( 0, 0, 0, 0.8 )'
                    } );
                $log_mask
                    .append( '<div class="loading"><span class="spinner-bigger"></span></div>' )
                    .find( '.loading' )
                    .css( {
                        'position' : 'absolute'
                    ,   'top' : '50%'
                    ,   'left' : '50%'
                    ,   'transform' : 'translate(-50%, -50%)'
                    } );
                
                $log_mask.find( '.spinner-bigger' )
                    .append( $( '<img/>' ).attr( 'src', LOADING_IMAGE_URL ) );
                
                $checkbox_container
                    .append( $checkbox_image )
                    .append( $checkbox_gif )
                    .append( $checkbox_video )
                    .append( $checkbox_nomedia )
                    .append( $checkbox_include_retweets )
                    .append( $checkbox_dry_run ) // style 設定のため、一時的に append
                    .find( 'label' )
                    .css( {
                        'display' : 'inline-block'
                    ,   'width' : '100px'
                    ,   'margin-right' : '8px'
                    ,   'vertical-align' : 'middle'
                    ,   'text-align' : 'left'
                    //,   'color' : '#14171a'
                    ,   'font-size' : '12px'
                    } );
                $checkbox_container.find( 'input' )
                    .css( {
                        'margin-right' : '4px'
                    ,   'vertical-align' : 'middle'
                    } );
                
                $button_container
                    .append( $checkbox_dry_run )
                    .append( $( '<br />' ) )
                    .append( $button_start )
                    .append( $button_stop )
                    .find( 'button' )
                    .addClass( 'btn' )
                    .css( {
                        'margin' : '0 8px'
                    } );
                
                $toolbox.append( $range_container );
                
                if ( true || twitter_api_is_enabled() ) {
                    $toolbox.append( $checkbox_container );
                }
                
                $toolbox.append( $button_container );
                
                $status_container
                    .append( $log )
                    .append( $log_mask );
                
                $dialog.append( $toolbox ).append( $status_container ).append( $status_bar );
                
                $container.append( $dialog );
                
                $container.appendTo( $( d.body ) );
                
                return self;
            } // end of init_container()
        
        ,   update_status_bar : function ( status_string ) {
                this.$status_bar.text( status_string );
                log_debug( 'update_status_bar():', status_string );
            } // end of update_status_bar()
        
        ,   clear_log : function ( log_string ) {
                var self = this,
                    $log = self.$log,
                    added_logline_is_hidden = self.added_logline_is_hidden = false;
                
                if ( ! $log ) {
                    return self;
                }
                
                $log.html( '' );
                
                return self;
            } // end of clear_log()
            
        ,   log : ( function () {
                var reg_char_to_escape = /[&'`"<>]/g,
                    reg_url =  /(https?:\/\/[\w\/:%#$&?\(\)~.=+\-;]+)/g,
                    reg_tweet_url = /\/\/twitter\.com/;
                
                function escape_html( match ) {
                    return {
                        '&' : '&amp;'
                    ,   "'" : '&#x27;'
                    ,   '`' : '&#x60;'
                    ,   '"' : '&quot;'
                    ,   '<' : '&lt;'
                    ,   '>' : '&gt;'
                    }[ match ];
                } // end of escape_html()
                
                 function get_link_html( all, url ) {
                    var class_link_type = ( reg_tweet_url.test( url ) ) ? 'tweet-link' : 'media-link';
                    
                    return '<a href="' + url + '" target="_blank" class="' + class_link_type + '">' + url + '</a>';
                } // end of get_link_html()
                    
                return function () {
                    var self = this,
                        $log = self.$log,
                        text = to_array( arguments ).join( ' ' ) + '\n',
                        
                        html = text.replace( reg_char_to_escape, escape_html ).replace( reg_url, get_link_html ),
                        $paragraph;
                    
                    if ( ! $log ) {
                        return self;
                    }
                    
                    $paragraph = $( '<pre />' )
                        .addClass( 'log-item' )
                        .html( html )
                        .css( {
                            'font-size' : '12px'
                        ,   'line-height' : '16px'
                        ,   'overflow': 'visible'
                        //,   'text-shadow' : '1px 1px 1px #ccc'
                        } );
                    
                    if ( self.added_logline_is_hidden ) {
                        $paragraph.hide();
                    }
                    
                    $log.append( $paragraph );
                    $log.scrollTop( $log.prop( 'scrollHeight' ) );
                    
                    return self;
                };
            } )() // end of log()
        
        ,   set_to_hide_added_logline : function () {
                var self = this;
                
                self.added_logline_is_hidden = true;
                
                self.$log_mask.show();
                
                return self;
            } // end of set_to_hide_added_logline()
        
        ,   set_to_show_added_logline : function () {
                var self = this,
                    $log = self.$log;
                
                $log.find( 'pre.log-item:hidden' ).show();
                setTimeout( function () {
                    $log.scrollTop( $log.prop( 'scrollHeight' ) );
                }, 1 );
                self.added_logline_is_hidden = false;
                
                self.$log_mask.hide();
                
                return self;
            } // end of set_to_show_added_logline()
        
        ,   log_hr : function () {
                var self = this;
                
                self.log( '--------------------------------------------------------------------------------' ); 
                
                return self;
            } // end of log_hr()
        
        ,   reset_flags : function () {
                var self = this;
                
                if ( ! self.$container ) {
                    return self;
                }
                
                self.downloading = false;
                self.stopping = false;
                self.closing = false;
                
                return self;
            } // end of reset_flags()
        
        ,   reset_buttons : function () {
                var self = this;
                
                if ( ! self.$container ) {
                    return self;
                }
                
                self.$button_start.prop( 'disabled', false );
                self.$button_stop.prop( 'disabled', true );
                self.$button_close.prop( 'disabled', false );
                self.$button_container.find( 'input[type=checkbox]' ).prop( 'disabled', false );
                self.$checkbox_container.find( 'input[type=checkbox]' ).prop( 'disabled', false );
                
                if ( OPTIONS.ENABLE_VIDEO_DOWNLOAD && twitter_api_is_enabled() ) {
                    self.$checkbox_video.css( 'color', '' ).find( 'input' ).prop( 'disabled', false );
                }
                else {
                    self.$checkbox_video.css( 'color', 'gray' ).find( 'input' ).prop( 'disabled', true );
                }
                
                if ( self.is_for_likes_timeline || self.is_for_notifications_timeline || self.is_for_bookmarks_timeline || judge_search_timeline() ) {
                    self.$checkbox_include_retweets.hide();
                }
                else {
                    self.$checkbox_include_retweets.show();
                }
                
                return self;
            } // end of reset_buttons()
        
        ,   show_container : async function ( options ) {
                if ( ! options ) {
                    options = {};
                }
                
                var self = this,
                    $container = self.$container,
                    $range_container,
                    $button_close,
                    is_for_likes_timeline = self.is_for_likes_timeline = !! options.is_for_likes_timeline,
                    is_for_notifications_timeline = self.is_for_notifications_timeline = !! options.is_for_notifications_timeline,
                    is_for_bookmarks_timeline = self.is_for_bookmarks_timeline = !! options.is_for_bookmarks_timeline,
                    timeline_type = self.timeline_type = options.timeline_type,
                    screen_name = self.screen_name = get_screen_name(),
                    logined_screen_name = self.logined_screen_name = get_logined_screen_name(),
                    cursor_to_continue = self.cursor_to_continue = null,
                    last_date_range_info = await self.load_date_range_info().catch( ( error ) => {
                        log_error( 'load_date_range_info() error:', error );
                        return {};
                    } );
                
                if ( ! $container ) {
                    self.init_container();
                    
                    $container = self.$container;
                }
                
                $range_container = self.$range_container;
                
                if ( is_for_likes_timeline || is_for_notifications_timeline || is_for_bookmarks_timeline ) {
                    let header_text = ( () => {
                            if ( is_for_likes_timeline ) return OPTIONS.DIALOG_DATE_RANGE_HEADER_LIKES;
                            if ( is_for_notifications_timeline ) return OPTIONS.DIALOG_DATE_RANGE_HEADER_NOTIFICATIONS;
                            if ( is_for_bookmarks_timeline ) return OPTIONS.DIALOG_DATE_RANGE_HEADER_BOOKMARKS;
                        } )();
                    
                    $range_container.find( 'input[name="since_id"]' ).attr( 'placeholder', OPTIONS.DIALOG_DATE_PLACEHOLDER_LEFT );
                    $range_container.find( 'input[name="until_id"]' ).attr( 'placeholder', OPTIONS.DIALOG_DATE_PLACEHOLDER_RIGHT );
                    $range_container.find( 'h3 > span.range_header_text' ).text( header_text );
                    $range_container.find( 'span.range_text' ).text( OPTIONS.DIALOG_DATE_RANGE_MARK );
                }
                else {
                    $range_container.find( 'input[name="since_id"]' ).attr( 'placeholder', OPTIONS.DIALOG_TWEET_ID_PLACEHOLDER_LEFT );
                    $range_container.find( 'input[name="until_id"]' ).attr( 'placeholder', OPTIONS.DIALOG_TWEET_ID_PLACEHOLDER_RIGHT );
                    $range_container.find( 'h3 > span.range_header_text' ).text( OPTIONS.DIALOG_TWEET_ID_RANGE_HEADER );
                    $range_container.find( 'span.range_text' ).text( OPTIONS.DIALOG_TWEET_ID_RANGE_MARK );
                }
                
                if ( is_night_mode() ) {
                    $container.addClass( 'night_mode' );
                }
                else {
                    $container.removeClass( 'night_mode' );
                }
                
                self.reset_flags();
                self.reset_buttons();
                
                self.$since_id.val( '' );
                self.$until_id.val( '' );
                self.$since_date.text( '' );
                self.$until_date.text( '' );
                self.clear_log();
                self.update_status_bar( '' );
                
                if ( last_date_range_info && ( ! judge_search_timeline() ) ) {
                    //let since_id_value = ( is_for_likes_timeline || is_for_notifications_timeline || is_for_bookmarks_timeline ) ? last_date_range_info.max_datetime : last_date_range_info.max_id;
                    let since_id_value = last_date_range_info.download_datetime;
                    
                    if ( since_id_value ) {
                        self.$since_id.val( since_id_value ).trigger( 'change', [ true ] );
                    }
                }
                
                self.saved_body_overflow = $( d.body ).get( 0 ).style.overflow;
                self.saved_body_overflow_x = $( d.body ).get( 0 ).style.overflowX;
                self.saved_body_overflow_y = $( d.body ).get( 0 ).style.overflowY;
                // ※ $( 'body' ).css( 'overflow' ) だと getComputedStyle() による値が取れてしまうため、element.style.* を取得したい場合には適さない
                
                $container.show();
                
                $( d.body )
                .on( 'keydown.dialog', function ( event ) {
                    if ( event.shiftKey || event.altKey || event.ctrlKey ) {
                        // [Shift], [Alt], [Ctrl] と併用する場合は何もしない
                        return;
                    }
                    
                    var key_code = event.keyCode;
                    
                    switch ( key_code ) {
                        case 27 :
                            self.$button_close.click();
                            
                            event.stopPropagation();
                            event.preventDefault();
                            break;
                    }
                } )
                .css( {
                    // ダイアログを出している間は body のスクロールをさせない
                    'overflow-x' : 'hidden',
                    'overflow-y' : 'hidden'
                } );
                
                return self;
            } // end of show_container()
        
        ,   hide_container : function () {
                var self = this,
                    $container = self.$container;
                
                if ( ! $container ) {
                    return self;
                }
                
                $( d.body )
                .css( {
                    'overflow' : self.saved_body_overflow,
                    'overflow-x' : self.saved_body_overflow_x,
                    'overflow-y' : self.saved_body_overflow_y
                } )
                .off( 'keydown.dialog' );
                
                $container.hide();
                
                return self;
            } // end of hide_container()
        
        
        ,   csv_push_row : function ( column_map ) {
                var self = this;
                
                if ( ! column_map ) {
                    column_map = {};
                }
                
                var column_item_list = [ 'tweet_date', 'action_date', 'profile_name', 'screen_name', 'tweet_url', 'media_type', 'media_url', 'media_filename', 'remarks', 'tweet_content', 'reply_number', 'retweet_number', 'like_number' ].map( function ( column_name ) {
                        return ( column_map[ column_name ] || ( typeof column_map[ column_name ] == 'number' ) ) ? column_map[ column_name ] : '';
                    } );
                
                self.csv.push_row( column_item_list );
                
                return self;
            } // end of csv_push_row()
            
        ,   start_download : async function () {
                var self = this;
                
                if ( self.downloading ) {
                    return self;
                }
                
                self.$since_id.trigger( 'change', [ true ] );
                self.$until_id.trigger( 'change', [ true ] );
                self.$limit_tweet_number.trigger( 'change', [ true ] );
                
                const
                    get_timestamp_ms = ( date_string ) => {
                        let timestamp_ms;
                        
                        try {
                            timestamp_ms = new Date( date_string ).getTime();
                            if ( isNaN( timestamp_ms ) ) {
                                timestamp_ms = null;
                            }
                        }
                        catch ( error ) {
                            timestamp_ms = null;
                        }
                        
                        return timestamp_ms;
                    };
                
                var is_search_timeline = self.is_search_timeline = judge_search_timeline(),
                    screen_name = self.screen_name = get_screen_name(),
                    logined_screen_name = self.logined_screen_name = get_logined_screen_name(),
                    user_info = await TWITTER_API.get_user_info( { screen_name : screen_name } ),
                    profile_name = ( user_info && user_info.name ) ? user_info.name : get_profile_name(),
                    since_id = self.$since_id.val().trim(),
                    until_id = self.$until_id.val().trim(),
                    max_tweet_id,
                    since_date = self.$since_date.text().trim(),
                    until_date = self.$until_date.text().trim(),
                    since_date_raw = since_date,
                    until_date_raw = until_date,
                    since_timestamp_ms = get_timestamp_ms( since_date_raw ),
                    until_timestamp_ms = get_timestamp_ms( until_date_raw ),
                    max_timestamp_ms,
                    max_id = '',
                    min_id = '',
                    max_datetime = '',
                    min_datetime = '',
                    download_datetime = self.download_datetime = format_date( new Date(), 'YYYY/MM/DD hh:mm:ss' ),
                    total_tweet_counter = 0,
                    total_media_counter = 0,
                    total_file_size = 0,
                    filter_info = {
                        image : support_image
                    ,   gif : support_gif
                    ,   video : support_video && OPTIONS.ENABLE_VIDEO_DOWNLOAD && twitter_api_is_enabled()
                    ,   nomedia : support_nomedia
                    ,   include_retweets : ( self.is_for_likes_timeline || self.is_for_notifications_timeline || self.is_for_bookmarks_timeline ) ? false : include_retweets
                    ,   dry_run : dry_run
                    ,   is_for_likes_timeline : self.is_for_likes_timeline
                    ,   is_for_notifications_timeline : self.is_for_notifications_timeline
                    ,   is_for_bookmarks_timeline : self.is_for_bookmarks_timeline
                    },
                    
                    timeline_type = self.timeline_type,
                    ClassTimeline = CLASS_TIMELINE_SET[ timeline_type ],
                    TimelineObject = self.TimelineObject = null,
                    specified_filter_info = {
                        use_media_filter : OPTIONS.ENABLE_FILTER,
                        image : filter_info.image,
                        gif : filter_info.gif,
                        video : filter_info.video,
                        nomedia : filter_info.nomedia,
                        include_retweets : filter_info.include_retweets,
                    },
                    
                    zip = null,
                    csv = self.csv = object_extender( Csv ).init(),
                    
                    fetched_tweet_counter = 0;
                
                if ( self.is_for_likes_timeline || self.is_for_notifications_timeline || self.is_for_bookmarks_timeline ) {
                    if ( since_id ) {
                        since_date = since_id;
                        //since_id = datetime_to_like_id( since_id );
                    }
                    if ( ! since_id ) {
                        since_id = '';
                        since_date = '<unspecified>';
                    }
                    
                    if ( until_id ) {
                        until_date = until_id;
                        //until_id = datetime_to_like_id( until_id );
                    }
                    if ( ! until_id ) {
                        until_id = '';
                        until_date = '<unspecified>';
                    }
                }
                else {
                    since_date = ( since_date ) ? '(' + since_date + ')' : '(unknown)';
                    until_date = ( until_date ) ? '(' + until_date + ')' : '(unknown)';
                }
                
                try {
                    max_tweet_id = until_id ? Decimal.sub( until_id, 1 ) : null;
                }
                catch ( error ) {
                    max_tweet_id = null;
                }
                try {
                    max_timestamp_ms = until_timestamp_ms ? until_timestamp_ms - 1 : null;
                }
                catch ( error ) {
                    max_timestamp_ms = null;
                }
                
                switch ( timeline_type ) {
                    case TIMELINE_TYPE.user : {
                            TimelineObject = new ClassTimeline( {
                                screen_name : screen_name,
                                max_tweet_id : max_tweet_id,
                                filter_info : specified_filter_info,
                            } );
                        }
                        break;
                    
                    case TIMELINE_TYPE.search : {
                            let specified_query = ( () => {
                                    const
                                        filter_follows_keyword = 'filter:follows',
                                        near_me_keyword = 'near:me';
                                    
                                    let url_info = get_url_info( w.location.href ),
                                        query_map = url_info.query_map,
                                        work_query = $( 'div[data-testid="primaryColumn"] form[role="search"] input[data-testid="SearchBox_Search_Input"]' ).val() ||
                                            decodeURIComponent( query_map[ 'q' ] || '' ),
                                        pf = query_map[ 'pf' ],
                                        lf = query_map[ 'lf' ];
                                    
                                    if ( ( pf == 'on' ) && ( work_query.indexOf( filter_follows_keyword ) < 0 ) ) {
                                        work_query += ' ' + filter_follows_keyword;
                                    }
                                    if ( ( lf == 'on' ) && ( work_query.indexOf( near_me_keyword ) < 0 ) ) {
                                        work_query += ' ' + near_me_keyword;
                                    }
                                    return work_query;
                                } )();
                            
                            TimelineObject = new ClassTimeline( {
                                specified_query :  specified_query,
                                max_tweet_id : max_tweet_id,
                                filter_info : specified_filter_info,
                            } );
                        }
                        break;
                    
                    case TIMELINE_TYPE.notifications : {
                            TimelineObject = new ClassTimeline( {
                                screen_name : logined_screen_name,
                                max_timestamp_ms : max_timestamp_ms,
                                filter_info : specified_filter_info,
                            } );
                        }
                        break;
                    
                    case TIMELINE_TYPE.likes : {
                            TimelineObject = new ClassTimeline( {
                                screen_name : screen_name,
                                max_timestamp_ms : max_timestamp_ms, // TODO: 実質意味がない（/2/timeline/favorites/<user_id> において、頭出しする方法が不明）
                                cursor : self.cursor_to_continue,
                            } );
                        }
                        break;
                    
                    case TIMELINE_TYPE.bookmarks : {
                            TimelineObject = new ClassTimeline( {
                                screen_name : logined_screen_name,
                                max_timestamp_ms : max_timestamp_ms, // TODO: 実質意味がない（/2/timeline/bookmark/<user_id> において、頭出しする方法が不明）
                                cursor : self.cursor_to_continue,
                            } );
                        }
                        break;
                    
                    default :
                        alert( 'Unsupported timeline !' );
                        return;
                }
                
                self.TimelineObject = TimelineObject;
                
                zip = new JSZip();
                
                self.log( 'Target URL :', w.location.href );
                self.csv_push_row( {
                    tweet_date : 'Target URL:',
                    action_date : w.location.href
                } );
                
                if ( TimelineObject.query_base ) {
                    self.log( 'Search Query :', TimelineObject.query_base );
                    self.csv_push_row( {
                        tweet_date : 'Search Query:',
                        action_date : TimelineObject.query_base,
                    } );
                }
                
                var line_prefix = '';
                
                if ( ! is_search_timeline ) {
                    line_prefix = '[@' + ( screen_name ? screen_name : logined_screen_name ) + '] ';
                    self.csv_push_row( {
                        tweet_date : ( () => {
                            if ( self.is_for_notifications_timeline ) return 'Mentions to';
                            if ( self.is_for_bookmarks_timeline ) return 'Bookmarked by';
                            return profile_name;
                        } )()
                    ,   action_date : '@' + ( screen_name ? screen_name : logined_screen_name )
                    } );
                }
                
                if ( self.is_for_likes_timeline || self.is_for_notifications_timeline || self.is_for_bookmarks_timeline ) {
                    let timeline_kind_string = self.is_for_likes_timeline ? 'Likes' : ( self.is_for_bookmarks_timeline ? 'Bookmarks' : 'Notifications' );
                    
                    self.log( line_prefix + '"' + timeline_kind_string + '" date-time range :', since_date, '-', until_date );
                    self.csv_push_row( {
                        tweet_date : '"' + timeline_kind_string + '" range:'
                    ,   action_date : since_date + ' ~ ' + until_date
                    } );
                }
                else {
                    self.log( line_prefix + 'Tweet range :', ( ( since_id ) ? since_id : '<unspecified>' ), since_date, '-', ( ( until_id ) ? until_id : '<unspecified>' ), until_date );
                    self.csv_push_row( {
                        tweet_date : 'Tweet range:'
                    ,   action_date : ( ( since_id ) ? since_id : '<unspecified>' ) + ' ' + since_date + ' ~ ' + ( ( until_id ) ? until_id : '<unspecified>' ) + ' ' + until_date
                    } );
                }
                
                var flag_strings = [
                        'Image : ' + ( filter_info.image ? 'on' : 'off' )
                    ,   'GIF : ' + ( filter_info.gif ? 'on' : 'off' )
                    ,   'Video : ' + ( filter_info.video ? 'on' : 'off' )
                    ,   'No media : ' + ( filter_info.nomedia ? 'on' : 'off' )
                    ],
                    flag_text = '';
                
                if ( is_search_timeline || self.is_for_likes_timeline || self.is_for_notifications_timeline || self.is_for_bookmarks_timeline ) {
                }
                else {
                    flag_strings.push( 'include RTs : ' + ( filter_info.include_retweets ? 'on' : 'off' ) );
                }
                
                flag_text = flag_strings.join( '  /  ' ) + ( ( dry_run ) ? '   ** DRY RUN **' : '' );
                
                self.log( flag_text );
                
                self.log( 'Search filters: ' + TimelineObject.filter_string );
                
                self.csv_push_row( {
                    tweet_date : flag_text
                } );
                
                self.csv_push_row( {
                    tweet_date : 'Tweet date',
                    action_date : 'Action date',
                    profile_name : 'Display name',
                    screen_name : 'Username',
                    tweet_url : 'Tweet URL',
                    media_type : 'Media type',
                    media_url : 'Media URL',
                    media_filename : 'Saved filename',
                    remarks : 'Remarks',
                    tweet_content : 'Tweet content',
                    reply_number : 'Replies',
                    retweet_number : 'Retweets',
                    like_number : 'Likes'
                } );
                
                self.log_hr();
                
                
                function close_dialog() {
                    zip = null;
                    TimelineObject = null;
                    
                    self.hide_container();
                } // end of close_dialog()
                
                
                function is_empty_result() {
                    return ( ( ! min_id ) || ( ! max_id ) || ( total_tweet_counter <= 0 ) || ( ( ! filter_info.nomedia ) && ( total_media_counter <= 0 ) ) );
                } // end of is_empty_result()
                
                
                function is_limited_by_tweet_number() {
                    return ( limit_tweet_number && ( limit_tweet_number <= total_tweet_counter ) );
                } // end of is_limited_by_tweet_number()
                
                
                function is_limited_by_file_size() {
                    return ( OPTIONS.DOWNLOAD_SIZE_LIMIT_MB && ( OPTIONS.DOWNLOAD_SIZE_LIMIT_MB * 1000000 <= total_file_size ) );
                } // end of is_limited_by_file_size()
                
                
                function is_limited_by_some_factor() {
                    return ( is_limited_by_tweet_number() || is_limited_by_file_size() );
                } // end of is_limited_by_some_factor()
                
                
                function clean_up( callback ) {
                    zip = null;
                    
                    self.reset_flags();
                    self.reset_buttons();
                    
                    if ( OPTIONS.AUTO_CONTINUE && TimelineObject && ( TimelineObject.timeline_status != TIMELINE_STATUS.error ) && is_limited_by_some_factor() && min_id ) {
                        //self.cursor_to_continue = TimelineObject.cursor;
                        self.cursor_to_continue = TimelineObject.last_cursor;
                    }
                    else {
                        self.cursor_to_continue = null;
                    }
                    
                    TimelineObject = null;
                    
                    if ( typeof callback == 'function' ) {
                        callback();
                        return;
                    }
                    
                    if ( OPTIONS.AUTO_CONTINUE && is_limited_by_some_factor() && min_id ) {
                        self.$button_start.click();
                    }
                } // end of clean_up()
                
                
                function request_save( callback ) {
                    async function _callback() {
                        if ( ( ! dry_run ) && ( ! until_date_raw ) ) {
                            await self.save_date_range_info( {
                                min_id : min_id,
                                max_id : max_id,
                                min_datetime : min_datetime,
                                max_datetime : max_datetime,
                                download_datetime : download_datetime,
                            } )
                            .catch( ( error )=> {
                                log_error( 'save_date_range_info() error:', error );
                            } );
                        }
                        
                        self.update_status_bar( ( is_empty_result() ? 'No applicable tweets found.' : 'Done.' ) + ( ( TimelineObject.timeline_status == TIMELINE_STATUS.error ) ? ' (timeline-error)' : '' ) );
                        
                        if ( typeof callback == 'function' ) {
                            callback();
                        }
                    }  // end of _callback()
                    
                    if ( is_empty_result() ) {
                        _callback();
                        return;
                    }
                    
                    var filename_head = ( self.is_search_timeline ) ?
                            ( 'search(' + format_date( new Date(), 'YYYYMMDD_hhmmss' ) + ')' ) :
                            ( ( self.is_for_notifications_timeline || self.is_for_bookmarks_timeline ) ? logined_screen_name : screen_name ),
                        filename_prefix;
                    
                    if ( self.is_for_likes_timeline ) {
                        filename_prefix = [
                            filename_head,
                            'likes',
                            datetime_to_timestamp( min_datetime ),
                            datetime_to_timestamp( max_datetime ),
                            ( ( dry_run ) ? 'dryrun' : 'media' ),
                        ].join( '-' );
                    }
                    else if ( self.is_for_notifications_timeline || self.is_for_bookmarks_timeline ) {
                        /*
                        //filename_prefix = [
                        //    'mentions-to'
                        //,   filename_head
                        //,   ( min_id + '(' + datetime_to_timestamp( min_datetime ) + ')' )
                        //,   ( max_id + '(' + datetime_to_timestamp( max_datetime ) + ')' )
                        //,   ( ( ( ! self.is_search_timeline ) && filter_info.include_retweets ) ? 'include_rts-' : '' ) + ( ( dry_run ) ? 'dryrun' : 'media' )
                        //].join( '-' );
                        */
                        filename_prefix = [
                            ( self.is_for_notifications_timeline ) ? 'mentions-to' : 'bookmarked-by',
                            filename_head,
                            datetime_to_timestamp( min_datetime ),
                            datetime_to_timestamp( max_datetime ),
                            ( ( dry_run ) ? 'dryrun' : 'media' ),
                        ].join( '-' );
                    }
                    else {
                        filename_prefix = [
                            filename_head,
                            ( min_id + '(' + datetime_to_timestamp( min_datetime ) + ')' ),
                            ( max_id + '(' + datetime_to_timestamp( max_datetime ) + ')' ),
                            ( ( ( ! self.is_search_timeline ) && filter_info.include_retweets ) ? 'include_rts-' : '' ) + ( ( dry_run ) ? 'dryrun' : 'media' ),
                        ].join( '-' );
                    }
                    
                    var log_text = self.$log.text(),
                        csv_content = self.csv.create_csv_content().get_csv_content(),
                        log_filename = filename_prefix + '.log',
                        csv_filename = filename_prefix + '.csv',
                        zip_filename = filename_prefix + '.zip',
                        zip_content_type = 'blob',
                        url_scheme = 'blob';
                    
                    total_file_size += string_to_arraybuffer( log_text ).byteLength;
                    total_file_size += string_to_arraybuffer( csv_content ).byteLength;
                    
                    if ( IS_FIREFOX && ( total_file_size < BASE64_BLOB_THRESHOLD ) ) {
                        zip_content_type =  'base64';
                        url_scheme = 'data';
                    }
                    log_debug( 'Total: ', total_file_size, 'byte' );
                    
                    if ( zip ) {
                        zip.file( log_filename, log_text, {
                            date : adjust_date_for_zip( new Date() )
                        } );
                        
                        zip.file( csv_filename, csv_content, {
                            date : adjust_date_for_zip( new Date() )
                        } );
                        
                        self.update_status_bar( 'Zipping ...' );
                        
                        zip.generateAsync( { type : zip_content_type } )
                        .then( function ( zip_content ) {
                            // TODO: ZIP を保存しようとすると、Firefox でセキュリティ警告が出る場合がある（「このファイルを開くのは危険です」(This file is not commonly downloaded.)）
                            // → Firefox のみ、Blob URL ではなく、Data URL(Base64) で様子見
                            if ( zip_content_type == 'base64' ) {
                                log_debug( 'Base64: ', zip_content.length, 'byte' );
                                download_base64( zip_filename, zip_content );
                            }
                            else {
                                download_blob( zip_filename, zip_content );
                            }
                            zip = null;
                            _callback();
                        } )
                        .catch( function ( error ) {
                            log_error( 'Error in zip.generateAsync()', error );
                            
                            alert( 'ZIP download failed !' );
                            
                            _callback();
                        } );
                    }
                    else {
                        log_error( 'zip was already removed' );
                        _callback();
                    }
                } // end of request_save()
                
                
                function stop_download( callback ) {
                    self.log_hr();
                    
                    self.set_to_hide_added_logline();
                    
                    if ( self.is_for_likes_timeline || self.is_for_notifications_timeline || self.is_for_bookmarks_timeline ) {
                        self.log( '[Stop]', min_datetime, '-', max_datetime, ' ( Tweet:', total_tweet_counter, '/ Media:', total_media_counter, ')' );
                    }
                    else {
                        self.log( '[Stop]', min_id, '-', max_id, ' ( Tweet:', total_tweet_counter, '/ Media:', total_media_counter, ')' );
                    }
                    
                    request_save( function () {
                        self.set_to_show_added_logline();
                        
                        if ( min_id ) {
                            //self.$until_id.val( ( self.is_for_likes_timeline || self.is_for_notifications_timeline || self.is_for_bookmarks_timeline ) ? min_datetime : min_id ).trigger( 'change', [ true ] );
                            if ( self.is_for_likes_timeline || self.is_for_notifications_timeline || self.is_for_bookmarks_timeline ) {
                                // TODO: Tweet ID と違い、時刻の場合は誤差が出る
                                // →最大1秒分の重複を許容
                                self.$until_id.val( format_date( new Date( new Date( min_datetime ).getTime() + 1000 ), 'YYYY/MM/DD hh:mm:ss' ) ).trigger( 'change', [ true ] );
                            }
                            else {
                                self.$until_id.val( min_id ).trigger( 'change', [ true ] );
                            }
                        }
                        
                        if ( typeof callback == 'function' ) {
                            callback();
                        }
                    } );
                    
                } // end of stop_download()
                
                
                function download_completed( callback ) {
                    self.log_hr();
                    
                    self.set_to_hide_added_logline();
                    
                    var is_limited = is_limited_by_some_factor(),
                        note = ( TimelineObject.timeline_status == TIMELINE_STATUS.error ) ? '(timeline-error)' : ( is_limited  ? '(limited)' : '' );
                    
                    if ( self.is_for_likes_timeline || self.is_for_notifications_timeline || self.is_for_bookmarks_timeline ) {
                        self.log( '[Complete' + note + ']', min_datetime, '-', max_datetime, ' ( Tweet:', total_tweet_counter, '/ Media:', total_media_counter, ')' );
                    }
                    else {
                        self.log( '[Complete' + note + ']', min_id, '-', max_id, ' ( Tweet:', total_tweet_counter, '/ Media:', total_media_counter, ')' );
                    }
                    
                    request_save( function () {
                        self.set_to_show_added_logline();
                        
                        if ( is_limited && min_id ) {
                            //self.$until_id.val( ( self.is_for_likes_timeline || self.is_for_notifications_timeline || self.is_for_bookmarks_timeline ) ? min_datetime : min_id ).trigger( 'change', [ true ] );
                            if ( self.is_for_likes_timeline || self.is_for_notifications_timeline || self.is_for_bookmarks_timeline ) {
                                // TODO: Tweet ID と違い、時刻の場合は誤差が出る
                                // →最大1秒分の重複を許容
                                self.$until_id.val( format_date( new Date( new Date( min_datetime ).getTime() + 1000 ), 'YYYY/MM/DD hh:mm:ss' ) ).trigger( 'change', [ true ] );
                            }
                            else {
                                self.$until_id.val( min_id ).trigger( 'change', [ true ] );
                            }
                        }
                        
                        if ( typeof callback == 'function' ) {
                            callback();
                        }
                    } );
                    
                } // end of download_completed()
                
                
                function is_close_dialog_requested() {
                    if ( ! self.closing ) {
                        return false;
                    }
                    
                    clean_up( function () {
                        close_dialog();
                    } );
                    
                    return true;
                } // end of is_close_dialog_requested()
                
                
                function is_stop_download_requested() {
                    if ( ! self.stopping ) {
                        return false;
                    }
                    
                    stop_download( function () {
                        clean_up();
                    } );
                    
                    return true;
                } // end of is_stop_download_requested()
                
                
                async function check_fetched_tweet_info( tweet_info ) {
                    if ( is_close_dialog_requested() || is_stop_download_requested() ) {
                        return;
                    }
                    
                    if ( ! tweet_info ) {
                        if ( TimelineObject.timeline_status == TIMELINE_STATUS.error ) {
                            self.log_hr();
                            try {
                                self.log( '(*) Timeline error:', TimelineObject.error_message );
                            }
                            catch ( error ) {
                                self.log( '(*) Timeline error: Unknown error' );
                            }
                        }
                        download_completed( () => clean_up() );
                        return;
                    }
                    
                    if ( is_limited_by_tweet_number() ) {
                        self.log_hr();
                        self.log( '(*) Total tweet number is over limit' );
                        
                        download_completed( () => clean_up() );
                        return;
                    }
                    
                    if ( is_limited_by_file_size() )  {
                        self.log_hr();
                        self.log( '(*) Total file size is over limit' );
                        
                        download_completed( () => clean_up() );
                        return;
                    }
                    
                    fetched_tweet_counter ++;
                    if ( dry_run ) {
                        self.update_status_bar( 'Searching ... ' + fetched_tweet_counter );
                    }
                    else {
                        self.update_status_bar( 'Searching ... ' + fetched_tweet_counter + '    (Size: ' + Math.floor( total_file_size / 1000000 ) + ' MiB / Limit: ' + OPTIONS.DOWNLOAD_SIZE_LIMIT_MB + ' MiB)' );
                    }
                    
                    let reacted_info = tweet_info.reacted_info,
                        target_tweet_info,
                        reaction_info,
                        comparison_id,
                        comparison_datetime,
                        comparison_timestamp_ms,
                        is_matched_tweet = true;
                    
                    if ( self.is_for_notifications_timeline ) {
                        target_tweet_info = tweet_info;
                        reaction_info = target_tweet_info;
                        comparison_id = target_tweet_info.id;
                        comparison_datetime = target_tweet_info.datetime;
                        comparison_timestamp_ms = target_tweet_info.timestamp_ms;
                        
                        if ( until_timestamp_ms && ( until_timestamp_ms <= comparison_timestamp_ms ) ) {
                            return await check_fetched_tweet_info( await TimelineObject.fetch_tweet_info() );
                        }
                        
                        if ( since_timestamp_ms && ( comparison_timestamp_ms <= since_timestamp_ms )  ) {
                            download_completed( () => clean_up() );
                            return;
                        }
                        
                        if ( target_tweet_info.screen_name == logined_screen_name ) {
                            return await check_fetched_tweet_info( await TimelineObject.fetch_tweet_info() );
                        }
                    }
                    else if ( self.is_for_likes_timeline || self.is_for_bookmarks_timeline ) {
                        if ( TimelineObject.timeline_type == TIMELINE_TYPE.likes_legacy ) {
                            // TODO: /1.1/favorites/list だと、いいねした時刻情報は取得できず、元ツイートのID/時刻しか利用できない
                            target_tweet_info =tweet_info;
                            reaction_info = null;
                            comparison_id = target_tweet_info.id;
                            comparison_datetime = target_tweet_info.datetime;
                            comparison_timestamp_ms = target_tweet_info.timestamp_ms;
                        }
                        else {
                            target_tweet_info = reacted_info;
                            reaction_info = tweet_info;
                            comparison_id = reaction_info.id;
                            comparison_datetime = reaction_info.datetime;
                            comparison_timestamp_ms = reaction_info.timestamp_ms;
                        }
                        
                        if ( until_timestamp_ms && ( until_timestamp_ms <= comparison_timestamp_ms ) ) {
                            return await check_fetched_tweet_info( await TimelineObject.fetch_tweet_info() );
                        }
                        
                        if ( since_timestamp_ms && ( comparison_timestamp_ms <= since_timestamp_ms )  ) {
                            download_completed( () => clean_up() );
                            return;
                        }
                    }
                    else {
                        target_tweet_info = ( reacted_info.id ) ? reacted_info : tweet_info;
                        reaction_info = ( reacted_info.id ) ? tweet_info : null;
                        comparison_id = ( reaction_info ) ? reaction_info.id : target_tweet_info.id;
                        comparison_datetime = ( reaction_info ) ? reaction_info.datetime : target_tweet_info.datetime;
                        comparison_timestamp_ms = ( reaction_info ) ? reaction_info.timestamp_ms : target_tweet_info.timestamp_ms;
                        
                        if ( until_id && ( bignum_cmp( until_id, comparison_id ) <= 0 ) ) {
                            return await check_fetched_tweet_info( await TimelineObject.fetch_tweet_info() );
                        }
                        
                        if ( since_id && ( bignum_cmp( comparison_id, since_id ) <= 0 ) ) {
                            download_completed( () => clean_up() );
                            return;
                        }
                    }
                    
                    if ( target_tweet_info.media_type == MEDIA_TYPE.nomedia ) {
                        // [Issue #54: Get video from tweets generated with Twitter for Advertisers tool](https://github.com/furyutei/twMediaDownloader/issues/54) への対応
                        await new Promise( ( resolve, reject ) => {
                            try {
                                let binding_values = target_tweet_info.tweet_status.card.binding_values,
                                    stream_url = ( binding_values.player_stream_url || binding_values.amplify_url_vmap ).string_value;
                                
                                if ( /\.mp4(?:\?|$)/.test( stream_url ) ) {
                                    target_tweet_info.media_type = MEDIA_TYPE.video;
                                    target_tweet_info.media_list = [ {
                                        media_type : MEDIA_TYPE.video,
                                        media_url : stream_url,
                                    } ];
                                    resolve();
                                    return;
                                }
                                
                                $.ajax( {
                                    type : 'GET',
                                    url : stream_url,
                                    dataType: 'xml',
                                } )
                                .done( ( xml, textStatus, jqXHR ) => {
                                    let video_url,
                                        max_bitrate = -1;
                                    
                                    $( xml ).find( 'tw\\:videoVariants > tw\\:videoVariant' ).each( function () {
                                        let $variant = $( this ),
                                            url = decodeURIComponent( $variant.attr( 'url' ) || '' ),
                                            content_type = $variant.attr( 'content_type' ),
                                            bit_rate = parseInt( $variant.attr( 'bit_rate' ), 10 );
                                        
                                        if ( ( content_type == 'video/mp4' ) && ( bit_rate ) && ( max_bitrate < bit_rate ) ) {
                                            video_url = url;
                                            max_bitrate = bit_rate;
                                        }
                                    } );
                                    
                                    if ( video_url ) {
                                        target_tweet_info.media_type = MEDIA_TYPE.video;
                                        target_tweet_info.media_list = [ {
                                            media_type : MEDIA_TYPE.video,
                                            media_url : video_url,
                                        } ];
                                    }
                                } )
                                .fail( function ( jqXHR, textStatus, errorThrown ) {
                                } )
                                .always( () => {
                                    resolve();
                                } );
                            }
                            catch ( error ) {
                                resolve();
                            }
                        } );
                    }
                    
                    switch ( target_tweet_info.media_type ) {
                        case MEDIA_TYPE.image :
                            if ( ! filter_info.image ) {
                                is_matched_tweet = false;
                            }
                            break;
                            
                        case MEDIA_TYPE.gif :
                            if ( ! filter_info.gif ) {
                                is_matched_tweet = false;
                            }
                            break;
                        
                        case MEDIA_TYPE.video :
                            if ( ! filter_info.video ) {
                                is_matched_tweet = false;
                            }
                            break;
                        
                        case MEDIA_TYPE.nomedia :
                            if ( ! filter_info.nomedia ) {
                                is_matched_tweet = false;
                            }
                            break;
                    }
                    
                    if ( is_matched_tweet ) {
                        switch ( reacted_info.type ) {
                            case REACTION_TYPE.retweet :
                                if ( ! filter_info.include_retweets ) {
                                    is_matched_tweet = false;
                                }
                                break;
                        }
                    }
                    
                    if ( ! is_matched_tweet ) {
                        return await check_fetched_tweet_info( await TimelineObject.fetch_tweet_info() );
                    }
                    
                    total_tweet_counter ++;
                    
                    switch ( reacted_info.type ) {
                        case REACTION_TYPE.retweet : {
                                self.log( total_tweet_counter + '.', reaction_info.datetime + '(R) <-', target_tweet_info.datetime, target_tweet_info.tweet_url );
                            }
                            break;
                        
                        case REACTION_TYPE.like : {
                                self.log( total_tweet_counter + '.', reaction_info.datetime + '(L) <-', target_tweet_info.datetime, target_tweet_info.tweet_url );
                            }
                            break;
                        
                        case REACTION_TYPE.bookmark : {
                                self.log( total_tweet_counter + '.', reaction_info.datetime + '(B) <-', target_tweet_info.datetime, target_tweet_info.tweet_url );
                            }
                            break;
                        
                        default :
                            self.log( total_tweet_counter + '.', target_tweet_info.datetime, target_tweet_info.tweet_url );
                            break;
                    }
                    
                    if ( ( ! max_id ) || ( bignum_cmp( max_id, comparison_id ) < 0 ) ) {
                        max_id = comparison_id;
                        max_datetime = comparison_datetime;
                    }
                    
                    if ( ( ! min_id ) || ( bignum_cmp( comparison_id, min_id ) < 0 ) ) {
                        min_id = comparison_id;
                        min_datetime = comparison_datetime;
                    }
                    
                    if ( 0 < target_tweet_info.media_list.length ) {
                        const
                            fetch_media = ( media_url ) => {
                                return new Promise( ( resolve, reject ) => {
                                    fetch_url( media_url, {
                                        responseType : 'arraybuffer',
                                        
                                        onload : ( response ) => {
                                            if ( response.status < 200 || 300 <= response.status ) {
                                                resolve( {
                                                    error : response.status + ' ' + response.statusText,
                                                    response,
                                                } );
                                                
                                                return;
                                            }
                                            
                                            resolve( {
                                                arraybuffer : response.response,
                                            } );
                                        },
                                        
                                        onerror : ( response ) => {
                                            resolve( {
                                                error : response.status + ' ' + response.statusText,
                                                response,
                                            } );
                                        } // end of onerror()
                                    } );
                                } );
                            };
                        
                        for ( let media_index = 0; media_index < target_tweet_info.media_list.length; media_index ++ ) {
                            let media = target_tweet_info.media_list[ media_index ],
                                media_url = media.media_url,
                                report_index = media_index + 1,
                                csv_media_type,
                                media_prefix,
                                media_extension;
                            
                            switch ( media.media_type ) {
                                case MEDIA_TYPE.image :
                                    csv_media_type = 'Image';
                                    media_prefix = 'img';
                                    media_extension = get_img_extension( media_url );
                                    break;
                                
                                case MEDIA_TYPE.gif :
                                    csv_media_type = 'GIF';
                                    media_prefix = 'gif';
                                    media_extension = get_video_extension( media_url );
                                    break;
                                
                                case MEDIA_TYPE.video :
                                    csv_media_type = 'Video';
                                    media_prefix = 'vid';
                                    media_extension = get_video_extension( media_url );
                                    break;
                                
                                default:
                                    log_error( '[bug] unknown error => ignored', media );
                                    continue;
                            }
                            
                            let timestamp = datetime_to_timestamp( target_tweet_info.datetime ),
                                media_filename = [ target_tweet_info.screen_name, target_tweet_info.id, timestamp, media_prefix + report_index ].join( '-' ) + '.' + media_extension,
                                download_error;
                            
                            if ( ! dry_run ) {
                                let media_result = await fetch_media( media_url );
                                
                                if ( ( media.media_type == MEDIA_TYPE.image ) && media_result.error ) {
                                    log_debug( 'before: media_url=', media_url );
                                    media_url = media_url.replace( /([?&]name=)orig/, '$1large' );
                                    log_debug( 'after : media_url=', media_url );
                                    media_result = await fetch_media( media_url );
                                }
                                
                                if ( media_result.error ) {
                                    download_error = media_result.error;
                                }
                                else {
                                    zip.file( media_filename, media_result.arraybuffer, {
                                        date : adjust_date_for_zip( target_tweet_info.date ),
                                    } );
                                    
                                    total_file_size += media_result.arraybuffer.byteLength;
                                    log_debug( media_url, '=>', media_result.arraybuffer.byteLength, 'byte / total: ', total_file_size , 'byte' );
                                    
                                    delete media_result.arraybuffer;
                                    media_result.arraybuffer = null;
                                }
                            }
                            
                            self.csv_push_row( {
                                tweet_date : target_tweet_info.datetime,
                                action_date : ( reaction_info ) ? reaction_info.datetime : '',
                                profile_name : target_tweet_info.user_name,
                                screen_name : '@' + target_tweet_info.screen_name,
                                tweet_url : target_tweet_info.tweet_url,
                                media_url : media_url,
                                media_type : csv_media_type,
                                media_filename : ( media_filename ) ? media_filename : '-',
                                remarks : download_error || '',
                                tweet_content : target_tweet_info.text,
                                reply_number : target_tweet_info.reply_count || '',
                                retweet_number : target_tweet_info.retweet_count || '',
                                like_number : target_tweet_info.like_count || '',
                            } );
                            
                            if ( download_error ) {
                                self.log( '  ' + media_prefix + report_index + '\x29', media_url, '=>', download_error );
                            }
                            else {
                                self.log( '  ' + media_prefix + report_index + '\x29', media_url );
                            }
                            
                            /*
                            //if ( ( OPTIONS.DOWNLOAD_SIZE_LIMIT_MB ) && ( OPTIONS.DOWNLOAD_SIZE_LIMIT_MB * 1000000 <= total_file_size ) ) {
                            //    self.log_hr();
                            //    self.log( 'Stop: Total file size is over limit' );
                            //    
                            //    self.$button_stop.click();
                            //    
                            //    if ( is_stop_download_requested() || is_close_dialog_requested() ) {
                            //        return;
                            //    }
                            //    else {
                            //        log_error( '[bug] unknown error' );
                            //    }
                            //}
                            */
                            
                            total_media_counter ++;
                        }
                    }
                    else {
                        self.csv_push_row( {
                            tweet_date : target_tweet_info.datetime,
                            action_date : ( reaction_info ) ? reaction_info.datetime : '',
                            profile_name : target_tweet_info.user_name,
                            screen_name : '@' + target_tweet_info.screen_name,
                            tweet_url : target_tweet_info.tweet_url,
                            media_url : '',
                            media_type : 'No media',
                            media_filename : '',
                            remarks : '',
                            tweet_content : target_tweet_info.text,
                            reply_number : target_tweet_info.reply_count || '',
                            retweet_number : target_tweet_info.retweet_count || '',
                            like_number : target_tweet_info.like_count || '',
                        } );
                        
                        self.log( '  (no media)' );
                    }
                    
                    return await check_fetched_tweet_info( await TimelineObject.fetch_tweet_info() );
                } // end of check_fetched_tweet_info()
                
                if ( self.is_for_likes_timeline || self.is_for_notifications_timeline || self.is_for_bookmarks_timeline ) {
                    if ( since_timestamp_ms && until_timestamp_ms && ( until_timestamp_ms <= since_timestamp_ms ) ) {
                        self.log( '[Error]', 'Wrong range' );
                        clean_up();
                        return self;
                    }
                }
                else {
                    if ( since_id && until_id && ( bignum_cmp( until_id, since_id ) <= 0 ) ) {
                        self.log( '[Error]', 'Wrong range' );
                        clean_up();
                        return self;
                    }
                }
                self.downloading = true;
                self.stopping = false;
                self.closing = false;
                
                fetched_tweet_counter = 0;
                self.update_status_bar( 'Searching ... ' );
                
                TimelineObject.fetch_tweet_info()
                .then( ( tweet_info ) => {
                    check_fetched_tweet_info( tweet_info );
                } )
                .catch( ( error ) => {
                    self.log( '[Error]', error );
                    check_fetched_tweet_info( null );
                } );
                
                return self;
            } // end of start_download()
        
        ,   on_start : function ( event ) {
                var self = this;
                
                self.clear_log();
                self.update_status_bar( '' );
                
                self.$button_start.prop( 'disabled', true );
                self.$button_stop.prop( 'disabled', false );
                self.$button_container.find( 'input[type=checkbox]' ).prop( 'disabled', true );
                self.$checkbox_container.find( 'input[type=checkbox]' ).prop( 'disabled', true );
                
                self.start_download();
                
                return self;
            } // end of on_start()
        
        ,   on_stop : function ( event ) {
                var self = this;
                
                self.$button_stop.prop( 'disabled', true );
                self.$button_container.find( 'input[type=checkbox]' ).prop( 'disabled', false );
                self.$checkbox_container.find( 'input[type=checkbox]' ).prop( 'disabled', false );
                
                if ( self.TimelineObject ) {
                    self.TimelineObject.stop();
                }
                
                self.stopping = true;
                
                return self;
            } // end of on_stop()
        
        ,   on_close : function ( event ) {
                var self = this;
                
                self.$button_start.prop( 'disabled', true );
                self.$button_stop.prop( 'disabled', true );
                self.$button_container.find( 'input[type=checkbox]' ).prop( 'disabled', true );
                self.$checkbox_container.find( 'input[type=checkbox]' ).prop( 'disabled', true );
                
                if ( self.downloading ) {
                    if ( self.TimelineObject ) {
                        self.TimelineObject.stop();
                    }
                    self.closing = true;
                    
                    return self;
                }
                
                self.hide_container();
                
                return self;
            } // end of on_close()
        
        },
        
        
        MediaDownload = object_extender( TemplateMediaDownload ).init();
    
    
    function download_media_timeline( options ) {
        if ( ! options ) {
            options = {};
        }
        
        /*
        // 2020.08.13: ユーザー認証が必要となる（twitter-oauth/twitter-api.js による）Twitter API 呼出は使用しないように変更
        //initialize_twitter_api()
        //.then( function () {
        //    MediaDownload.show_container( options );
        //} );
        */
        
        if ( MediaDownload.$container && MediaDownload.$container.is( ':visible' ) ) {
            // 重複起動禁止（オプションメニューから要求された場合の対策）
            alert( OPTIONS.DIALOG_DUPLICATE_WARNING );
            return;
        }
        MediaDownload.show_container( options );
    } // end of download_media_timeline()
    
    
    return download_media_timeline;
} )(); // end of download_media_timeline()


var check_timeline_headers = ( function () {
    var button_class_name = SCRIPT_NAME + '_download_button',
        button_container_class_name = SCRIPT_NAME + '_download_button_container',
        
        $button_template = $( '<a />' )
            .addClass( button_class_name )
            .addClass( 'js-tooltip' )
            .attr( {
                href : '#'
            ,   title : OPTIONS.DOWNLOAD_BUTTON_HELP_TEXT
            ,   'data-timeline-type' : TIMELINE_TYPE.unknown
            } )
            /*
            .css( {
                'font-size' : '16px'
            ,   'vertical-align' : 'middle'
            ,   'text-decoration' : 'underline'
            } )
            */
            .click( function ( event ) {
                var $button = $( this );
                
                event.stopPropagation();
                event.preventDefault();
                
                $button.blur();
                
                download_media_timeline( {
                    is_for_likes_timeline : $button.hasClass( 'likes' )
                ,   is_for_notifications_timeline : $button.hasClass( 'notifications' )
                ,   is_for_bookmarks_timeline : $button.hasClass( 'bookmarks' )
                ,   timeline_type : $button.attr( 'data-timeline-type' )
                } );
                
                return false;
            } );
    
    $button_template.attr( 'role', 'link' );
    
    
    function check_search_timeline( $node ) {
        if ( ! CLASS_TIMELINE_SET[ TIMELINE_TYPE.search ] ) {
            return false;
        }
        
        if ( ! judge_search_timeline() ) {
            return false;
        }
        var $target_container = $();
        
        $target_container = $( 'div[data-testid="primaryColumn"] > div > div > div:first' );
        if ( 0 < $target_container.find( '.' + button_container_class_name ).length ) {
            $target_container = $();
        }
        
        if ( $target_container.length <= 0 ) {
            return false;
        }

        $target_container.find( '.' + button_container_class_name ).remove();
        
        var $button = $button_template.clone( true )
                .text( OPTIONS.DOWNLOAD_BUTTON_TEXT_LONG )
                .attr( 'data-timeline-type', TIMELINE_TYPE.search ),
            
            $button_container;
        
        $button_container = $( '<div />' )
            .css( {
                'right' : '12px'
            ,   'bottom' : '-14px'
            } );
        
        $button_container
            .addClass( button_container_class_name )
            .append( $button );
        
        $target_container.append( $button_container );
        
        return true;
    } // end of check_search_timeline()
    
    
    function check_profile_nav( $node ) {
        if ( ( ! CLASS_TIMELINE_SET[ TIMELINE_TYPE.user ] ) && ( ! CLASS_TIMELINE_SET[ TIMELINE_TYPE.likes ] ) ) {
            return false;
        }
        
        if ( ! judge_profile_timeline() ) {
            return false;
        }
        
        var $target_container = $();
        
        //$target_container = $( 'div[data-testid="primaryColumn"] > div > div > div:first:has(h2[role="heading"] > div[aria-haspopup="false"] span > span > span)' );
        //$target_container = $( 'div[data-testid="primaryColumn"] > div > div > div' ).first().filter( function () {return ( 0 < $( this ).find( 'h2[role="heading"] > div[aria-haspopup="false"] span > span > span' ).length );} );
        //$target_container = $( 'div[data-testid="primaryColumn"] > div > div > div' ).first().filter( function () {return ( 0 < $( this ).find( 'h2[role="heading"] > div > div > div > span > span > span' ).length );} );
        //$target_container = $( 'div[data-testid="primaryColumn"] > div > div > div' ).first().filter( function () {return ( 0 < $( this ).find( 'h2[role="heading"] > div > div > div > span > span >' ).children( 'span, img' ).length );} );
        $target_container = get_profile_container().parents( 'h2[role="heading"]' ).parent( 'div' );
        if ( 0 < $target_container.find( '.' + button_container_class_name ).length ) {
            $target_container = $();
        }
        
        if ( $target_container.length <= 0 ) {
            return false;
        }
        
        $target_container.find( '.' + button_container_class_name ).remove();
        
        var $button = $button_template.clone( true )
                .text( OPTIONS.DOWNLOAD_BUTTON_TEXT_LONG )
                .attr( 'data-timeline-type', TIMELINE_TYPE.user ),
            
            $likes_button = $button_template.clone( true )
                .addClass( 'likes' )
                .text( OPTIONS.LIKES_DOWNLOAD_BUTTON_TEXT_LONG )
                .attr( 'title', OPTIONS.LIKES_DOWNLOAD_BUTTON_HELP_TEXT )
                .attr( 'data-timeline-type', TIMELINE_TYPE.likes ),
            
            $button_container,
            $insert_point = $target_container.find( '.ProfileNav-item--more' );
        
        $button_container = $( '<div />' )
            .css( {
            //    'right' : '130px'
            //,   'bottom' : '2px'
                'right' : '8px'
            ,   'bottom' : '-8px'
            } );
        
        if ( CLASS_TIMELINE_SET[ TIMELINE_TYPE.user ] ) {
            $button_container.append( $button );
        }
        
        if ( CLASS_TIMELINE_SET[ TIMELINE_TYPE.likes ] ) {
            $button_container.append( $likes_button );
        }
        
        $button
            .css( {
                'margin-right' : '16px'
            } );
        
        $button_container
            .addClass( button_container_class_name );
        
        $target_container.append( $button_container );
        
        return true;
    } // end of check_profile_nav()
    
    
    function check_profile_heading( $node ) {
        return false;
    } // end of check_profile_heading()
    
    
    function check_notifications_timeline( $node ) {
        if ( ! CLASS_TIMELINE_SET[ TIMELINE_TYPE.notifications ] ) {
            return false;
        }
        
        if ( ! judge_notifications_timeline() ) {
            return false;
        }
        
        var $target_container = $();
        
        $target_container = $( 'div[data-testid="primaryColumn"] > div > div > div:first' );
        if ( 0 < $target_container.find( '.' + button_container_class_name ).length ) {
            $target_container = $();
        }
        
        if ( $target_container.length <= 0 ) {
            return false;
        }
        
        $target_container.find( '.' + button_container_class_name ).remove();
        
        var $button = $button_template.clone( true )
                .addClass( 'notifications' )
                .attr( 'title', OPTIONS.MENTIONS_DOWNLOAD_BUTTON_HELP_LONG )
                .attr( 'data-timeline-type', TIMELINE_TYPE.notifications )
                .css( {
                } ),
            
            $button_container;
        
        $button.text( OPTIONS.MENTIONS_DOWNLOAD_BUTTON_TEXT_LONG );
        
        $button_container = $( '<div />' )
            .addClass( button_container_class_name )
            .css( {
                'right' : '130px'
            ,   'bottom' : '2px'
            } )
            .append( $button );
        
        $target_container.append( $button_container );
        
        return true;
    } // end of check_notifications_timeline()
    
    
    function check_bookmarks_timeline( $node ) {
        if ( ! CLASS_TIMELINE_SET[ TIMELINE_TYPE.bookmarks ] ) {
            return false;
        }
        
        if ( ! judge_bookmarks_timeline() ) {
            return false;
        }
        
        var $target_container = $();
        
        $target_container = $( 'div[data-testid="primaryColumn"] > div > div > div:first' );
        if ( 0 < $target_container.find( '.' + button_container_class_name ).length ) {
            $target_container = $();
        }
        
        if ( $target_container.length <= 0 ) {
            return false;
        }
        
        $target_container.find( '.' + button_container_class_name ).remove();
        
        var $button = $button_template.clone( true )
                .addClass( 'bookmarks' )
                .attr( 'title', OPTIONS.BOOKMARKS_DOWNLOAD_BUTTON_HELP_LONG )
                .attr( 'data-timeline-type', TIMELINE_TYPE.bookmarks )
                .css( {
                } ),
            
            $button_container;
        
        $button.text( OPTIONS.DOWNLOAD_BUTTON_TEXT_LONG );
        
        $button_container = $( '<div />' )
            .addClass( button_container_class_name )
            .css( {
                'right' : '130px'
            ,   'bottom' : '2px'
            } )
            .append( $button );
        
        $target_container.append( $button_container );
        
        return true;
    } // end of check_bookmarks_timeline()
    
    
    return function ( node ) {
        if ( ( ! node ) || ( node.nodeType != 1 ) ) {
            return false;
        }
        
        var $node = $( node ),
            counter = 0;
        
        if ( 0 < $node.find( '.' + button_container_class_name ).length ) {
            return false;
        }
        if ( check_profile_nav( $node ) ) counter ++;
        if ( check_profile_heading( $node ) ) counter ++;
        if ( check_search_timeline( $node ) ) counter ++;
        if ( check_notifications_timeline( $node ) ) counter ++;
        if ( check_bookmarks_timeline( $node ) ) counter ++;
        
        if ( 0 < counter ) log_debug( 'check_timeline_headers():', counter );
        
        return ( 0 < counter );
    };

} )(); // end of check_timeline_headers()


function parse_tweet( $tweet ) {
    var $tweet_time = $tweet.find( 'a[role="link"] time[datetime]' ).filter( function () {
            return $( this ).parents( 'div[role="link"]' ).length < 1;
        } ).first(),
        //is_individual_tweet = ( $tweet_time.length <= 0 ),
        is_individual_tweet = ( $tweet.find( 'a[role="link"][href*="/status/"] ~ a[role="link"][href*="/help.twitter.com/"]' ).length > 0 ),
        $caret_menu_button = $tweet.find( '[role="button"][data-testid="caret"]' ).first(),
        //$source_label_container = ( is_individual_tweet ) ? $tweet.find( 'div[dir="auto"]' ).filter( function () {
        //    return ( 0 < $( this ).children( 'a[role="link"][href*="/help.twitter.com/"]' ).length );
        //} ) : $(),
        $source_label_container = ( is_individual_tweet ) ? $tweet.find( 'a[role="link"][href*="/help.twitter.com/"]' ).parent() : $(),
        $action_list_container = $tweet.find( 'div[role="group"]' ).first(),
        $quote_container = $tweet.find( 'div[role="link"]' ).first().parent(),
        $tweet_link = ( is_individual_tweet ) ? $source_label_container.find( 'a[role="link"][href^="/"][href*="/status/"]' ).first() : $tweet_time.parents( 'a[role="link"]' ).first(),
        tweet_url = ( 0 < $tweet_link.length ) ? $tweet_link.attr( 'href' ) : new URL( location.href ).pathname,
        { screen_name, tweet_id } = ( tweet_url.match( /^\/([^\/]+)\/status(?:es)?\/(\d+)/ ) ) ? { screen_name : RegExp.$1, tweet_id : RegExp.$2 } : { screen_name : '_unknown_', tweet_id : 0 },
        timestamp_ms = ( () => {
            if ( 0 < $tweet_time.length ) {
                return new Date( $tweet_time.attr( 'datetime' ) ).getTime();
            }
            // TODO: 個別ツイートの場合、日付が取得できない→ツイートIDから取得しているが、2010年11月以前は未対応
            try {
                return tweet_id_to_date( tweet_id ).getTime();
            }
            catch ( error ) {
                return new Date().getTime();
            }
        } )(),
        $all_image_links = $tweet.find( 'a[role="link"][href*="/status/"][href*="/photo/"]' ).filter( function () {
            return /\/status\/\d+\/photo\/\d+$/.test( $( this ).attr( 'href' ) );
        } ),
        own_image_link_map = {},
        $own_image_links = $all_image_links.filter( function () {
            return ( $( this ).attr( 'href' ).match( /^\/([^\/]+)\/status(?:es)?\/(\d+)/ ) && ( screen_name == RegExp.$1 ) && ( tweet_id == RegExp.$2 ) );
        } ).each( function () {
            own_image_link_map[ $( this ).attr(' href' ) ] = true;
        } ),
        has_images = (0 < $own_image_links.length ),
        $quote_image_links = $all_image_links.filter( function () {
            return ( ! own_image_link_map[ $( this ).attr(' href' ) ] );
        } ),
        $all_video_containers = $tweet.find( '[data-testid="previewInterstitial"],[data-testid="videoPlayer"]' ),
        $own_video_container = ( () => {
            var $own_video_container = $all_video_containers.filter( function () {
                    return $( this ).parents( 'div[role="link"]' ).length < 1;
                } ).first();
            
            if ( /(?:periscope)/i.test( $source_label_container.text() ) ) {
                // ツイートソースをもとに除外
                return $();
            }
            
            if ( 0 < $tweet.find( '[data-testid="card.wrapper"] a[role="link"][href^="/i/broadcasts/"]' ).length ) {
                // ライブ放送（Broadcast）は除外
                return $();
            }
            
            if ( $own_video_container.data( 'testid' ) == 'previewInterstitial' ) {
                // 動画自動再生がOFFの場合
                if ( $own_video_container.find( '[data-testid="playButton"]' ).length < 1 ) {
                    return $();
                }
            }
            return $own_video_container;
        } )(),
        has_video = ( 0 < $own_video_container.length ),
        has_gif_video = has_video && ( () => {
            var $player = $own_video_container.find( 'div[style*="background-image"]' ).first(),
                background_image_url = $player.css( 'background-image' );
            
            if ( background_image_url ) {
                if ( /tweet_video_thumb/.test( background_image_url ) ) {
                    return true;
                }
            }
            
            var $video = $own_video_container.find( 'video' );
            
            if ( 0 < $video.length ) {
                if ( /video\.twimg\.com\/tweet_video\/.*?\.mp4/.test( $video.attr( 'src' ) ) ) {
                    return true;
                }
            }
            
            var $gif_marks = $own_video_container.find( 'span' ).filter( function () {
                    var text = '';
                    
                    $( this ).contents().each( function () {
                        if ( this.nodeType != Node.TEXT_NODE ) return;
                        text += ( this.textContent || '' ).trim();
                    } );
                    
                    return text.toUpperCase() == 'GIF';
                } );
            
            return 0 < $gif_marks.length;
        } )(),
        has_media = has_images || has_video,
        media_number = ( has_video ) ? $own_video_container.length : $own_image_links.length,
        is_min_render_complete = ( () => {
            if ( $caret_menu_button.length < 1 ) return false;
            if ( $action_list_container.length < 1 ) return false;
            if ( $tweet_link.length < 1 ) return false;
            return true;
        } )();
    
    return {
        $tweet,
        is_min_render_complete,
        is_individual_tweet,
        tweet_url,
        screen_name,
        tweet_id,
        timestamp_ms,
        $tweet_link,
        $tweet_time,
        $caret_menu_button,
        $source_label_container,
        $action_list_container,
        $quote_container,
        $all_image_links,
        $own_image_links,
        $quote_image_links,
        $all_video_containers,
        $own_video_container,
        has_media,
        has : {
            images : has_images,
            video : has_video,
            gif_video : has_gif_video,
        },
        media_number,
    };
} // end of parse_tweet()


function update_video_mark( tweet_info ) {
    if ( ! tweet_info.has.video ) return;
    
    var $own_video_container = tweet_info.$own_video_container;
    
    $own_video_container.addClass( 'PlayableMedia PlayableMedia-player PlayableMedia-video' );
    
    if ( tweet_info.has.gif_video ) {
        $own_video_container.addClass( 'PlayableMedia--gif' );
    }
} // end of update_video_mark()


function is_open_media_mode( $event ) {
    return ( ( ( ! OPTIONS.OPEN_MEDIA_LINK_BY_DEFAULT ) && ( $event.altKey ) ) || ( ( OPTIONS.OPEN_MEDIA_LINK_BY_DEFAULT ) && ( ! $event.altKey ) ) );
} // end of is_open_media_mode()


function get_jqxhr_error_message( jqXHR ) {
    var message = '';
    
    switch ( jqXHR.status ) {
        case 401 :
            message = '(Unauthorized)';
            break;
        case 403 :
            message = '(Forbidden)';
            break;
        case 429 :
            try {
                message = '(It will be reset after about ' + ~~( jqXHR.getResponseHeader( 'x-rate-limit-reset' ) - new Date().getTime() / 1000 ) + ' seconds)';
            }
            catch ( error ) {
            }
            break;
    }
    return message;
} // end of get_jqxhr_error_message()


function async_get_tweet_info( tweet_id ) {
    return new Promise( ( resolve, reject ) => {
        api2_get_tweet_info( tweet_id )
        .done( function ( json, textStatus, jqXHR ) {
            resolve( {
                tweet_info : json,
                textStatus, 
                jqXHR,
            } );
        } )
        .fail( function ( jqXHR, textStatus, errorThrown ) {
            resolve( {
                tweet_info : null,
                textStatus,
                jqXHR,
                errorThrown,
            } );
        } )
        .always( function () {
        } );
    } );
} // end of async_get_tweet_info()


function async_fetch_media( media_url, responseType ) {
    if ( ! responseType ) responseType = 'arraybuffer';
    
    return new Promise( ( resolve, reject ) => {
        fetch_url( media_url, {
            responseType,
            
            onload : ( response ) => {
                if ( response.status < 200 || 300 <= response.status ) {
                    resolve( {
                        error : response.status + ' ' + response.statusText,
                        response,
                    } );
                    
                    return;
                }
                
                resolve( {
                    response : response.response,
                } );
            },
            
            onerror : ( response ) => {
                resolve( {
                    error : response.status + ' ' + response.statusText,
                    response,
                } );
            } // end of onerror()
        } );
    } );
} // end of async_fetch_media()


function async_download_zip( zip, zip_filename ) {
    return new Promise( ( resolve, reject ) => {
        var zip_content_type = 'blob',
            url_scheme = 'blob';
        
        if ( IS_FIREFOX ) {
            // TODO: ZIP を保存しようとすると、Firefox でセキュリティ警告が出る場合がある（「このファイルを開くのは危険です」(This file is not commonly downloaded.)）
            // → Firefox のみ、Blob URL ではなく、Data URL(Base64) で様子見
            zip_content_type =  'base64';
            url_scheme = 'data';
        }
        
        zip.generateAsync( { type : zip_content_type } )
        .then( function ( zip_content ) {
            if ( zip_content_type == 'base64' ) {
                download_base64( zip_filename, zip_content );
            }
            else {
                download_blob( zip_filename, zip_content );
            }
            resolve( {
                error : false,
            } );
        } )
        .catch( function ( error ) {
            resolve( {
                error,
            } );
        } );
    } );
} // end of async_download_zip()


function setup_image_download_button( $tweet, $media_button ) {
    $media_button.text( OPTIONS.IMAGE_DOWNLOAD_LINK_TEXT );
    
    var clickable = true,
        image_info_fixed = false,
        image_urls = [],
        tweet_info = null,
        created_at = null,
        zip = null,
        
        disable_button = () => {
            clickable = false;
            $media_button.css( 'cursor', 'progress' ).off( 'click' );
        },
        
        enable_button = () => {
            zip = null;
            $media_button.css( 'cursor', 'pointer' ).on( 'click', click_handler );
            clickable = true;
        },
        
        open_images = () => {
            if ( image_urls.length < 1 ) {
                log_error( 'image url could not be found' );
                alert( 'Image URL could not be found !' );
                enable_button();
                return;
            }
            
            if ( typeof extension_functions != 'undefined' ) {
                extension_functions.open_multi_tabs( image_urls );
            }
            else {
                image_urls.reverse().map( ( image_url ) => w.open( image_url ) );
            }
            enable_button();
        },
        
        download_images = async () => {
            if ( ! image_info_fixed ) {
                var api_result = await async_get_tweet_info( tweet_info.tweet_id );
                
                if ( api_result.tweet_info ) {
                    try {
                        try {
                            image_urls = api_result.tweet_info.extended_entities.media.map( ( media ) => {
                                return get_img_url( media.media_url_https, ( media.features.orig ) ? 'orig' : 'large' );
                            } );
                        }
                        catch ( error ) {
                            image_urls = api_result.tweet_info.entities.media.map( ( media ) => {
                                return get_img_url( media.media_url_https, ( media.features.orig ) ? 'orig' : 'large' );
                            } );
                        }
                        created_at = api_result.tweet_info.created_at;
                        image_info_fixed = true;
                    }
                    catch ( error ) {
                        log_error( 'failed to analyze tweet_info', error );
                    }
                }
                else {
                    log_error( 'failed to get tweet_info', api_result );
                }
            }
            
            zip = new JSZip();
            
            var image_index = 0,
                timestamp_ms = created_at ? new Date( created_at ).getTime() : tweet_info.timestamp_ms,
                date = new Date( parseInt( timestamp_ms, 10 ) ),
                timestamp = format_date( date, 'YYYYMMDD_hhmmss' ),
                zipdate = adjust_date_for_zip( date );
            
            for ( var image_url of image_urls ) {
                var fetch_result = await async_fetch_media( image_url, 'arraybuffer' );
                
                if ( fetch_result.error ) {
                    log_error( 'download failure', image_url, fetch_result.error, fetch_result.response );
                    continue;
                }
                
                var image_filename = [
                        tweet_info.screen_name,
                        tweet_info.tweet_id,
                        timestamp,
                        'img' + ( image_index + 1 ),
                    ].join( '-' ) + '.' + get_img_extension( image_url );
                
                zip.file( image_filename, fetch_result.response, {
                    date: zipdate,
                } );
                
                image_index ++;
            }
            
            var zip_filename = [
                    tweet_info.screen_name,
                    tweet_info.tweet_id,
                    timestamp,
                    'img',
                ].join( '-' ) + '.zip',
                
                download_result = await async_download_zip( zip, zip_filename );
            
            if ( download_result.error ) {
                log_error( 'Error in zip.generateAsync()', download_result.error );
                alert( 'ZIP download failed !' );
            }
            enable_button();
        },
        
        click_handler = ( $event ) => {
            if ( ! clickable ) {
                return;
            }
            
            disable_button();
            
            $event.stopPropagation();
            $event.preventDefault();
            
            tweet_info = parse_tweet( $tweet );
            
            if ( ! image_info_fixed ) {
                // ボタン挿入時には画像の数が確定していない場合があるため（APIにより確定していない限り）画像情報を取得し直す
                var image_info_list = [];
                
                tweet_info.$own_image_links.each( function () {
                    var $image_link = $( this );
                    
                    image_info_list.push( {
                        id : parseInt( ( $image_link.attr( 'href' ) || '0' ).replace( /^.*\/photo\//, '' ), 10 ),
                        image_url : $image_link.find( 'div[aria-label] > img[src*="//pbs.twimg.com/media/"]' ).attr( 'src' ),
                        // TODO: まれにDOMから img[src] が取得できないケースあり（例: https://twitter.com/furyutei/status/1410195533956751362）
                    } );
                } );
                
                image_info_list.sort( ( a, b ) => a.id - b.id );
                image_urls = image_info_list
                    .filter( image_info => image_info.image_url )
                    .map( image_info => get_img_url_orig( image_info.image_url ) );
            }
            
            if ( is_open_media_mode( $event ) ) {
                open_images();
            }
            else {
                download_images();
            }
        };
    
    enable_button();
} // end of setup_image_download_button()


function setup_video_download_button( $tweet, $media_button ) {
    $media_button.text( OPTIONS.VIDEO_DOWNLOAD_LINK_TEXT );
    
    var clickable = true,
        video_url = null,
        tweet_info = null,
        media_prefix = 'vid',
        created_at = null,
        
        disable_button = () => {
            clickable = false;
            $media_button.css( 'cursor', 'progress' ).off( 'click' );
        },
        
        enable_button = () => {
            $media_button.css( 'cursor', 'pointer' ).on( 'click', click_handler );
            clickable = true;
        },
        
        update_video_info = async () => {
            var api_result = await async_get_tweet_info( tweet_info.tweet_id );
            
            if ( ! api_result.tweet_info ) {
                log_error( 'failed to get tweet_info', api_result );
                alert( 'Failed to get tweet information !' );
                return;
            }
            
            created_at = api_result.tweet_info.created_at;
            
            try {
                media_prefix = ( api_result.tweet_info.extended_entities.media[ 0 ].type == 'animated_gif' ) ? 'gif' : 'vid';
            }
            catch ( error ) {
            }
            
            try {
                switch ( media_prefix ) {
                    case 'gif' : ( () => {
                        video_url = api_result.tweet_info.extended_entities.media[ 0 ].video_info.variants[ 0 ].url;
                    } )();
                    break;
                    
                    default : await ( async () => {
                        var video_info;
                        
                        try {
                            try {
                                video_info = api_result.tweet_info.extended_entities.media[ 0 ].video_info;
                            }
                            catch ( error ) {
                                // [Issue #54: Get video from tweets generated with Twitter for Advertisers tool](https://github.com/furyutei/twMediaDownloader/issues/54#issuecomment-806267490) への対応
                                var unified_card_info = JSON.parse( api_result.tweet_info.card.binding_values.unified_card.string_value );
                                
                                video_info = unified_card_info.media_entities[ unified_card_info.component_objects.media_1.data.id ].video_info;
                            }
                            var variants = video_info.variants,
                                max_bitrate = -1;
                            
                            variants.map( ( variant ) => {
                                if ( ( variant.content_type == 'video/mp4' ) && ( variant.bitrate ) && ( max_bitrate < variant.bitrate ) ) {
                                    video_url = variant.url;
                                    max_bitrate = variant.bitrate;
                                }
                            } );
                        }
                        catch ( error ) {
                            // [Issue #54: Get video from tweets generated with Twitter for Advertisers tool](https://github.com/furyutei/twMediaDownloader/issues/54) への対応
                            try {
                                var binding_values = api_result.tweet_info.card.binding_values,
                                    stream_url = ( binding_values.player_stream_url || binding_values.amplify_url_vmap ).string_value;
                                
                                if ( /\.mp4(?:\?|$)/.test( stream_url ) ) {
                                    video_url = stream_url;
                                    return;
                                }
                                
                                await new Promise( ( resolve, reject ) => {
                                    $.ajax( {
                                        type : 'GET',
                                        url : stream_url,
                                        dataType: 'xml',
                                    } )
                                    .done( ( xml, textStatus, jqXHR ) => {
                                        var max_bitrate = -1;
                                        
                                        $( xml ).find( 'tw\\:videoVariants > tw\\:videoVariant' ).each( function () {
                                            var $variant = $( this ),
                                                url = decodeURIComponent( $variant.attr( 'url' ) || '' ),
                                                content_type = $variant.attr( 'content_type' ),
                                                bit_rate = parseInt( $variant.attr( 'bit_rate' ), 10 );
                                            
                                            if ( ( content_type == 'video/mp4' ) && ( bit_rate ) && ( max_bitrate < bit_rate ) ) {
                                                video_url = url;
                                                max_bitrate = bit_rate;
                                            }
                                        } );
                                        resolve();
                                    } )
                                    .fail( function ( jqXHR, textStatus, errorThrown ) {
                                        var error_message = get_jqxhr_error_message( jqXHR );
                                        
                                        log_error( tweet_info.tweet_id, textStatus, jqXHR.status + ' ' + jqXHR.statusText, error_message );
                                        resolve();
                                    } )
                                    .always( () => {
                                    } );
                                } );
                            }
                            catch ( error2 ) {
                                log_error( tweet_info.tweet_id, error, error2 );
                                // TODO: 外部動画等は未サポート
                                log_info( 'response(api_result):', api_result );
                            }
                        }
                    } )();
                    break;
                }
            }
            catch ( error ) {
                log_error( 'failed to analyze tweet_info', error );
                alert( 'Faild to analyze tweet information !' );
            }
        },
        
        open_video = () => {
            if ( video_url ) {
                w.open( video_url );
                enable_button();
                return;
            }
            
            var child_window;
            
            // ポップアップブロック対策
            if ( IS_FIREFOX ) {
                child_window = w.open( 'about:blank', '_blank' ); // 空ページを開いておく
                // TODO: LOADING_IMAGE_URL だと fetch() 後には child_window が DeadObject 化してしまう
            }
            else {
                child_window = w.open( LOADING_IMAGE_URL, '_blank' ); // ダミー画像を開いておく
            }
            
            ( async () => {
                await update_video_info();
                
                if ( video_url ) {
                    child_window.location.replace( video_url );
                }
                else {
                    child_window.close();
                }
                enable_button();
            } )();
        },
        
        download_video = async () => {
            if ( ! video_url ) {
                await update_video_info();
            }
            
            if ( ! video_url ) {
                enable_button();
                return;
            }
            
            var fetch_result = await async_fetch_media( video_url, 'blob' );
            
            if ( fetch_result.error ) {
                log_error( 'download failure', video_url, fetch_result.error, fetch_result.response );
                alert( 'Video download failed !' );
                enable_button();
                return;
            }
            
            var timestamp_ms = created_at ? new Date( created_at ).getTime() : tweet_info.timestamp_ms,
                date = new Date( parseInt( timestamp_ms, 10 ) ),
                timestamp = format_date( date, 'YYYYMMDD_hhmmss' ),
                filename = [
                    tweet_info.screen_name,
                    tweet_info.tweet_id,
                    timestamp,
                    media_prefix + '1'
                ].join( '-' ) + '.' + get_video_extension( video_url );
            
            download_blob( filename, fetch_result.response );
            enable_button();
        },
        
        click_handler = ( $event ) => {
            if ( ! clickable ) {
                return;
            }
            
            disable_button();
            
            $event.stopPropagation();
            $event.preventDefault();
            
            tweet_info = parse_tweet( $tweet );
            update_video_mark( tweet_info );
            
            if ( is_open_media_mode( $event ) ) {
                open_video();
            }
            else {
                download_video();
            }
        };
        
    enable_button();
} // end of setup_video_download_button()


function add_media_button_to_tweet( $tweet ) {
    var media_button_class_name = SCRIPT_NAME + '_media_button',
        tweet_profile_class_name = SCRIPT_NAME + '_tweet_profile';
    
    var tweet_info = parse_tweet( $tweet );

    if ( ! tweet_info.is_min_render_complete ) {
        return false;
    }
    
    if ( ! tweet_info.has_media ) {
        return false;
    }
    
    if ( tweet_info.has.images ) {
        if ( ! OPTIONS.IMAGE_DOWNLOAD_LINK ) {
            return false;
        }
    }
    else {
        if ( ! OPTIONS.VIDEO_DOWNLOAD_LINK ) {
            return false;
        }
    }
    
    update_video_mark( tweet_info );
    
    var $action_list = ( 0 < tweet_info.$source_label_container.length ) ? tweet_info.$source_label_container : tweet_info.$action_list_container,
        $media_button_container = $action_list.find( '.' + media_button_class_name );
    
    if ( 0 < $media_button_container.length ) {
        return false;
    }
    
    var tooltip_title = ( OPTIONS.OPEN_MEDIA_LINK_BY_DEFAULT ) ? OPTIONS.OPEN_MEDIA_LINK : OPTIONS.DOWNLOAD_MEDIA_TITLE,
        tooltip_alt_title = ( OPTIONS.OPEN_MEDIA_LINK_BY_DEFAULT ) ? OPTIONS.DOWNLOAD_MEDIA_TITLE : OPTIONS.OPEN_MEDIA_LINK;
    
    $media_button_container = $( '<div class="ProfileTweet-action js-tooltip"><button/></div>' )
        .addClass( media_button_class_name )
        .attr( 'title', 'Click: ' + tooltip_title + ' / \n' + ( IS_MAC ? '[option]' : '[Alt]' ) + '+Click: ' + tooltip_alt_title )
        .css( {
            'display' : 'none'
        } );
    
    var $media_button = $media_button_container.find( 'button:first' ).addClass( 'btn' );
    
    if ( tweet_info.has.images ) {
        setup_image_download_button( $tweet, $media_button );
    }
    else {
        setup_video_download_button( $tweet, $media_button );
    }
    
    var $action_more = $action_list.find( '.ProfileTweet-action--more' );
    
    if ( 0 < $action_more.length ) {
        // 操作性のため、「その他」メニュー("float:right;"指定)よりも左側に挿入
        $action_more.before( $media_button_container );
    }
    else {
        $action_list.append( $media_button_container );
    }
    
    $media_button_container.css( 'display', 'inline-block' );
    
    return ( 0 < $media_button_container.length );
} // end of add_media_button_to_tweet()


function check_media_tweets( node ) {
    if ( ( ! node ) || ( node.nodeType != 1 ) ) {
        return false;
    }
    
    var $node = $( node ),
        $tweets = $();
    
    if ( $node.hasClasses( [ SCRIPT_NAME + '_media_button', SCRIPT_NAME + '_tweet_profile' ], true ) ) {
        return false;
    }
    
    $tweets = $node
        //.find( 'div[data-testid="primaryColumn"] article[role="article"]:has(div[data-testid="tweet"]):has(div[aria-label]):not(:has(.' + SCRIPT_NAME + '_media_button))' ) // → :has() を使わなくしてもそれ程パフォーマンスは変わらない
        .find( 'div[data-testid="primaryColumn"] article[role="article"]' )
        .filter( function () {
            var $tweet = $( this );
            
            return (
                ( ! $tweet.hasClass( SCRIPT_NAME + '_touched' ) ) &&
                ( ( $tweet.attr( 'data-testid' ) == 'tweet' ) || ( 0 < $tweet.find( 'div[data-testid="tweet"]' ).length ) ) &&
                ( 0 < $tweet.find( 'div[aria-label]' ).length ) &&
                ( $tweet.find( '.' + SCRIPT_NAME + '_media_button' ).length <= 0 ) &&
                ( $tweet.find( 'a.' + SCRIPT_NAME + '_tweet_profile' ).length <= 0 )
            );
        } );
    
    $tweets = $tweets.filter( function () {
        var $tweet = $( this ),
            is_button_added = add_media_button_to_tweet( $tweet );
        
        /*
        //if ( is_button_added ) {
        //    $tweet.addClass( SCRIPT_NAME + '_touched' );
        //}
        */
        return is_button_added;
    } );
    
    if ( 0 < $tweets.length ) log_debug( 'check_media_tweets():', $tweets.length );
    
    return ( 0 < $tweets.length );
} // end of check_media_tweets()


function insert_download_buttons() {
    check_timeline_headers( d.body );
} // end of insert_download_buttons()


function insert_media_buttons() {
    if ( ( ! OPTIONS.IMAGE_DOWNLOAD_LINK ) && ( ! OPTIONS.VIDEO_DOWNLOAD_LINK ) ) {
        return;
    }
    check_media_tweets( d.body );
} // end of insert_media_buttons()


function update_display_mode() {
    $( d.body ).attr( 'data-nightmode', is_night_mode() );
} // end of update_display_mode()


var is_primary_column_ready = () => {
    if ( $( 'div[data-testid="primaryColumn"]' ).length <= 0 ) {
        return false;
    }
    is_primary_column_ready = () => true;
    
    return true;
}; // end of is_primary_column_ready()


function start_mutation_observer() {
    const
        observer = new MutationObserver( ( records ) => {
            try {
                stop_observe();
                
                //update_twitter_api_info(); // 2020.08.17: OAuth 1.0a認証を伴ったAPIは利用しないようになったので無効化
                update_display_mode();
                
                // TODO: React版 Twitter の場合、要素ごとの処理を行うと取りこぼしが出てしまう
                // → 追加要素毎の処理を止め、まとめてチェック
                if ( ! is_primary_column_ready() ) {
                    return;
                }
                
                if ( OPTIONS.IMAGE_DOWNLOAD_LINK || OPTIONS.VIDEO_DOWNLOAD_LINK ) {
                    check_media_tweets( d.body );
                }
                
                check_timeline_headers( d.body );
            }
            catch ( error ) {
                log_error( 'Error in MutaionObserver:', error );
            }
            finally {
                start_observe();
            }
        } ),
        start_observe = () => observer.observe( d.body, { childList : true, subtree : true } ),
        stop_observe = () => observer.disconnect();
    
    start_observe();
} // end of start_mutation_observer()


function initialize( user_options ) {
    if ( user_options ) {
        Object.keys( user_options ).forEach( function ( name ) {
            if ( user_options[ name ] === null ) {
                return;
            }
            OPTIONS[ name ] = user_options[ name ];
        } );
    }
    
    if ( ! OPTIONS.OPERATION ) {
        return;
    }
    
    // 2020.08.14: 不安定なオプションの固定化
    Object.assign( OPTIONS, {
        ENABLE_VIDEO_DOWNLOAD : true,
        ENABLE_ZIPREQUEST : false,
    } );
    
    function initialize_global_variables( callback ) {
        var global_names = [ 'limit_tweet_number', 'support_image', 'support_gif', 'support_video', 'support_nomedia', 'include_retweets', 'dry_run' ],
            storage_name_map = {},
            storage_names = global_names.map( function ( global_name ) {
                var storage_name = SCRIPT_NAME + '_' + global_name;
                
                storage_name_map[ global_name ] = storage_name;
                return storage_name;
            } ),
            finish = function ( name_value_map ) {
                set_values( name_value_map, function () {
                    callback( name_value_map );
                } );
            };
        
        get_values( storage_names, function ( name_value_map ) {
            if ( ( name_value_map[ storage_name_map.limit_tweet_number ] !== null ) && ( ! isNaN( name_value_map[ storage_name_map.limit_tweet_number ] ) ) ) {
                limit_tweet_number = parseInt( name_value_map[ storage_name_map.limit_tweet_number ], 10 );
            }
            else {
                limit_tweet_number = OPTIONS.DEFAULT_LIMIT_TWEET_NUMBER;
                name_value_map[ storage_name_map.limit_tweet_number ] = String( limit_tweet_number );
            }
            
            if ( name_value_map[ storage_name_map.support_image ] !== null ) {
                support_image = ( name_value_map[ storage_name_map.support_image ] !== '0' );
            }
            else {
                support_image = OPTIONS.DEFAULT_SUPPORT_IMAGE;
                name_value_map[ storage_name_map.support_image ] = ( support_image ) ? '1' : '0';
            }
            
            if ( name_value_map[ storage_name_map.support_gif ] !== null ) {
                support_gif = ( name_value_map[ storage_name_map.support_gif ] !== '0' );
            }
            else {
                support_gif = OPTIONS.DEFAULT_SUPPORT_GIF;
                name_value_map[ storage_name_map.support_gif ] = ( support_gif ) ? '1' : '0';
            }
            
            if ( name_value_map[ storage_name_map.support_video ] !== null ) {
                support_video = ( name_value_map[ storage_name_map.support_video ] !== '0' );
            }
            else {
                support_video = OPTIONS.DEFAULT_SUPPORT_VIDEO;
                name_value_map[ storage_name_map.support_video ] = ( support_video ) ? '1' : '0';
            }
            
            if ( name_value_map[ storage_name_map.support_nomedia ] !== null ) {
                support_nomedia = ( name_value_map[ storage_name_map.support_nomedia ] !== '0' );
            }
            else {
                support_nomedia = OPTIONS.DEFAULT_SUPPORT_NOMEDIA;
                name_value_map[ storage_name_map.support_nomedia ] = ( support_nomedia ) ? '1' : '0';
            }
            
            if ( name_value_map[ storage_name_map.include_retweets ] !== null ) {
                include_retweets = ( name_value_map[ storage_name_map.include_retweets ] !== '0' );
            }
            else {
                include_retweets = OPTIONS.DEFAULT_INCLUDE_RETWEETS;
                name_value_map[ storage_name_map.include_retweets ] = ( include_retweets ) ? '1' : '0';
            }
            
            if ( name_value_map[ storage_name_map.dry_run ] !== null ) {
                dry_run = ( name_value_map[ storage_name_map.dry_run ] !== '0' );
            }
            else {
                dry_run = OPTIONS.DEFAULT_DRY_RUN;
                name_value_map[ storage_name_map.dry_run ] = ( dry_run ) ? '1' : '0';
            }
            
            finish( name_value_map );
        } );
    
    } // end of initialize_global_variables()
    
    
    function insert_css( css_rule_text ) {
        var parent = d.querySelector( 'head' ) || d.body || d.documentElement,
            css_style = d.createElement( 'style' ),
            css_rule = d.createTextNode( css_rule_text );
        
        css_style.type = 'text/css';
        css_style.className = SCRIPT_NAME + '-css-rule';
        
        if ( css_style.styleSheet ) {
            css_style.styleSheet.cssText = css_rule.nodeValue;
        }
        else {
            css_style.appendChild( css_rule );
        }
        
        parent.appendChild( css_style );
    } // end of insert_css()
    
    
    function set_user_css() {
        var dialog_container_selector = '#' + SCRIPT_NAME + '_container',
            night_mode_dialog_container_selector = dialog_container_selector + '.night_mode',
            dialog_selector = '.' + SCRIPT_NAME + '_dialog',
            
            toolbox_selector = dialog_selector + ' .' + SCRIPT_NAME + '_toolbox',
            range_container_selector = toolbox_selector + ' .range_container',
            checkbox_container_selector = toolbox_selector + ' .' + SCRIPT_NAME + '_checkbox_container',
            button_container_selector = toolbox_selector + ' .' + SCRIPT_NAME + '_button_container',
            
            status_container_selector = dialog_selector + ' .' + SCRIPT_NAME + '_status',
            log_selector = status_container_selector + ' .' + SCRIPT_NAME + '_log',
            log_mask_selector = status_container_selector + ' .' + SCRIPT_NAME + '_log_mask',
            
            status_bar_selector = dialog_selector + ' .' + SCRIPT_NAME + '_status_bar',
            
            night_mode_selector = 'body[data-nightmode="true"]',
            media_button_selector = '.' + SCRIPT_NAME + '_media_button button.btn',
            night_mode_media_button_selector = night_mode_selector + ' ' + media_button_selector,
            header_button_selector = '.' + SCRIPT_NAME + '_download_button',
            night_mode_header_button_selector = night_mode_selector + ' ' + header_button_selector,
            header_button_container_selector = '.' + SCRIPT_NAME + '_download_button_container',
            night_mode_header_button_container_selector = night_mode_selector + ' ' + header_button_container_selector,
            
            css_rule_lines = [
                '.' + SCRIPT_NAME + '_toolbox label {cursor: pointer;}'
            
            ,   dialog_container_selector + ' {background: rgba( 0, 0, 0, 0.8 );}'
            ,   dialog_container_selector + ' ' + dialog_selector + ' {background: white;}'
            
            ,   dialog_container_selector + ' ' + toolbox_selector + ' {background: lightblue;}'
            ,   dialog_container_selector + ' ' + range_container_selector + ' h3 {color: #66757f;}'
            ,   dialog_container_selector + ' ' + range_container_selector + ' table {color: #14171a;}'
            ,   dialog_container_selector + ' ' + range_container_selector + ' input.tweet_id {color: #14171a; background: white; border-color: #e6ecf0;}'
            ,   dialog_container_selector + ' ' + range_container_selector + ' input.tweet_number {color: #14171a; background: white; border-color: #e6ecf0;}'
            ,   dialog_container_selector + ' ' + checkbox_container_selector + ' label {color: #14171a;}'
            ,   dialog_container_selector + ' ' + button_container_selector + ' label {color: #14171a;}'
            
            ,   dialog_container_selector + ' ' + status_container_selector + ' {background: #f8f8ff;}'
            ,   dialog_container_selector + ' ' + log_selector + ' {color: #14171a; background: snow; border: inset #f8f8ff 1px;}'
            ,   dialog_container_selector + ' ' + log_mask_selector + ' {background: rgba( 0, 0, 0, 0.8 )}'
            ,   dialog_container_selector + ' ' + log_selector + ' .log-item {text-shadow: 1px 1px 1px #ccc;}'
            ,   dialog_container_selector + ' ' + log_selector + ' .log-item a {text-shadow: none;}'
            ,   dialog_container_selector + ' ' + log_selector + ' .log-item a.tweet-link {color: brown;}'
            ,   dialog_container_selector + ' ' + log_selector + ' .log-item a.media-link {color: navy;}'
            
            ,   dialog_container_selector + ' ' + status_bar_selector + ' {padding: 0 0 0 16px; color: #66757f; font-size: 12px; white-space: pre;}'
            
            ,   night_mode_dialog_container_selector + ' {background: rgba( 0, 0, 0, 0.8 );}'
            ,   night_mode_dialog_container_selector + ' ' + dialog_selector + ' {background: #141d26;}'
            
            ,   night_mode_dialog_container_selector + ' ' + toolbox_selector + ' {background: #1b2836;}'
            ,   night_mode_dialog_container_selector + ' ' + range_container_selector + ' h3 {color: #8899a6;}'
            ,   night_mode_dialog_container_selector + ' ' + range_container_selector + ' table {color: #8899a6;}'
            ,   night_mode_dialog_container_selector + ' ' + range_container_selector + ' input.tweet_id {color: #8899a6; background: #182430; border-color: #1B5881;}'
            ,   night_mode_dialog_container_selector + ' ' + range_container_selector + ' input.tweet_number {color: #8899a6; background: #182430; border-color: #1B5881;}'
            ,   night_mode_dialog_container_selector + ' ' + checkbox_container_selector + ' label {color: #8899a6;}'
            ,   night_mode_dialog_container_selector + ' ' + button_container_selector + ' label {color: #8899a6;}'
            
            ,   night_mode_dialog_container_selector + ' ' + status_container_selector + ' {background: #182430;}'
            ,   night_mode_dialog_container_selector + ' ' + log_selector + ' {color: white; background: #1b2836; border: inset #182430 1px;}'
            ,   night_mode_dialog_container_selector + ' ' + log_mask_selector + ' {background: rgba( 0, 0, 0, 0.8 )}'
            ,   night_mode_dialog_container_selector + ' ' + log_selector + ' .log-item {text-shadow: 1px 1px 1px #ccc;}'
            ,   night_mode_dialog_container_selector + ' ' + log_selector + ' .log-item a {text-shadow: none;}'
            ,   night_mode_dialog_container_selector + ' ' + log_selector + ' .log-item a.tweet-link {color: #bc8f8f;}'
            ,   night_mode_dialog_container_selector + ' ' + log_selector + ' .log-item a.media-link {color: #add8e6;}'
            
            ,   night_mode_dialog_container_selector + ' ' + status_bar_selector + ' {color: #8899a6;}'
            
            ,   media_button_selector + ' {font-size: 11px; font-weight: normal; padding: 1px 2px; text-decoration: none; cursor: pointer; display: inline-block; min-width: 42px;}'
            ,   header_button_selector + ' {font-size: 14px; vertical-align: middle; text-decoration: underline;}'
            ];
        
        var css_rule_lines_react = [
                media_button_selector + ' {margin-left: 8px; margin-right: 8px; background-image: linear-gradient(rgb(255, 255, 255), rgb(245, 248, 250)); background-color: rgb(245, 248, 250); color: rgb(102, 117, 127); cursor: pointer; display: inline-block; position: relative; border-width: 1px; border-style: solid; border-color: rgb(230, 236, 240); border-radius: 4px;}'
            ,   media_button_selector + ':hover {color: rgb(20, 23, 26); background-color: rgb(230, 236, 240); background-image: linear-gradient(rgb(255, 255, 255), rgb(230, 236, 240)); text-decoration: none; border-color: rgb(230, 236, 240);}'
            ,   header_button_selector + ' {color: rgb(27, 149, 224); font-weight: bolder; /*border-bottom: solid 1px rgb(27, 149, 224);*/ /*text-decoration: none;*/}'
            ,   header_button_container_selector + '{position: absolute; z-index: 1000;}'
            ,   dialog_container_selector + ' ' + log_selector + ' pre {margin: 0 0;}'
            ,   dialog_container_selector + ' ' + range_container_selector + ' {font-size:14px;}'
            ,   dialog_container_selector + ' ' + range_container_selector + ' input[type="text"] {padding: 2px 2px;}'
            ,   dialog_container_selector + ' .btn {background-color: #f5f8fa; background-image: linear-gradient(#fff,#f5f8fa); background-repeat: no-repeat; border: 1px solid #e6ecf0; border-radius: 4px; color: #66757f; cursor: pointer; display: inline-block; font-size: 14px; font-weight: bold; line-height: normal; padding: 8px 16px; position: relative;}'
            ,   dialog_container_selector + ' .btn:focus {outline: 0!important; box-shadow: 0 0 0 2px #fff, 0 0 2px 4px rgba(255, 0, 0, 0.4); background: #fff; border-color: #fff; text-decoration: none;}'
            ,   dialog_container_selector + ' .btn:hover {color: #14171a; text-decoration: none; background-color: #e6ecf0; background-image: linear-gradient(#fff,#e6ecf0); border-color: #e6ecf0;}'
            ,   dialog_container_selector + ' .btn:active {outline: 0!important; color: #14171a; background: #e6ecf0; border-color: #ccd6dd; box-shadow: inset 0 1px 4px rgba(0,0,0,0.25);}'
            ,   dialog_container_selector + ' .btn:focus:hover {border-color: #fff;}'
            ,   dialog_container_selector + ' .btn[disabled] {color: #66757f; cursor: default; background-color: #ccd6dd; background-image: linear-gradient(#fff,#f5f8fa); border-color: #ccd6dd; opacity: .5; -ms-filter: "alpha(opacity=50)";}'
            
            ,   night_mode_media_button_selector + ' {background-color: #182430; background-image: none; border: 1px solid #38444d; border-radius: 4px; color: #8899a6; display: inline-block;}'
            ,   night_mode_media_button_selector + ':hover {color: #fff; text-decoration: none; background-color: #10171e; background-image: none; border-color: #10171e;}'
            ,   night_mode_dialog_container_selector + ' .btn {background-color: rgb(24, 36, 48); background-image: none; color: rgb(136, 153, 166); cursor: pointer; display: inline-block; font-size: 14px; font-weight: bold; line-height: normal; position: relative; background-repeat: no-repeat; border-width: 1px; border-style: solid; border-color: rgb(56, 68, 77); border-image: initial; border-radius: 4px; padding: 8px 16px;}'
            ,   night_mode_dialog_container_selector + ' .btn:focus {outline: 0!important;}'
            ,   night_mode_dialog_container_selector + ' .btn:hover {color: rgb(255, 255, 255); background-color: rgb(16, 23, 30); background-image: none; text-decoration: none; border-color: rgb(16, 23, 30);}'
            ,   night_mode_dialog_container_selector + ' .btn:active {color: rgb(255, 255, 255); box-shadow: rgba(0, 0, 0, 0.25) 0px 1px 4px inset; background: rgb(16, 23, 30); border-color: rgb(56, 68, 77);}'
            ,   night_mode_dialog_container_selector + ' .btn:focus:hover {border-color: #fff;}'
            ,   night_mode_dialog_container_selector + ' .btn[disabled] {color: #8899a6; cursor: default; background-color: #38444d; background-image: linear-gradient(#fff,#182430); border-color: #38444d; opacity: .5; -ms-filter: "alpha(opacity=50)";}'
            ];
        
        css_rule_lines = css_rule_lines.concat( css_rule_lines_react );
        
        $( 'style.' + SCRIPT_NAME + '-css-rule' ).remove();
        
        insert_css( css_rule_lines.join( '\n' ) );
    
    } // end of set_user_css()
    
    
    function start_main( name_value_map ) {
        set_user_css();
        insert_download_buttons();
        insert_media_buttons();
        start_mutation_observer();
    } // end of start_main()
    
    
    initialize_global_variables( function ( name_value_map ) {
        // ※以前はこの時点で Twitter API の動作確認を実施していたが、React版ではこの時点ではサイドバーが表示されておらず get_logined_screen_name() で screen_name が取得できないため、
        //   最初に initialize_twitter_api() がコールされた時点で確認するように修正
        start_main( name_value_map );
    } );

} // end of initialize()

// }


// ■ エントリポイント
if ( typeof w.twMediaDownloader_chrome_init == 'function' ) {
    // Google Chorme 拡張機能から実行した場合、ユーザーオプションを読み込む
    w.twMediaDownloader_chrome_init( function ( user_options ) {
        initialize( user_options );
    }, {
        TwitterTimeline,
        download_media_timeline,
        judge_profile_timeline,
        judge_search_timeline,
        judge_notifications_timeline,
        judge_bookmarks_timeline,
    } );
}
else {
    initialize();
}

} )( window, document );

// ■ end of file
