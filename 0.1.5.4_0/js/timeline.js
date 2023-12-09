( () => {
'use strict';

const
    MODULE_NAME = 'TwitterTimeline',
    
    context_global = ( typeof global != 'undefined' ) ? global : ( typeof window != 'undefined' ) ? window : this; // 注: Firefox WebExtension の content_scripts 内では this !== window

( ( exports ) => {
const
    VERSION = '0.1.4',
    
    DEFAULT_DEBUG_MODE = false,
    DEFAULT_SCRIPT_NAME = MODULE_NAME,
    
    ENABLE_EXTERNAL_DECIMAL_LIBRARY = true, // BigInt 取り扱い用に外部 Decimalライブラリを使用するかどうかを設定
    // true : BigInt を扱うライブラリとして、[MikeMcl/decimal.js: An arbitrary-precision Decimal type for JavaScript](https://github.com/MikeMcl/decimal.js) を優先して使用
    // false: 本モジュール内で Decimal class を定義して使用
    
    self = undefined,
    // TODO: class 関数内で self を使っているが、window.self が参照できるため、定義し忘れていてもエラーにならず気づきにくい
    // →暫定的に const self を undefined で定義して window.self への参照を切る
    
    IS_WEB_EXTENSION = ( () => {
        return context_global.is_web_extension || context_global.is_chrome_extension;
    } )(),
    
    user_agent = navigator.userAgent.toLowerCase(),
    IS_FIREFOX = ( 0 <= user_agent.indexOf( 'firefox' ) ),
    
    // ■ Firefox で XMLHttpRequest や fetch が予期しない動作をしたり、開発者ツールのネットワークに通信内容が表示されないことへの対策
    // 参考: [Firefox のアドオン(content_scripts)でXMLHttpRequestやfetchを使う場合の注意 - 風柳メモ](https://memo.furyutei.work/entry/20180718/1531914142)
    XMLHttpRequest = ( typeof content != 'undefined' && typeof content.XMLHttpRequest == 'function' ) ? content.XMLHttpRequest  : context_global.XMLHttpRequest,
    fetch = ( typeof content != 'undefined' && typeof content.fetch == 'function' ) ? content.fetch  : context_global.fetch,
    
    format_date = ( date, format, is_utc ) => {
        if ( ! format ) {
            format = 'YYYY-MM-DD hh:mm:ss.SSS';
        }
        
        let msec = ( '00' + ( ( is_utc ) ? date.getUTCMilliseconds() : date.getMilliseconds() ) ).slice( -3 ),
            msec_index = 0;
        
        if ( is_utc ) {
            format = format
                .replace( /YYYY/g, date.getUTCFullYear() )
                .replace( /MM/g, ( '0' + ( 1 + date.getUTCMonth() ) ).slice( -2 ) )
                .replace( /DD/g, ( '0' + date.getUTCDate() ).slice( -2 ) )
                .replace( /hh/g, ( '0' + date.getUTCHours() ).slice( -2 ) )
                .replace( /mm/g, ( '0' + date.getUTCMinutes() ).slice( -2 ) )
                .replace( /ss/g, ( '0' + date.getUTCSeconds() ).slice( -2 ) )
                .replace( /S/g, ( all ) => {
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
                .replace( /S/g, ( all ) => {
                    return msec.charAt( msec_index ++ );
                } );
        }
        
        return format;
    }, // end of format_date()
    
    get_gmt_datetime = ( time, is_msec ) => {
        let date = new Date( ( is_msec ) ? time : 1000 * time );
        
        return format_date( date, 'YYYY-MM-DD_hh:mm:ss_GMT', true );
    }, // end of get_gmt_datetime()
    
    get_log_timestamp = () => format_date( new Date() ),
    
    log_debug = ( ... args ) => {
        if ( ! exports.debug_mode ) {
            return;
        }
        console.debug( '%c' + '[' + exports.logged_script_name + '] ' + get_log_timestamp(), 'color: gray;', ... args );
    },
    
    log = ( ... args ) => {
        console.log( '%c' + '[' + exports.logged_script_name + '] ' +  + get_log_timestamp(), 'color: teal;', ... args );
    },
    
    log_info = ( ... args ) => {
        console.info( '%c' +  '[' + exports.logged_script_name + '] ' + get_log_timestamp(), 'color: darkslateblue;', ... args );
    },
    
    log_error = ( ... args ) => {
        console.error( '%c' + '[' + exports.logged_script_name + '] ' + get_log_timestamp(), 'color: purple;', ... args );
    },
    
    exit_for_unsupported = ( message = 'This library does not work in current environment.' ) => {
        log_error( exit_for_unsupported );
        throw new Error( message );
    },
    
    browser = ( () => {
        const
            browser = ( this.browser && this.browser.runtime ) ? this.browser : this.chrome; // 注: Firefox の content_scripts 内では this !== window
        
        if ( IS_WEB_EXTENSION && ( ( ! browser ) || ( ! browser.runtime ) ) ) {
            exit_for_unsupported();
        }
        
        return browser;
    } )(),
    
    Decimal = ( () => {
        if ( ENABLE_EXTERNAL_DECIMAL_LIBRARY && context_global.Decimal ) {
            // [MikeMcl/decimal.js: An arbitrary-precision Decimal type for JavaScript](https://github.com/MikeMcl/decimal.js)
            return context_global.Decimal;
        }
        
        if ( typeof BigInt == 'undefined' ) {
            exit_for_unsupported();
        }
        
        const
            Decimal = class {
                constructor( number ) {
                    this.bignum = this._floor( number );
                }
                
                add( n ) {
                    return new Decimal( this.bignum + this._floor( n ) );
                }
                
                sub( n ) {
                    return new Decimal( this.bignum - this._floor( n ) );
                }
                
                mul( n ) {
                    return new Decimal( this.bignum * this._floor( n ) );
                }
                
                div( n ) {
                    return new Decimal( this.bignum / this._floor( n ) );
                }
                
                mod( n ) {
                    return new Decimal( this.bignum % this._floor( n ) );
                }
                
                pow( n ) {
                    return new Decimal( this.bignum ** this._floor( n ) );
                }
                
                cmp( n ) {
                    n = this._floor( n );
                    
                    if ( this.bignum < n ) {
                        return -1;
                    }
                    else if ( this.bignum == n ) {
                        return 0;
                    }
                    else {
                        return 1;
                    }
                }
                
                floor() {
                    return this;
                }
                
                _floor( n ) {
                    try {
                        return BigInt( n );
                    }
                    catch ( error ) {
                        return BigInt( Math.floor( n ) ); // TODO: 小数部があると精度が落ちる
                    }
                }
                
                toString() {
                    return this.bignum.toString.apply( this.bignum, arguments );
                }
            };
        
        Object.assign( Decimal, {
            add : ( n, e ) => {
                return new Decimal( n ).add( e );
            },
            
            sub : ( n, e ) => {
                return new Decimal( n ).sub( e );
            },
            
            mul : ( n, e ) => {
                return new Decimal( n ).mul( e );
            },
            
            div : ( n, e ) => {
                return new Decimal( n ).div( e );
            },
            
            mod : ( n, e ) => {
                return new Decimal( n ).mod( e );
            },
            
            pow : ( n, e ) => {
                return new Decimal( n ).pow( e );
            },
            
            cmp : ( n, e ) => {
                return new Decimal( n ).cmp( e );
            },
        } );
        
        return Decimal;
    } )(),
    
    ID_INC_PER_MSEC = Decimal.pow( 2, 22 ), // ミリ秒毎のID増分
    ID_INC_PER_SEC = ID_INC_PER_MSEC.mul( 1000 ), // 秒毎のID増分
    TWEPOCH_OFFSET_MSEC = 1288834974657,
    TWEPOCH_OFFSET_SEC = Math.ceil( TWEPOCH_OFFSET_MSEC / 1000 ), // 1288834974.657 sec (2010.11.04 01:42:54(UTC)) (via http://www.slideshare.net/pfi/id-15755280)
    ID_THRESHOLD = '300000000000000', // 2010.11.04 22時(UTC)頃に、IDが 30000000000以下から300000000000000以上に切り替え
    DEFAULT_UNTIL_ID = '9153891586667446272', // // datetime_to_tweet_id(Date.parse( '2080-01-01T00:00:00.000Z' )) => 9153891586667446272
    
    LIKE_ID_INC_PER_MSEC = Decimal.pow( 2, 20 ), // Like ID（/2/timeline/favorites/<usr_id>応答のsortIndex）の、ミリ秒毎の増加分
    BOOKMARK_ID_INC_PER_MSEC = Decimal.pow( 2, 18 ), // Bookmark ID（/2/timeline/bookmark/応答のsortIndex）の、ミリ秒毎の増加分
    
    convert_utc_msec_to_tweet_id = ( utc_msec ) => {
        if ( ! utc_msec ) {
            utc_msec = Date.now();
        }
        let bignum_tweet_id = new Decimal( utc_msec ).sub( TWEPOCH_OFFSET_MSEC ).mul( ID_INC_PER_MSEC );
        
        if ( bignum_tweet_id.cmp( ID_THRESHOLD ) < 0 ) {
            return ID_THRESHOLD;
        }
        
        return bignum_tweet_id.toString();
    }, // end of convert_utc_msec_to_tweet_id()
    
    convert_tweet_id_to_utc_msec = ( tweet_id ) => {
        if ( ! tweet_id ) {
            return Date.now();
        }
        let bignum_tweet_id = new Decimal( tweet_id );
        
        if ( bignum_tweet_id.cmp( ID_THRESHOLD ) < 0 ) {
            bignum_tweet_id = new Decimal( ID_THRESHOLD );
        }
        
        return parseInt( bignum_tweet_id.div( ID_INC_PER_MSEC ).floor().add( TWEPOCH_OFFSET_MSEC ), 10 );
    }, // end of convert_tweet_id_to_utc_msec()
    
    convert_tweet_id_to_date = ( tweet_id ) => {
        return new Date( convert_tweet_id_to_utc_msec( tweet_id ) );
    }, // end of convert_tweet_id_to_date()
    
    convert_utc_msec_to_like_id = ( utc_msec ) => {
        if ( ! utc_msec ) {
            utc_msec = Date.now();
        }
        return Decimal.mul( utc_msec, LIKE_ID_INC_PER_MSEC ).toString();
    }, // end of convert_utc_msec_to_like_id()
    
    convert_like_id_to_utc_msec = ( like_id ) => {
        if ( ! like_id ) {
            return Date.now();
        }
        return parseInt( Decimal.div( like_id, LIKE_ID_INC_PER_MSEC ).floor().toString(), 10 );
    }, // end of convert_like_id_to_utc_msec ()
    
    convert_like_id_to_date = ( like_id ) => {
        return new Date( convert_like_id_to_utc_msec( like_id ) );
    }, // end of convert_like_id_to_date()
    
    convert_utc_msec_to_bookmark_id = ( utc_msec ) => {
        if ( ! utc_msec ) {
            utc_msec = Date.now();
        }
        return Decimal.mul( utc_msec, BOOKMARK_ID_INC_PER_MSEC ).toString();
    }, // end of convert_utc_msec_to_bookmark_id()
    
    convert_bookmark_id_to_utc_msec = ( bookmark_id ) => {
        if ( ! bookmark_id ) {
            return Date.now();
        }
        return parseInt( Decimal.div( bookmark_id, BOOKMARK_ID_INC_PER_MSEC ).floor().toString(), 10 );
    }, // end of convert_bookmark_id_to_utc_msec ()
    
    convert_bookmark_id_to_date = ( bookmark_id ) => {
        return new Date( convert_bookmark_id_to_utc_msec( bookmark_id ) );
    }, // end of convert_bookmark_id_to_date()
    
    {
        convert_sort_index_to_cursor,
        create_tweet_id_cursor,
        create_likes_cursor,
        create_bookmarks_cursor,
    } = ( () => {
        const
            num_to_dec64_char_map = Array( 64 ).fill().map( ( _, i ) => {
                if ( 0 <= i && i <= 25 ) return String.fromCharCode( 'A'.charCodeAt( 0 ) + i );
                if ( 26 <= i && i <= 51 ) return String.fromCharCode( 'a'.charCodeAt( 0 ) + ( i - 26 ) );
                if ( 52 <= i && i <= 61 ) return '' + ( i - 52 );
                if ( i == 62 ) return '+';
                return '/';
            } ),
            
            to_binary = ( () => {
                let to_binary;
                
                if ( typeof Decimal.prototype.toBinary == 'function' ) {
                    // MikeMcl/decimal.js の場合、toString(2) では変換できない
                    return ( decimal_object ) => {
                        return decimal_object.toBinary().replace( /^0b/, '' );
                    };
                }
                else {
                    return ( decimal_object ) => {
                        return decimal_object.toString( 2 );
                    };
                }
            } )(),
            
            //create_likes_cursor = ( like_id, is_previous = false ) => {
            //    let sort_index_bin = ( '0'.repeat( 64 ) + to_binary( new Decimal( like_id ).add( is_previous ? -1 : 1 ) ) ).slice( -64 ),
            //        cursor = [
            //        /*  0 */ sort_index_bin.substr( 5, 4 ) + '00',
            //        /*  1 */ sort_index_bin.substr( 14, 2 ) + sort_index_bin.substr( 1, 4 ),
            //        /*  2 */ '1' + sort_index_bin.substr( 9, 5 ),
            //        /*  3 */ sort_index_bin.substr( 17, 6 ),
            //        /*  4 */ sort_index_bin.substr( 26, 4 ) + '1' + sort_index_bin.substr( 16, 1 ),
            //        /*  5 */ sort_index_bin.substr( 35, 2 ) + '1' + sort_index_bin.substr( 23, 3 ),
            //        /*  6 */ '1' + sort_index_bin.substr( 30, 5 ),
            //        /*  7 */ sort_index_bin.substr( 38, 6 ),
            //        /*  8 */ sort_index_bin.substr( 47, 4 ) + '1' + sort_index_bin.substr( 37, 1 ),
            //        /*  9 */ sort_index_bin.substr( 56, 2 ) + '1' + sort_index_bin.substr( 44, 3 ),
            //        /* 10 */ '1' + sort_index_bin.substr( 51, 5 ),
            //        ///* 11 */ ( '0'.repeat( 5 ) + ( parseInt( sort_index_bin.substr( 59, 5 ), 2 ) + ( is_previous ? -1 : 1 ) ).toString( 2 ) ).slice( -5 ) + '0',
            //        /* 11 */ sort_index_bin.substr( 59, 5 ) + '0',
            //        /* 12 */ '01101' + sort_index_bin.substr( 58, 1 ),
            //        ].map( ( sexted_bin, index ) => num_to_dec64_char_map[ parseInt( sexted_bin, 2 ) ] ).reverse().join( '' );
            //    
            //    return ( is_previous ? 'HC' : 'HB' ) +  cursor + 'AAA==';
            //},
            
            convert_sort_index_to_cursor = ( sort_index, is_previous = false ) => {
                let sort_index_bin = ( '0'.repeat( 64 ) + to_binary( new Decimal( sort_index ).add( is_previous ? -1 : 1 ) ) ).slice( -64 ),
                    cursor = [
                    /*  0 */ sort_index_bin.substr( 5, 4 ) + '00',
                    /*  1 */ sort_index_bin.substr( 14, 2 ) + sort_index_bin.substr( 1, 4 ),
                    /*  2 */ '1' + sort_index_bin.substr( 9, 5 ),
                    /*  3 */ sort_index_bin.substr( 17, 6 ),
                    /*  4 */ sort_index_bin.substr( 26, 4 ) + '1' + sort_index_bin.substr( 16, 1 ),
                    /*  5 */ sort_index_bin.substr( 35, 2 ) + '1' + sort_index_bin.substr( 23, 3 ),
                    /*  6 */ '1' + sort_index_bin.substr( 30, 5 ),
                    /*  7 */ sort_index_bin.substr( 38, 6 ),
                    /*  8 */ sort_index_bin.substr( 47, 4 ) + '1' + sort_index_bin.substr( 37, 1 ),
                    /*  9 */ sort_index_bin.substr( 56, 2 ) + '1' + sort_index_bin.substr( 44, 3 ),
                    /* 10 */ '1' + sort_index_bin.substr( 51, 5 ),
                    /* 11 */ sort_index_bin.substr( 59, 5 ) + '0',
                    /* 12 */ '01101' + sort_index_bin.substr( 58, 1 ),
                    ].map( ( sexted_bin, index ) => num_to_dec64_char_map[ parseInt( sexted_bin, 2 ) ] ).reverse().join( '' );
                
                return ( is_previous ? 'HC' : 'HB' ) +  cursor + 'AAA==';
            },
            
            create_tweet_id_cursor = ( tweet_id, is_previous = false ) => convert_sort_index_to_cursor( tweet_id, is_previous ),
            create_likes_cursor = ( like_id, is_previous = false ) => convert_sort_index_to_cursor( like_id, is_previous ),
            
            create_bookmarks_cursor = ( bookmark_id, is_previous = false ) => {
                let sort_index_bin = ( '0'.repeat( 64 ) + to_binary( new Decimal( bookmark_id ).add( ( is_previous ? -1 : 1 ) * ( 2 ** 8 ) ) ) ).slice( -64 ),
                    cursor = [
                    /*  0 */ sort_index_bin.substr( 5, 4 ) + '00',
                    /*  1 */ sort_index_bin.substr( 14, 2 ) + sort_index_bin.substr( 1, 4 ),
                    /*  2 */ '1' + sort_index_bin.substr( 9, 5 ),
                    /*  3 */ sort_index_bin.substr( 17, 6 ),
                    /*  4 */ sort_index_bin.substr( 26, 4 ) + '1' + sort_index_bin.substr( 16, 1 ),
                    /*  5 */ sort_index_bin.substr( 35, 2 ) + '1' + sort_index_bin.substr( 23, 3 ),
                    /*  6 */ '1' + sort_index_bin.substr( 30, 5 ),
                    /*  7 */ sort_index_bin.substr( 38, 6 ),
                    /*  8 */ sort_index_bin.substr( 47, 4 ) + '1' + sort_index_bin.substr( 37, 1 ),
                    /*  9 */ '001' + sort_index_bin.substr( 44, 3 ),
                    ///* 10 */ '1' + ( '0'.repeat( 5 ) + ( parseInt( sort_index_bin.substr( 51, 5 ), 2 ) +  ( is_previous ? -1 : 1 ) ).toString( 2 ) ).slice( -5 ),
                    /* 10 */ '1' + sort_index_bin.substr( 51, 5 ),
                    /* 11 */ '000000',
                    /* 12 */ '011010',
                    ].map( ( sexted_bin, index ) => num_to_dec64_char_map[ parseInt( sexted_bin, 2 ) ] ).reverse().join( '' );
                
                return ( is_previous ? 'HC' : 'HB' ) +  cursor + 'AAA==';
            };
        
        return {
            convert_sort_index_to_cursor,
            create_tweet_id_cursor,
            create_likes_cursor,
            create_bookmarks_cursor,
        };
    } )(),
    
    wait = async ( wait_msec ) => {
        if ( wait_msec <= 0 ) {
            wait_msec = 1;
        }
        await new Promise( ( resolve, reject ) => {
            setTimeout( () => {
                resolve();
            }, wait_msec );
        } ).catch( error => null );
    }, // end of wait()
    
    TIMELINE_TYPE = {
        unknown : null,
        user : 'user',
        media : 'media',
        search : 'search',
        notifications : 'notifications',
        likes : 'likes',
        likes_legacy : 'likes_legacy',
        bookmarks : 'bookmarks',
    },
    
    API_TYPE_IN_USE = {
        same_as_timeline_type : null,
        search : TIMELINE_TYPE.search,
    },
    
    TIMELINE_STATUS = {
        unknown : null,
        init : 'init',
        search : 'search',
        end : 'end',
        stop : 'stop',
        error : 'error',
    },
    
    REACTION_TYPE = {
        unknown : null,
        none : 'none',
        retweet : 'retweet',
        like : 'like',
        bookmark : 'bookmark',
        //notice : 'notice',
        mention : 'mention',
        reply : 'reply',
        quote : 'quote',
        follow : 'follow',
        message : 'message',
        other_notice : 'other_notice',
    },
    
    MEDIA_TYPE = {
        unknown : null,
        nomedia : 'nomedia',
        image : 'image',
        gif : 'gif',
        video : 'video',
    },
    
    TWITTER_API = new class {
        constructor() {
            const
                self = this;
            
            Object.assign( self, {
                API_AUTHORIZATION_BEARER : 'AAAAAAAAAAAAAAAAAAAAAF7aAAAAAAAASCiRjWvh7R5wxaKkFp7MM%2BhYBqM%3DbQ0JPmjU9F6ZoMhDfI4uTNAaQuTDm2uO9x3WFVr2xBZ2nhjdP0',
                API2_AUTHORIZATION_BEARER : 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
                // TODO: 継続して使えるかどうか不明→変更された場合の対応を要検討
                // ※ https://abs.twimg.com/responsive-web/client-web/main.<version>.js (例：https://abs.twimg.com/responsive-web/client-web/main.1b19a825.js) 内で定義されている値
                // ※ これを使用しても、一定時間内のリクエスト回数に制限有り→参考: [TwitterのAPI制限 [2019/11/17現在] - Qiita](https://qiita.com/mpyw/items/32d44a063389236c0a65)
                
                // Twitter API には Rate Limit があるため、続けてコールする際に待ち時間を挟む必要あり（15分毎にリセットされる）
                // - statuses/user_timeline 等の場合、900回/15分
                // - activity/about_me、timeline/favorites、timeline/media等の場合、180回/15分
                // - favorites/list 等の場合、75回/15分
                // - timeline/bookmark 等の場合、1000回/15分
                TWITTER_API_DELAY_SHORT : ( ( 15 * 60 ) / 900 + 1 ) * 1000,
                TWITTER_API_DELAY_LONG : ( ( 15 * 60 ) / 180 + 1 ) * 1000,
                TWITTER_API_DELAY_VERY_LONG : ( ( 15 * 60 ) / 75 + 1 ) * 1000,
                // TODO: 別のタブで並列して実行されている場合や、別ブラウザでの実行は考慮していない
            } );
            
            Object.assign( self, {
                API_DEFINITIONS : {
                    [ TIMELINE_TYPE.user ] : {
                        url_template : 'https://api.twitter.com/1.1/statuses/user_timeline.json?count=#COUNT#&include_my_retweet=1&include_rts=1&cards_platform=Web-13&include_entities=1&include_user_entities=1&include_cards=1&send_error_codes=1&tweet_mode=extended&include_ext_alt_text=true&include_reply_count=true',
                        tweet_number : { default : 20, limit : 200 },
                        min_delay_ms : self.TWITTER_API_DELAY_SHORT,
                        max_retry : 3,
                    },
                    
                    [ TIMELINE_TYPE.media ] : {
                        url_template : 'https://api.twitter.com/2/timeline/media/#USER_ID#.json?include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&skip_status=1&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_entities=true&include_user_entities=true&include_ext_media_color=true&include_ext_media_availability=true&send_error_codes=true&simple_quoted_tweet=true&count=#COUNT#&ext=mediaStats%2ChighlightedLabel',
                        tweet_number : { default : 20, limit : 40 },
                        min_delay_ms : self.TWITTER_API_DELAY_LONG,
                        max_retry : 3,
                    },
                    
                    [ TIMELINE_TYPE.search ] : {
                        url_template : 'https://api.twitter.com/1.1/search/universal.json?q=#QUERY#&count=#COUNT#&modules=status&result_type=recent&pc=false&cards_platform=Web-13&include_entities=1&include_user_entities=1&include_cards=1&send_error_codes=1&tweet_mode=extended&include_ext_alt_text=true&include_reply_count=true',
                        tweet_number : { default : 20, limit : 100 },
                        min_delay_ms : self.TWITTER_API_DELAY_SHORT,
                        max_retry : 3,
                        max_retry_if_empty_result: 10,
                    },
                    
                    [ TIMELINE_TYPE.notifications ] : {
                        url_template : 'https://api.twitter.com/1.1/activity/about_me.json?model_version=7&count=#COUNT#&skip_aggregation=true&cards_platform=Web-13&include_entities=1&include_user_entities=1&include_cards=1&send_error_codes=1&tweet_mode=extended&include_ext_alt_text=true&include_reply_count=true',
                        tweet_number : { default : 20, limit : 200 },
                        min_delay_ms : self.TWITTER_API_DELAY_LONG,
                        max_retry : 3,
                    },
                    
                    [ TIMELINE_TYPE.likes_legacy ] : {
                        url_template : 'https://api.twitter.com/1.1/favorites/list.json?count=#COUNT#&include_my_retweet=1&cards_platform=Web-13&include_entities=1&include_user_entities=1&include_cards=1&send_error_codes=1&tweet_mode=extended&include_ext_alt_text=true&include_reply_count=true',
                        tweet_number : { default : 20, limit : 200 },
                        min_delay_ms : self.TWITTER_API_DELAY_VERY_LONG,
                        max_retry : 3,
                    },
                    
                    [ TIMELINE_TYPE.likes ] : {
                        url_template : 'https://api.twitter.com/2/timeline/favorites/#USER_ID#.json?include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&skip_status=1&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_entities=true&include_user_entities=true&include_ext_media_color=true&include_ext_media_availability=true&send_error_codes=true&simple_quoted_tweet=true&sorted_by_time=true&count=#COUNT#&ext=mediaStats%2ChighlightedLabel',
                        tweet_number : { default : 20, limit : 40 },
                        min_delay_ms : self.TWITTER_API_DELAY_LONG,
                        max_retry : 3,
                    },
                    
                    [ TIMELINE_TYPE.bookmarks ] : {
                        url_template : 'https://api.twitter.com/2/timeline/bookmark.json?include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&skip_status=1&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_entities=true&include_user_entities=true&include_ext_media_color=true&include_ext_media_availability=true&send_error_codes=true&simple_quoted_tweet=true&count=#COUNT#&ext=mediaStats%2ChighlightedLabel',
                        tweet_number : { default : 20, limit : 40 },
                        min_delay_ms : self.TWITTER_API_DELAY_SHORT,
                        max_retry : 3,
                    },
                }
            } );
            
            Object.assign( self, {
                language : '',
                api_called_infos : Object.keys( TIMELINE_TYPE ).reduce( ( api_called_infos, type ) => ( api_called_infos[ TIMELINE_TYPE[ type ] ] = { count : 0, last_time_msec : 0, last_error : null } ) &&  api_called_infos, {} ),
            } );
            
            return self;
        } // end of constructor()
        
        async fetch_user_timeline( user_id, screen_name, max_id, count ) {
            const
                self = this,
                timeline_type = TIMELINE_TYPE.user,
                api_def = self.API_DEFINITIONS[ timeline_type ];
            
            if ( isNaN( count ) || ( count < 0 ) || ( api_def.tweet_number.limit < count ) ) {
                count = api_def.tweet_number.default;
            }
            
            let api_url = ( api_def.url_template + ( ( user_id ) ? '&user_id=' + encodeURIComponent( user_id ) : '&screen_name=' + encodeURIComponent( screen_name ) ) )
                    .replace( /#COUNT#/g, count ) + ( /^\d+$/.test( max_id || '' ) ? '&max_id=' + max_id : '' );
            
            return await self.fetch_timeline_common( timeline_type, api_url );
        } // end of fetch_user_timeline()
        
        async fetch_search_timeline( query, count ) {
            const
                self = this,
                timeline_type = TIMELINE_TYPE.search,
                api_def = self.API_DEFINITIONS[ timeline_type ];
            
            if ( isNaN( count ) || ( count < 0 ) || ( api_def.tweet_number.limit < count ) ) {
                count = api_def.tweet_number.default;
            }
            
            let api_url = api_def.url_template.replace( /#QUERY#/g, encodeURIComponent( query ) ).replace( /#COUNT#/g, count );
            
            return await self.fetch_timeline_common( timeline_type, api_url );
        } // end of fetch_search_timeline()
        
        async fetch_notifications_timeline( max_id, count ) {
            const
                self = this,
                timeline_type = TIMELINE_TYPE.notifications,
                api_def = self.API_DEFINITIONS[ timeline_type ];
            
            if ( isNaN( count ) || ( count < 0 ) || ( api_def.tweet_number.limit < count ) ) {
                count = api_def.tweet_number.default;
            }
            
            let api_url = api_def.url_template.replace( /#COUNT#/g, count ) + ( /^\d+$/.test( max_id || '' ) ? '&max_id=' + max_id : '' );
            
            return await self.fetch_timeline_common( timeline_type, api_url );
        } // end of fetch_notifications_timeline()
        
        async fetch_likes_legacy_timeline( user_id, screen_name, max_id, count ) {
            const
                self = this,
                timeline_type = TIMELINE_TYPE.likes_legacy,
                api_def = self.API_DEFINITIONS[ timeline_type ];
            
            if ( isNaN( count ) || ( count < 0 ) || ( api_def.tweet_number.limit < count ) ) {
                count = api_def.tweet_number.default;
            }
            
            let api_url = ( api_def.url_template + ( ( user_id ) ? '&user_id=' + encodeURIComponent( user_id ) : '&screen_name=' + encodeURIComponent( screen_name ) ) )
                .replace( /#COUNT#/g, count ) + ( /^\d+$/.test( max_id || '' ) ? '&max_id=' + max_id : '' );
            
            return await self.fetch_timeline_common( timeline_type, api_url );
        } // end of fetch_likes_legacy_timeline()
        
        async fetch_likes_timeline( user_id, cursor, count ) {
            const
                self = this,
                timeline_type = TIMELINE_TYPE.likes,
                api_def = self.API_DEFINITIONS[ timeline_type ];
            
            if ( isNaN( count ) || ( count < 0 ) || ( api_def.tweet_number.limit < count ) ) {
                count = api_def.tweet_number.default;
            }
            
            let api_url = api_def.url_template.replace( /#USER_ID#/g, user_id ).replace( /#COUNT#/g, count ) + ( cursor  ? '&cursor=' + encodeURIComponent( cursor ) : '' );
            
            return await self.fetch_timeline_common( timeline_type, api_url );
        } // end of fetch_likes_timeline()
        
        async fetch_bookmarks_timeline( cursor, count ) {
            const
                self = this,
                timeline_type = TIMELINE_TYPE.bookmarks,
                api_def = self.API_DEFINITIONS[ timeline_type ];
            
            if ( isNaN( count ) || ( count < 0 ) || ( api_def.tweet_number.limit < count ) ) {
                count = api_def.tweet_number.default;
            }
            
            let api_url = api_def.url_template.replace( /#COUNT#/g, count ) + ( cursor  ? '&cursor=' + encodeURIComponent( cursor ) : '' );
            
            return await self.fetch_timeline_common( timeline_type, api_url );
        } // end of fetch_bookmarks_timeline()
        
        async fetch_media_timeline( user_id, cursor, count ) {
            const
                self = this,
                timeline_type = TIMELINE_TYPE.media,
                api_def = self.API_DEFINITIONS[ timeline_type ];
            
            if ( isNaN( count ) || ( count < 0 ) || ( api_def.tweet_number.limit < count ) ) {
                count = api_def.tweet_number.default;
            }
            
            let api_url = api_def.url_template.replace( /#USER_ID#/g, user_id ).replace( /#COUNT#/g, count ) + ( cursor  ? '&cursor=' + encodeURIComponent( cursor ) : '' );
            
            return await self.fetch_timeline_common( timeline_type, api_url );
        } // end of fetch_media_timeline()
        
        async fetch_timeline_common( timeline_type, url, options ) {
            const
                self = this,
                api_def = self.API_DEFINITIONS[ timeline_type ],
                api_called_info = self.api_called_infos[ timeline_type ];
            
            let wait_msec = self.get_remain_time_msec_until_next_call( timeline_type ),
                retry_number = 0,
                result;
            
            log_debug( 'fetch_timeline_common(): ', timeline_type, url, options );
            log_debug( 'wait_msec:', wait_msec, '(before) api_def:', api_def, 'api_called_info:', api_called_info );
            
            do {
                await wait( ( retry_number <= 0 ) ? wait_msec : ( self.TWITTER_API_DELAY_VERY_LONG * retry_number ) );
                
                api_called_info.count ++;
                api_called_info.last_time_msec = Date.now();
                
                log_debug( 'retry_number:', retry_number, 'api_def:', api_def, 'api_called_info:', api_called_info );
                
                api_called_info.last_error = null;
                
                result = await self.fetch_json( url, options );
                
                api_called_info.last_error = result.error;
                
                if ( ( ! result.error ) && result.json ) {
                    break;
                }
                
                retry_number ++;
            } while ( api_def.max_retry && ( retry_number <= api_def.max_retry ) );
            
            log_debug( 'fetched result:', result );
            
            return result.json;
        } // end of fetch_timeline_common()
        
        async get_user_info( parameters ) {
            const
                self = this;
            
            log_debug( 'get_user_info() called:', parameters );
            
            parameters = parameters || {};
            
            let user_id = parameters.user_id,
                screen_name = parameters.screen_name;
            
            if ( ( ! user_id ) && ( ! screen_name ) ) {
                return { error : 'Illegal parameters' };
            }
            
            let api_url = 'https://api.twitter.com/1.1/users/show.json?' + ( user_id ? 'user_id=' + encodeURIComponent( user_id ) : 'screen_name=' + encodeURIComponent( screen_name ) ),
                result = await self.fetch_json( api_url ).catch( ( error ) => {
                    return { error : error };
                } );
             
            log_debug( 'get_user_info() result:', result );
            
            if ( result.error || ( ! result.json ) ) {
                log_error( 'get_user_info() error:', result );
                return null;
            }
            
             return result.json;
        } // end of get_user_info()
        
        async fetch_json( url, options ) {
            const
                self = this;
            
            options = Object.assign( {
                method : 'GET',
                headers : self.create_api_header( url ),
                mode : 'cors',
                credentials : 'include',
            }, options || {} );
            
            let result;
            
            if ( IS_WEB_EXTENSION && browser && ( ! IS_FIREFOX ) ) {
                /*
                // 注意：[Firefox でコンテナーを使用している場合、background 経由だと動作しない（403 Forbidden発生）](https://twitter.com/furyutei/status/1295057562870546433)
                */
                
                /*
                // fetch() を使用した場合、Chrome において戻り値が null になる→レスポンスボディが空のため、response.json() でエラーが発生
                // > Cross-Origin Read Blocking (CORB) blocked cross-origin response <url> with MIME type application/json. See https://www.chromestatus.com/feature/5629709824032768 for more details.
                //
                // 参考：
                //   [Changes to Cross-Origin Requests in Chrome Extension Content Scripts - The Chromium Projects](https://www.chromium.org/Home/chromium-security/extension-content-script-fetches)
                //   [Cross-Origin Read Blocking (CORB) とは - ASnoKaze blog](https://asnokaze.hatenablog.com/entry/2018/04/10/205717)
                */
                result = await new Promise( ( resolve, reject ) => {
                    browser.runtime.sendMessage( {
                        type : 'FETCH_JSON',
                        url : url,
                        options : options,
                    }, ( response ) => {
                        log_debug( 'FETCH_JSON => response', response );
                        resolve( response );
                        // TODO: シークレット(incognito)モードだと、{"errors":[{"code":353,"message":"This request requires a matching csrf cookie and header."}]} のように返されてしまう
                        // → manifest.json に『"incognito" : "split"』が必要
                    } );
                } );
            }
            else {
                result = await fetch( url, options )
                    .then( response => response.json() )
                    .then( ( json ) => {
                        return { json : json };
                    } )
                    .catch( ( error ) => {
                        return { error : error };
                    } );
            }
            
            if ( result.error ) {
                log_error( 'Error in fetch_json()', url, options, result.error );
            }
            
            return result;
        } // end of fetch_json()
        
        create_api_header( api_url ) {
            const
                self = this;
            
            return {
                'authorization' : 'Bearer ' + ( ( ( api_url || '' ).indexOf( '/2/' ) < 0 ) ? self.API_AUTHORIZATION_BEARER : self.API2_AUTHORIZATION_BEARER ),
                'x-csrf-token' : self.csrf_token,
                'x-twitter-active-user' : 'yes',
                'x-twitter-auth-type' : 'OAuth2Session',
                'x-twitter-client-language' : self.client_language,
            };
        } // end of create_api_header()
        
        get client_language() {
            const
                self = this;
            
            if ( ! self.language ) {
                if ( new URL( location.href ).hostname == 'tweetdeck.twitter.com' ) {
                    self.language = ( navigator.browserLanguage || navigator.language || navigator.userLanguage ).substr( 0, 2 );
                }
                else {
                    try {
                        self.language = document.querySelector( 'html' ).getAttribute( 'lang' );
                    }
                    catch ( error ) {
                    }
                }
            }
            
            return self.language;
        } // end of get client_language()
        
        get csrf_token() {
            let csrf_token;
            
            try {
                csrf_token = document.cookie.match( /ct0=(.*?)(?:;|$)/ )[ 1 ];
            }
            catch ( error ) {
                csrf_token = null;
            }
            
            return csrf_token;
        } // end of get csrf_token()
        
        get_remain_time_msec_until_next_call( timeline_type ) {
            let remain_time_msec = this.api_called_infos[ timeline_type ].last_time_msec + ( this.API_DEFINITIONS[ timeline_type ].min_delay_ms || this.TWITTER_API_DELAY_LONG ) - Date.now();
            
            return ( 0 < remain_time_msec )? remain_time_msec : 0;
        } // end of get_remain_time_msec_until_next_call()
        
        definition( timeline_type ) {
            return this.API_DEFINITIONS[ timeline_type ] || {};
        } // end of definition()
        
        called_info( timeline_type ) {
            return this.api_called_infos[ timeline_type ] || {};
        } // end of called_info()
    }, // end of TWITTER_API
    
    TIMELINE_TOOLBOX = new class {
        constructor() {
            const
                self = this;
            
            return self;
        } // end of constructor()
        
        async get_user_timeline_info( options ) {
            const
                self = this;
            
            log_debug( 'get_user_timeline_info() called', options );
            
            if ( ! options ) {
                options = {};
            }
            
            let user_id = options.user_id,
                screen_name = options.screen_name,
                max_id = options.max_id,
                count = options.count,
                json = await TWITTER_API.fetch_user_timeline( user_id, screen_name, max_id, count ).catch( ( error ) => {
                    log_error( 'TWITTER_API.fetch_user_timeline() error:', error );
                    return null;
                } );
            
            if ( ! json ) {
                return {
                    json : null,
                    error : 'fetch error',
                };
            }
            
            log_debug( 'get_user_timeline_info(): json=', json, Array.isArray( json ) );
            
            let tweets = json;
            
            if ( ! Array.isArray( tweets ) ) {
                return {
                    json : json,
                    error : 'result JSON structure error',
                };
            }
            
            let tweet_info_list = tweets.map( tweet => self.get_tweet_info_from_tweet_status( tweet ) );
            
            log_debug( 'get_user_timeline_info(): tweet_info_list:', tweet_info_list );
            
            return {
                json : json,
                timeline_info : {
                    tweet_info_list : tweet_info_list,
                }
            };
        } // end of get_user_timeline_info()
        
        async get_search_timeline_info( query, options ) {
            const
                self = this;
            
            log_debug( 'get_search_timeline_info() called', query, options );
            
            if ( ! options ) {
                options = {};
            }
            
            let count = options.count,
                max_retry_if_empty_result = options.max_retry_if_empty_result || TWITTER_API.API_DEFINITIONS[ TIMELINE_TYPE.search ].max_retry_if_empty_result, // TODO: Twitter側の問題で検索条件に合致するツイートが存在するにも関わらず結果が0で返ることがある→暫定的にリトライすることで対処
                original_delay_min_delay_ms = TWITTER_API.API_DEFINITIONS[ TIMELINE_TYPE.search ].min_delay_ms,
                json,
                tweet_info_list = [];
            
            for (let retry_count=0; retry_count <= max_retry_if_empty_result; retry_count++) {
                if (0 < retry_count) {
                    TWITTER_API.API_DEFINITIONS[ TIMELINE_TYPE.search ].min_delay_ms = TWITTER_API.TWITTER_API_DELAY_SHORT; // 外部から間隔が調整されている場合でも、リトライ時には本来の間隔に戻す
                }
                json  = await TWITTER_API.fetch_search_timeline( query, count ).catch( ( error ) => {
                    log_error( 'TWITTER_API.fetch_user_timeline() error:', error );
                    return null;
                } );
                TWITTER_API.API_DEFINITIONS[ TIMELINE_TYPE.search ].min_delay_ms = original_delay_min_delay_ms;
                
                if ( ! json ) {
                    return {
                        json : null,
                        error : 'fetch error',
                    };
                }
                
                log_debug( 'get_search_timeline_info(): json=', json );
                
                let modules = json.modules;
                
                if ( ! Array.isArray( modules ) ) {
                    return {
                        json : json,
                        error : 'result JSON structure error',
                    };
                }
                
                if ( modules.length < 1 ) {
                    log_debug( `get_search_timeline_info(): retry_count=${retry_count} => modules.length=${modules.length}, json=`, json );
                    continue;
                }
                
                tweet_info_list = modules.map( ( module ) => {
                    let tweet;
                    
                    try {
                        tweet = module.status.data;
                        tweet.metadata = module.status.metadata;
                    }
                    catch ( error ) {
                        return null;
                    }
                    
                    return self.get_tweet_info_from_tweet_status( tweet );
                } ).filter( tweet_info => tweet_info );
                
                break;
            }
            
            return  {
                json : json,
                timeline_info : {
                    tweet_info_list : tweet_info_list,
                }
            };
        } // end of get_search_timeline_info()
        
        async get_notifications_timeline_info( options ) {
            const
                self = this;
            
            log_debug( 'get_notifications_timeline_info() called', options );
            
            if ( ! options ) {
                options = {};
            }
            
            let max_id = options.max_id, // 注：この max_id はツイートIDではなくUNIX時間（ミリ秒）であることに注意
                count = options.count,
                json = await TWITTER_API.fetch_notifications_timeline( max_id, count ).catch( ( error ) => {
                    log_error( 'TWITTER_API.fetch_notifications_timeline() error:', error );
                    return null;
                } );
            
            if ( ! json ) {
                return {
                    json : null,
                    error : 'fetch error',
                };
            }
            
            log_debug( 'get_notifications_timeline_info(): json=', json, Array.isArray( json ) );
            
            let notifications = json;
            
            if ( ! Array.isArray( notifications ) ) {
                return {
                    json : json,
                    error : 'result JSON structure error',
                };
            }
            
            let max_position = ( 0 < notifications.length ) ? notifications[ 0 ].max_position : 0,
                min_position = ( 0 < notifications.length ) ? notifications[ notifications.length - 1 ].min_position : 0,
                tweet_info_list = notifications
                    .filter( notification => [ 'reply', 'mention', 'quote' ].includes( notification.action ) )
                    .map( notification => self.get_tweet_info_from_notification_status( notification ) );
            
            log_debug( 'get_notifications_timeline_info(): tweet_info_list:', tweet_info_list, 'max_position:',  max_position, 'min_position:', min_position );
            
            return {
                json : json,
                timeline_info : {
                    max_position : max_position,
                    min_position : min_position,
                    tweet_info_list : tweet_info_list,
                }
            };
        } // end of get_notifications_timeline_info()
        
        async get_likes_legacy_timeline_info( options ) {
            const
                self = this;
            
            log_debug( 'get_likes_legacy_timeline_info() called', options );
            
            if ( ! options ) {
                options = {};
            }
            
            let user_id = options.user_id,
                screen_name = options.screen_name,
                max_id = options.max_id,
                count = options.count,
                json = await TWITTER_API.fetch_likes_legacy_timeline( user_id, screen_name, max_id, count ).catch( ( error ) => {
                    log_error( 'TWITTER_API.fetch_likes_legacy_timeline() error:', error );
                    return null;
                } );
            
            if ( ! json ) {
                return {
                    json : null,
                    error : 'fetch error',
                };
            }
            
            log_debug( 'get_likes_legacy_timeline_info(): json=', json, Array.isArray( json ) );
            
            let tweets = json;
            
            if ( ! Array.isArray( tweets ) ) {
                return {
                    json : json,
                    error : 'result JSON structure error',
                };
            }
            
            let tweet_info_list = tweets.map( tweet => self.get_tweet_info_from_tweet_status( tweet ) );
            
            log_debug( 'get_likes_legacy_timeline_info(): tweet_info_list:', tweet_info_list );
            
            return {
                json : json,
                timeline_info : {
                    tweet_info_list : tweet_info_list,
                }
            };
        } // end of get_likes_legacy_timeline_info()
        
        async get_likes_timeline_info( options ) {
            const
                self = this;
            
            log_debug( 'get_likes_timeline_info() called', options );
            
            if ( ! options ) {
                options = {};
            }
            
            let user_id = options.user_id,
                screen_name = options.screen_name,
                user_name = options.user_name,
                user_icon = options.user_icon,
                cursor = options.cursor,
                count = options.count,
                json = await TWITTER_API.fetch_likes_timeline( user_id, cursor, count ).catch( ( error ) => {
                    log_error( 'TWITTER_API.fetch_likes_timeline() error:', error );
                    return null;
                } );
            
            if ( ! json ) {
                return {
                    json : null,
                    error : 'fetch error',
                };
            }
            
            log_debug( 'get_likes_timeline_info(): json=', json );
            
            if ( ( ! json.globalObjects ) || ( ! json.timeline ) ) {
                return {
                    json : json,
                    error : json.errors,
                };
            }
            
            let tweet_status_map = json.globalObjects.tweets,
                user_map = json.globalObjects.users,
                entries = json.timeline.instructions[0].addEntries.entries,
                cursor_info = {},
                tweet_info_list = [];
            
            entries.map( ( entry ) => {
                let id = entry.sortIndex,
                    date = convert_like_id_to_date( id ),
                    datetime = format_date( date, 'YYYY/MM/DD hh:mm:ss' ),
                    timestamp_ms = date.getTime();
                
                if ( entry.entryId.match( /^cursor-(top|bottom)-(\d+)$/ ) ) {
                    cursor_info[ RegExp.$1 ] = {
                        id,
                        timestamp_ms,
                        date,
                        datetime,
                        cursor : entry.content.operation.cursor,
                    };
                    return;
                }
                
                if ( ! entry.entryId.match( /^tweet-(\d+)$/ ) ) {
                    return;
                }
                
                let tweet_id = entry.content.item.content.tweet.id,
                    tweet_status = tweet_status_map[ tweet_id ];
                
                if ( ! tweet_status ) {
                    // 既に削除されたツイートのIDが入ってくる場合がある模様
                    log_info( 'Tweet information not found: tweet_id=', tweet_id );
                    return;
                }
                
                let user = tweet_status.user = user_map[ tweet_status.user_id_str ],
                    reacted_info = self.get_tweet_info_from_tweet_status( tweet_status );
                
                reacted_info.type = REACTION_TYPE.like;
                
                let tweet_info = {
                        id,
                        user_id,
                        timestamp_ms,
                        date,
                        datetime,
                        entry,
                        reacted_info,
                    };
                
                tweet_info_list.push( tweet_info );
            } );
            
            log_debug( 'get_likes_timeline_info(): tweet_info_list:', tweet_info_list, 'cursor_info:', cursor_info );
            
            return {
                json : json,
                timeline_info : {
                    cursor_info : cursor_info,
                    tweet_info_list : tweet_info_list,
                }
            };
        } // end of get_likes_timeline_info()
        
        async get_bookmarks_timeline_info( options ) {
            const
                self = this;
            
            log_debug( 'get_bookmarks_timeline_info() called', options );
            
            if ( ! options ) {
                options = {};
            }
            
            let user_id = options.user_id,
                screen_name = options.screen_name,
                user_name = options.user_name,
                user_icon = options.user_icon,
                cursor = options.cursor,
                count = options.count,
                json = await TWITTER_API.fetch_bookmarks_timeline( cursor, count ).catch( ( error ) => {
                    log_error( 'TWITTER_API.fetch_bookmarks_timeline() error:', error );
                    return null;
                } );
            
            if ( ! json ) {
                return {
                    json : null,
                    error : 'fetch error',
                };
            }
            
            log_debug( 'get_bookmarks_timeline_info(): json=', json );
            
            if ( ( ! json.globalObjects ) || ( ! json.timeline ) ) {
                return {
                    json : json,
                    error : json.errors,
                };
            }
            
            let tweet_status_map = json.globalObjects.tweets,
                user_map = json.globalObjects.users,
                entries = json.timeline.instructions[0].addEntries.entries,
                cursor_info = {},
                tweet_info_list = [];
            
            entries.map( ( entry ) => {
                let id = entry.sortIndex,
                    date = convert_bookmark_id_to_date( id ),
                    datetime = format_date( date, 'YYYY/MM/DD hh:mm:ss' ),
                    timestamp_ms = date.getTime();
                
                if ( entry.entryId.match( /^cursor-(top|bottom)-(\d+)$/ ) ) {
                    cursor_info[ RegExp.$1 ] = {
                        id,
                        timestamp_ms,
                        date,
                        datetime,
                        cursor : entry.content.operation.cursor,
                    };
                    return;
                }
                
                if ( ! entry.entryId.match( /^tweet-(\d+)$/ ) ) {
                    return;
                }
                
                let tweet_id = entry.content.item.content.tweet.id,
                    tweet_status = tweet_status_map[ tweet_id ];
                
                if ( ! tweet_status ) {
                    // 既に削除されたツイートのIDが入ってくる場合がある模様
                    log_info( 'Tweet information not found: tweet_id=', tweet_id );
                    return;
                }
                
                let user = tweet_status.user = user_map[ tweet_status.user_id_str ],
                    reacted_info = self.get_tweet_info_from_tweet_status( tweet_status );
                
                reacted_info.type = REACTION_TYPE.bookmark;
                
                let tweet_info = {
                        id,
                        user_id,
                        timestamp_ms,
                        date,
                        datetime,
                        entry,
                        reacted_info,
                    };
                
                tweet_info_list.push( tweet_info );
            } );
            
            log_debug( 'get_bookmarks_timeline_info(): tweet_info_list:', tweet_info_list, 'cursor_info:', cursor_info );
            
            return {
                json : json,
                timeline_info : {
                    cursor_info : cursor_info,
                    tweet_info_list : tweet_info_list,
                }
            };
        } // end of get_bookmarks_timeline_info()
        
        async get_media_timeline_info( options ) {
            const
                self = this;
            
            log_debug( 'get_media_timeline_info() called', options );
            
            if ( ! options ) {
                options = {};
            }
            
            let user_id = options.user_id,
                screen_name = options.screen_name,
                user_name = options.user_name,
                user_icon = options.user_icon,
                cursor = options.cursor,
                count = options.count,
                json = await TWITTER_API.fetch_media_timeline( user_id, cursor, count ).catch( ( error ) => {
                    log_error( 'TWITTER_API.fetch_media_timeline() error:', error );
                    return null;
                } );
            
            if ( ! json ) {
                return {
                    json : null,
                    error : 'fetch error',
                };
            }
            
            log_debug( 'get_media_timeline_info(): json=', json );
            
            if ( ( ! json.globalObjects ) || ( ! json.timeline ) ) {
                return {
                    json : json,
                    error : json.errors,
                };
            }
            
            let tweet_status_map = json.globalObjects.tweets,
                user_map = json.globalObjects.users,
                entries = json.timeline.instructions[0].addEntries.entries,
                cursor_info = {},
                tweet_info_list = [];
            
            entries.map( ( entry ) => {
                let id = entry.sortIndex,
                    date = convert_like_id_to_date( id ),
                    datetime = format_date( date, 'YYYY/MM/DD hh:mm:ss' ),
                    timestamp_ms = date.getTime();
                
                if ( entry.entryId.match( /^cursor-(top|bottom)-(\d+)$/ ) ) {
                    cursor_info[ RegExp.$1 ] = {
                        id,
                        timestamp_ms,
                        date,
                        datetime,
                        cursor : entry.content.operation.cursor,
                    };
                    return;
                }
                
                if ( ! entry.entryId.match( /^tweet-(\d+)$/ ) ) {
                    return;
                }
                
                let tweet_id = entry.content.item.content.tweet.id,
                    tweet_status = tweet_status_map[ tweet_id ];
                
                if ( ! tweet_status ) {
                    // 既に削除されたツイートのIDが入ってくる場合がある模様
                    log_info( 'Tweet information not found: tweet_id=', tweet_id );
                    return;
                }
                
                let user = tweet_status.user = user_map[ tweet_status.user_id_str ],
                    tweet_info = self.get_tweet_info_from_tweet_status( tweet_status );
                
                tweet_info_list.push( tweet_info );
            } );
            
            log_debug( 'get_media_timeline_info(): tweet_info_list:', tweet_info_list, 'cursor_info:', cursor_info );
            
            return {
                json : json,
                timeline_info : {
                    cursor_info : cursor_info,
                    tweet_info_list : tweet_info_list,
                }
            };
        } // end of get_media_timeline_info()
        
        get_tweet_info_from_tweet_status( tweet_status ) {
            const
                self = this;
            
            let tweet_info = self.get_basic_tweet_info( tweet_status ),
                
                reacted_info = ( () => {
                    let retweeted_status = tweet_status.retweeted_status || {};
                    
                    if ( ! retweeted_status.id_str ) {
                        return {
                            type : REACTION_TYPE.none,
                        }
                    }
                    
                    let reacted_tweet_info = self.get_basic_tweet_info( retweeted_status );
                    
                    reacted_tweet_info.type = REACTION_TYPE.retweet;
                    
                    return reacted_tweet_info;
                } )();
            
            Object.assign( tweet_info, {
                type : REACTION_TYPE.none,
                reacted_info,
            } );
            
            log_debug( 'get_tweet_info_from_tweet_status(): tweet_info', tweet_info );
            
            return tweet_info;
        } // end of get_tweet_info_from_tweet_status();
        
        get_tweet_info_from_notification_status( notification_status ) {
            const
                self = this;
            
            let tweet_info = {
                    type : REACTION_TYPE.none,
                },
                reacted_info = {
                    type : REACTION_TYPE.unknown,
                };
            
            switch ( notification_status.action ) {
                case 'reply' : {
                        tweet_info = self.get_basic_tweet_info( notification_status.targets[ 0 ] );
                        reacted_info = self.get_basic_tweet_info( notification_status.target_objects[ 0 ] );
                        reacted_info.type = REACTION_TYPE.reply;
                    }
                    break;
                
                case 'mention' : {
                        tweet_info = self.get_basic_tweet_info( notification_status.target_objects[ 0 ] );
                        // ユーザー宛なので対象ツイートはなし
                        reacted_info.type = REACTION_TYPE.mention;
                    }
                    break;
                
                case 'quote' : {
                        tweet_info = self.get_basic_tweet_info( notification_status.targets[ 0 ] );
                        reacted_info = self.get_basic_tweet_info( notification_status.target_objects[ 0 ] );
                        reacted_info.type = REACTION_TYPE.quote;
                    }
                    break;
            }
            
            Object.assign( tweet_info, {
                type : REACTION_TYPE.none,
                reacted_info,
                notification_status, // ※確認用に元のステータスも保存
            } );
            
            log_debug( 'get_tweet_info_from_notification_status(): tweet_info', tweet_info );
            
            return tweet_info;
        } // end of get_tweet_info_from_notification_status()
        
        get_basic_tweet_info( tweet_status ) {
            const
                self = this;
            
            tweet_status = tweet_status || {};
            
            let tweet_info = {
                    type : REACTION_TYPE.unknown,
                    tweet_status, // ※確認用に元のステータスも保存
                };
            
            if ( ! tweet_status.id_str ) {
                return tweet_info;
            }
            
            try {
                let user = tweet_status.user,
                    timestamp_ms = Date.parse( tweet_status.created_at ),
                    date = new Date( timestamp_ms ),
                    datetime = format_date( date, 'YYYY/MM/DD hh:mm:ss' ),
                    media_list = self.get_media_list_from_tweet_status( tweet_status );
                
                Object.assign( tweet_info, {
                    id : tweet_status.id_str,
                    user_id : user.id_str,
                    screen_name : user.screen_name,
                    user_name : user.name,
                    user_icon : user.profile_image_url_https,
                    timestamp_ms,
                    date,
                    datetime,
                    //text : tweet_status.full_text,
                    text : self.convert_tweet_text_from_tweet_status( tweet_status ),
                    media_type : ( 0 < media_list.length ) ? media_list[ 0 ].media_type : MEDIA_TYPE.nomedia,
                    media_list,
                    reply_count : tweet_status.reply_count,
                    retweet_count : tweet_status.retweet_count,
                    like_count : tweet_status.favorite_count,
                    tweet_url : 'https://twitter.com/' + user.screen_name + '/status/' + tweet_status.id_str,
                } );
            }
            catch ( error ) {
                log_error( 'Unexpected format:', tweet_status, error );
            }
            
            return tweet_info;
        } // end of get_basic_tweet_info()
        
        convert_tweet_text_from_tweet_status( tweet_status ) {
            let tweet_text = tweet_status.full_text;
            
            try {
                let tweet_parts = Array.from( tweet_text ),
                    url_infos = ( tweet_status.entities || {} ).urls || [];
                
                url_infos.map( ( url_info ) => {
                    tweet_parts[ url_info.indices[ 0 ] ] = url_info.expanded_url;
                    for ( let index = url_info.indices[ 0 ] + 1; index < url_info.indices[ 1 ]; index ++ ) {
                        tweet_parts[ index ] = '';
                    }
                } );
                tweet_text = tweet_parts.join( '' );
            }
            catch ( error ) {
                log_debug( 'failed to convert the tweet text:', error, tweet_status );
            }
            return tweet_text;
        } // end of convert_tweet_text_from_tweet_status()
        
        get_media_list_from_tweet_status( tweet_status ) {
            let source_media_infos = [];
            
            if ( tweet_status.extended_entities && tweet_status.extended_entities.media ) {
                source_media_infos = tweet_status.extended_entities.media;
            }
            else if ( tweet_status.entities && tweet_status.entities.media ) {
                source_media_infos = tweet_status.entities.media;
            }
            else {
                try {
                    let unified_card_info = JSON.parse( tweet_status.card.binding_values.unified_card.string_value );
                    
                    source_media_infos = [ unified_card_info.media_entities[ unified_card_info.component_objects.media_1.data.id ] ];
                }
                catch ( error ) {
                    source_media_infos = [];
                }
            }
            
            return source_media_infos.map( ( source_media_info ) => {
                let media_type = MEDIA_TYPE.unknown,
                    media_url = null,
                    get_max_bitrate_video_info = ( video_infos ) => {
                        return video_infos.filter( video_info => video_info.content_type == 'video/mp4' ).reduce( ( video_info_max_bitrate, video_info ) => {
                            return ( video_info_max_bitrate.bitrate < video_info.bitrate ) ? video_info : video_info_max_bitrate;
                        }, { bitrate : -1 } );
                    };
                
                switch ( source_media_info.type ) {
                    case 'photo' :
                        media_type = MEDIA_TYPE.image;
                        try {
                            media_url = source_media_info.media_url_https.replace( /\.([^.]+)$/, '?format=$1&name=orig' );
                        }
                        catch ( error ) {
                        }
                        break;
                    
                    case 'animated_gif' :
                        media_type = MEDIA_TYPE.gif;
                        media_url = get_max_bitrate_video_info( ( source_media_info.video_info || {} ).variants || [] ).url;
                        break;
                    
                    case 'video' :
                        media_type = MEDIA_TYPE.video;
                        media_url = get_max_bitrate_video_info( ( source_media_info.video_info || {} ).variants || [] ).url;
                        break;
                }
                
                return {
                    media_type,
                    media_url,
                };
            } ).filter( media => ( media.media_type != MEDIA_TYPE.unknown ) && ( media.media_url ) );
        } // end of get_media_list_from_tweet_status()
        
    }, // end of TIMELINE_TOOLBOX()
    
    ClassTimelineTemplate = class {
        constructor( parameters ) {
            const
                self = this;
            
            self.parameters = parameters || {};
            
            self.timeline_type = TIMELINE_TYPE.unknown;
            self.api_type_in_use = API_TYPE_IN_USE.same_as_timeline_type;
            self.timeline_status = TIMELINE_STATUS.init;
            self.last_error = null;
            self.last_result = null;
            
            self.tweet_info_list = [];
            
            let max_tweet_id = self.requested_max_tweet_id = self.max_tweet_id = parameters.max_tweet_id,
                max_timestamp_ms = self.requested_max_timestamp_ms = self.max_timestamp_ms = parameters.max_timestamp_ms;
            
            if ( ( ! max_tweet_id ) && ( ! max_timestamp_ms ) ) {
                self.max_tweet_id = convert_utc_msec_to_tweet_id( Date.now() );
            }
            
            let filter_info = self.filter_info = parameters.filter_info || {},
                //  .use_media_filter : クエリ内のメディアフィルタ用コマンドを使用(true/false)
                //  .image : 画像フィルタコマンド使用(true/false)
                //  .gif : GIFフィルタコマンド使用(true/false)
                //  .video : VIDEOフィルタコマンド使用(true/false)
                //  .nomedia : メディアなしツイート含む(true/false) ※ true 時は .use_media_filter 無効
                //  .include_retweets : リツイートを含む
                filters = [];
            
            if ( filter_info.use_media_filter && ( ! filter_info.nomedia ) ) {
                if ( filter_info.image ) {
                    filters.push( 'filter:images' );
                }
                if ( filter_info.gif ) {
                    filters.push( 'card_name:animated_gif' );
                }
                if ( filter_info.video ) {
                    //filters.push( 'filter:videos' );
                    filters.push( 'filter:native_video' );
                    //filters.push( 'filter:vine' );
                }
            }
            self.filter_string = filters.join( ' OR ' );
            self.query_base = '';
            
            self.fetch_tweets_function_map = {};
            
            return self;
        } // end of constructor()
        
        stop() {
            const
                self = this;
            
            log_debug( 'stop(): update timeline_status from:', self.timeline_status, 'to:', TIMELINE_STATUS.stop );
            
            self.timeline_status = TIMELINE_STATUS.stop;
        } // end of stop()
        
        async fetch_tweet_info() {
            const
                self = this;
            
            let tweet_info = self.tweet_info_list.shift(),
                delay_time_msec = self.delay_time_msec_until_next_call;
            
            log_debug( 'fetch_tweet_info(): tweet_info=', tweet_info, 'remain count:', self.tweet_info_list.length, 'timeline status:', self.timeline_status, 'api_type_in_use:', self.api_type_in_use, 'delay_time_msec:', delay_time_msec );
            
            await wait( delay_time_msec );
            
            if ( tweet_info ) {
                return tweet_info;
            }
            
            switch ( self.timeline_status ) {
                case TIMELINE_STATUS.search :
                    break;
                
                default :
                    return null;
            }
            
            await self.fetch_tweets_function().catch( ( error ) => {
                log_error( 'fetch_tweets.call():', error );
                self.last_error = error;
                return null;
            } );
            
            tweet_info = await self.fetch_tweet_info().catch( ( error ) => {
                log_error( 'self.fetch_tweet_info():', error );
                self.timeline_status = TIMELINE_STATUS.error;
                return null;
            } );
            
            return tweet_info;
        } // end of fetch_tweet_info()
        
        set_fetch_tweets_function( timeline_type, fetch_tweets_funciton ) {
            this.fetch_tweets_function_map[ timeline_type ] = fetch_tweets_funciton;
        } // end of set_fetch_tweets_function()
        
        get fetch_tweets_function() {
            const
                self = this;
            
            let fetch_tweets_function = self.fetch_tweets_function_map[ self.current_api_type ];
            
            return fetch_tweets_function ? fetch_tweets_function : async () => { throw new Error( 'No fetch_tweets_function found for current api type: ' + self.current_api_type ); };
        } // end of get fetch_tweets_function()
        
        get search_query() {
            const
                self = this;
            
            let query = self.query_base;
            
            if ( self.max_tweet_id ) {
                query += ' max_id:' + self.max_tweet_id;
            }
            else {
                query += ' until:' + get_gmt_datetime( self.max_timestamp_ms + 1, true );
            }
            
            if ( self.filter_string ) {
                query += ' ' + self.filter_string;
            }
            
            return query;
        } // end of get search_query()
        
        get delay_time_msec_until_next_call() {
            return ( 0 < this.tweet_info_list.length ) ? TWITTER_API.get_remain_time_msec_until_next_call( this.current_api_type ) / this.tweet_info_list.length : 0;
        } // end of get delay_time_msec_until_next_call()
        
        get api_called_info() {
            return TWITTER_API.called_info( this.current_api_type );
        } // end of get api_called_info()
        
        get current_api_type() {
            return ( this.api_type_in_use == API_TYPE_IN_USE.same_as_timeline_type ) ? this.timeline_type : this.api_type_in_use;
        } // end of get current_api_type()
        
        get error_message() {
            const
                self = this,
                unknown_error = 'Unknown error';
            
            if ( self.timeline_status != TIMELINE_STATUS.error ) {
                return '';
            }
            
            let last_result = self.last_result;
            
            if ( ! last_result ) {
                return self.last_error || unknown_error;
            }
            
            if ( last_result.json && last_result.json.errors ) {
                try {
                    return ( '[API] ' + ( last_result.json.errors[ 0 ].code || 0 ) + ': ' + last_result.json.errors[ 0 ].message ) || unknown_error;
                }
                catch ( error ) {
                }
            }
            
            return last_result.error || self.last_error || unknown_error;
        } // end of get error_message()
    }, // end of class ClassTimelineTemplate
    
    ClassUserTimeline = class extends ClassTimelineTemplate {
        constructor( parameters ) {
            super( parameters );
            
            const
                self = this,
                filter_info = self.filter_info;
            
            if ( ( filter_info.image || filter_info.gif || filter_info.video ) && ( ! ( filter_info.nomedia || filter_info.include_retweets ) ) ) {
                self.timeline_type = TIMELINE_TYPE.media;
                self.set_fetch_tweets_function( self.timeline_type, self.fetch_tweets_from_media_timeline  );
            }
            else {
                self.timeline_type = TIMELINE_TYPE.user;
                self.set_fetch_tweets_function( self.timeline_type, self.fetch_tweets_from_user_timeline );
            }
            self.set_fetch_tweets_function( TIMELINE_TYPE.search, self.fetch_tweets_from_search_timeline );
            
            parameters = self.parameters;
            
            let max_tweet_id = self.max_tweet_id,
                max_timestamp_ms = self.max_timestamp_ms,
                screen_name = self.screen_name = parameters.screen_name;
            
            if ( ( ! max_tweet_id ) && ( max_timestamp_ms ) ) {
                max_tweet_id = self.max_tweet_id = convert_utc_msec_to_tweet_id( max_timestamp_ms );
                
                if ( max_tweet_id === ID_THRESHOLD ) {
                    max_tweet_id = self.max_tweet_id = null;
                }
            }
            
            if ( ! max_tweet_id ) {
                self.api_type_in_use = API_TYPE_IN_USE.search;
            }
            
            let cursor = self.cursor = parameters.cursor;
            
            if ( ( ! cursor ) && max_tweet_id ) {
                // TODO: cursor は 'HBaAwKDV1Mb19yMAAA==' のような値であり、開始時刻をどのように置き換えればよいかがわからない
                // →独自に解析し、Tweet ID→cursor 値へと変換できるように試みている
                cursor = self.cursor = create_likes_cursor( max_tweet_id );
                log_debug( 'create tweet-id cursor:', cursor, 'max_tweet_id:', max_tweet_id );
            }
            
            self.last_cursor = null;
            self.user_info = null;
            
            self.query_base = 'from:' + screen_name + ' include:retweets include:nativeretweets'
            
            self.timeline_status = TIMELINE_STATUS.search;
            
            return self;
        } // end of constructor()
        
        async fetch_tweets_from_user_timeline() {
            const
                self = this;
            
            let result = self.last_result = await TIMELINE_TOOLBOX.get_user_timeline_info( {
                    screen_name : self.screen_name,
                    max_id : self.max_tweet_id,
                    count : TWITTER_API.definition( TIMELINE_TYPE.user ).tweet_number.limit,
                } ).catch( ( error ) => {
                    log_error( 'TIMELINE_TOOLBOX.get_user_timeline_info():', error );
                    self.last_error = error;
                    return null;
                } );
            
            if ( ( ! result ) || ( ! result.timeline_info ) ) {
                log_error( 'unknown result:', result );
                self.timeline_status = TIMELINE_STATUS.error;
                return;
            }
            
            let tweet_info_list = result.timeline_info.tweet_info_list;
            
            if ( tweet_info_list.length <= 0 ) {
                self.api_type_in_use = API_TYPE_IN_USE.search;
                return;
            }
            
            self.tweet_info_list = self.tweet_info_list.concat( tweet_info_list );
            self.max_tweet_id = new Decimal( tweet_info_list[ tweet_info_list.length - 1 ].id ).sub( 1 ).toString();
        } // end of fetch_tweets_from_user_timeline()
        
        async fetch_tweets_from_media_timeline() {
            const
                self = this;
            
            let user_info = self.user_info;
            
            if ( ! user_info ) {
                user_info = self.user_info = await TWITTER_API.get_user_info( { user_id : self.user_id, screen_name : self.screen_name } );
            }
            
            self.last_cursor = self.cursor;
            
            let result = self.last_result = await TIMELINE_TOOLBOX.get_media_timeline_info( {
                    user_id : user_info.id_str,
                    screen_name : user_info.screen_name,
                    user_name : user_info.name,
                    user_icon : user_info.profile_image_url_https,
                    cursor : self.cursor,
                    count : TWITTER_API.definition( TIMELINE_TYPE.media ).tweet_number.limit,
                } ).catch( ( error ) => {
                    log_error( 'TIMELINE_TOOLBOX.get_media_timeline_info():', error );
                    self.last_error = error;
                    return null;
                } );
            
            if ( ( ! result ) || ( ! result.timeline_info ) ) {
                log_error( 'unknown result:', result );
                self.timeline_status = TIMELINE_STATUS.error;
                return;
            }
            
            let cursor_info = result.timeline_info.cursor_info,
                tweet_info_list = result.timeline_info.tweet_info_list;
            
            if ( ( tweet_info_list.length <= 0 ) || ( ! cursor_info.bottom ) ) {
                self.api_type_in_use = API_TYPE_IN_USE.search;
                return;
            }
            
            self.tweet_info_list = self.tweet_info_list.concat( tweet_info_list );
            self.max_tweet_id = new Decimal( tweet_info_list[ tweet_info_list.length - 1 ].id ).sub( 1 ).toString();
            self.cursor = cursor_info.bottom.cursor.value;
        } // end of fetch_tweets_from_media_timeline()
        
        async fetch_tweets_from_search_timeline() {
            const
                self = this;
            
            let result = self.last_result = await TIMELINE_TOOLBOX.get_search_timeline_info( self.search_query, {
                    count : TWITTER_API.definition( TIMELINE_TYPE.search ).tweet_number.limit,
                } ).catch( ( error ) => {
                    log_error( 'TIMELINE_TOOLBOX.get_search_timeline_info():', error );
                    self.last_error = error;
                    return null;
                } );
            
            if ( ( ! result ) || ( ! result.timeline_info ) ) {
                log_error( 'unknown result:', result );
                self.timeline_status = TIMELINE_STATUS.error;
                return;
            }
            
            let tweet_info_list = result.timeline_info.tweet_info_list;
            
            if ( tweet_info_list.length <= 0 ) {
                self.timeline_status = TIMELINE_STATUS.end;
                return;
            }
            
            self.tweet_info_list = self.tweet_info_list.concat( tweet_info_list );
            self.max_tweet_id = new Decimal( tweet_info_list[ tweet_info_list.length - 1 ].id ).sub( 1 ).toString();
        } // end of fetch_tweets_from_search_timeline()
    }, // end of class ClassUserTimeline
    
    ClassSearchTimeline = class extends ClassTimelineTemplate {
        constructor( parameters ) {
            super( parameters );
            
            const
                self = this;
            
            self.timeline_type = TIMELINE_TYPE.search;
            
            self.set_fetch_tweets_function( TIMELINE_TYPE.search, self.fetch_tweets_from_search_timeline );
            
            parameters = self.parameters;
            
            let max_tweet_id = self.max_tweet_id,
                max_timestamp_ms = self.max_timestamp_ms,
                filter_info = self.filter_info,
                specified_query = self.specified_query = parameters.specified_query || '',
                keep_since = self.keep_since = !! parameters.keep_since,
                query_base = specified_query;
            
            // 期間指定コマンドの削除
            query_base = query_base.replace( /-?(?:until|max_id):[^\s]+(?:\s+OR\s+)?/g, ' ' );
            if ( ! keep_since ) {
                query_base = query_base.replace( /-?(?:since|since_id):[^\s]+(?:\s+OR\s+)?/g, ' ' );
            }
            
            if ( filter_info.use_media_filter ) {
                // 本スクリプトと競合するフィルタの削除
                query_base = query_base
                    .replace( /-?filter:(?:media|periscope)(?:\s+OR\s+)?/g, ' ' )
                    .replace( /-?filter:(?:images)(?:\s+OR\s+)?/g, ' ' )
                    .replace( /-?card_name:animated_gif(?:\s+OR\s+)?/g, ' ' )
                    .replace( /-?filter:(?:videos|native_video|vine)(?:\s+OR\s+)?/g, ' ' );
            }
            
            self.query_base = query_base.replace( /\s+/g, ' ' ).trim();
            
            self.timeline_status = TIMELINE_STATUS.search;
            
            return self;
        } // end of constructor()
        
        async fetch_tweets_from_search_timeline() {
            const
                self = this;
            
            let result = self.last_result = await TIMELINE_TOOLBOX.get_search_timeline_info( self.search_query, {
                    count : TWITTER_API.definition( TIMELINE_TYPE.search ).tweet_number.limit,
                } ).catch( ( error ) => {
                    log_error( 'TIMELINE_TOOLBOX.get_search_timeline_info():', error );
                    self.last_error = error;
                    return null;
                } );
            
            if ( ( ! result ) || ( ! result.timeline_info ) ) {
                log_error( 'unknown result:', result );
                self.timeline_status = TIMELINE_STATUS.error;
                return;
            }
            let tweet_info_list = result.timeline_info.tweet_info_list;
            
            if ( tweet_info_list.length <= 0 ) {
                self.timeline_status = TIMELINE_STATUS.end;
                return;
            }
            
            self.tweet_info_list = self.tweet_info_list.concat( tweet_info_list );
            self.max_tweet_id = new Decimal( tweet_info_list[ tweet_info_list.length - 1 ].id ).sub( 1 ).toString();
        } // end of fetch_tweets_from_search_timeline()
    }, // end of class ClassSearchTimeline
    
    ClassNotificationsTimeline = class extends ClassTimelineTemplate {
        constructor( parameters ) {
            super( parameters );
            
            const
                self = this;
            
            self.timeline_type = TIMELINE_TYPE.notifications;
            
            self.set_fetch_tweets_function( TIMELINE_TYPE.notifications, self.fetch_tweets_from_notifications_timeline );
            self.set_fetch_tweets_function( TIMELINE_TYPE.search, self.fetch_tweets_from_search_timeline );
            
            parameters = self.parameters;
            
            let max_tweet_id = self.max_tweet_id,
                max_timestamp_ms = self.max_timestamp_ms,
                filter_info = self.filter_info,
                screen_name = self.screen_name = parameters.screen_name;
            
            if ( ! max_timestamp_ms ) {
                max_timestamp_ms = self.max_timestamp_ms = convert_tweet_id_to_utc_msec( max_tweet_id );
            }
            
            self.query_base = 'to:' + self.screen_name + ' -from:' + self.screen_name + ' exclude:retweets';
            
            self.timeline_status = TIMELINE_STATUS.search;
            
            return self;
        } // end of constructor()
        
        async fetch_tweets_from_notifications_timeline() {
            const
                self = this;
            
            let result = self.last_result = await TIMELINE_TOOLBOX.get_notifications_timeline_info( {
                    max_id : self.max_timestamp_ms,
                    count : TWITTER_API.definition( TIMELINE_TYPE.notifications ).tweet_number.limit,
                } ).catch( ( error ) => {
                    log_error( 'TIMELINE_TOOLBOX.get_notifications_timeline_info():', error );
                    self.last_error = error;
                    return null;
                } );
            
            if ( ( ! result ) || ( ! result.timeline_info ) ) {
                log_error( 'unknown result:', result );
                self.timeline_status = TIMELINE_STATUS.error;
                return;
            }
            
            let tweet_info_list = result.timeline_info.tweet_info_list;
            
            if ( tweet_info_list.length <= 0 ) {
                self.api_type_in_use = API_TYPE_IN_USE.search;
                self.max_tweet_id = null; // 切替後の初回はmax_timestamp_msの方を使用するためにmax_tweet_idはクリアしておく
                return;
            }
            
            self.tweet_info_list = self.tweet_info_list.concat( tweet_info_list );
            self.max_timestamp_ms = result.timeline_info.min_position - 1;
        } // end of fetch_tweets_from_notifications_timeline()
        
        async fetch_tweets_from_search_timeline() {
            const
                self = this;
            
            let result = self.last_result = await TIMELINE_TOOLBOX.get_search_timeline_info( self.search_query, {
                    count : TWITTER_API.definition( TIMELINE_TYPE.search ).tweet_number.limit,
                } ).catch( ( error ) => {
                    log_error( 'TIMELINE_TOOLBOX.get_search_timeline_info():', error );
                    self.last_error = error;
                    return null;
                } );
            
            if ( ( ! result ) || ( ! result.timeline_info ) ) {
                log_error( 'unknown result:', result );
                self.timeline_status = TIMELINE_STATUS.error;
                return;
            }
            
            let tweet_info_list = result.timeline_info.tweet_info_list;
            
            if ( tweet_info_list.length <= 0 ) {
                self.timeline_status = TIMELINE_STATUS.end;
                return;
            }
            
            self.tweet_info_list = self.tweet_info_list.concat( tweet_info_list );
            self.max_tweet_id = new Decimal( tweet_info_list[ tweet_info_list.length - 1 ].id ).sub( 1 ).toString();
        } // end of fetch_tweets_from_search_timeline()
    }, // end of class ClassNotificationsTimeline
    
    ClassLikesLegacyTimeline = class extends ClassTimelineTemplate {
        constructor( parameters ) {
            super( parameters );
            
            const
                self = this;
            
            self.timeline_type = TIMELINE_TYPE.likes_legacy;
            
            self.set_fetch_tweets_function( TIMELINE_TYPE.likes_legacy, self.fetch_tweets_from_likes_legacy_timeline );
            
            parameters = self.parameters;
            
            self.screen_name = parameters.screen_name;
            
            self.timeline_status = TIMELINE_STATUS.search;
            
            return self;
        } // end of constructor()
        
        async fetch_tweets_from_likes_legacy_timeline() {
            const
                self = this;
            
            let result = self.last_result = await TIMELINE_TOOLBOX.get_likes_legacy_timeline_info( {
                    screen_name : self.screen_name,
                    max_id : self.max_tweet_id,
                    count : TWITTER_API.definition( TIMELINE_TYPE.likes_legacy ).tweet_number.limit,
                } ).catch( ( error ) => {
                    log_error( 'TIMELINE_TOOLBOX.get_likes_legacy_timeline_info():', error );
                    self.last_error = error;
                    return null;
                } );
            
            if ( ( ! result ) || ( ! result.timeline_info ) ) {
                log_error( 'unknown result:', result );
                self.timeline_status = TIMELINE_STATUS.error;
                return;
            }
            
            let tweet_info_list = result.timeline_info.tweet_info_list;
            
            if ( tweet_info_list.length <= 0 ) {
                self.timeline_status = TIMELINE_STATUS.end;
                return;
            }
            
            self.tweet_info_list = self.tweet_info_list.concat( tweet_info_list );
            self.max_tweet_id = new Decimal( tweet_info_list[ tweet_info_list.length - 1 ].id ).sub( 1 ).toString();
        } // end of fetch_tweets_from_likes_legacy_timeline()
    }, // end of class ClassLikesLegacyTimeline
    
    ClassLikesTimeline = class extends ClassTimelineTemplate {
        constructor( parameters ) {
            super( parameters );
            
            const
                self = this;
            
            self.timeline_type = TIMELINE_TYPE.likes;
            
            self.set_fetch_tweets_function( TIMELINE_TYPE.likes, self.fetch_tweets_from_likes_timeline );
            
            parameters = self.parameters;
            
            self.user_id = parameters.user_id;
            self.screen_name = parameters.screen_name;
            
            let cursor = self.cursor = parameters.cursor,
                max_timestamp_ms = self.max_timestamp_ms;
            
            if ( ( ! cursor ) && max_timestamp_ms ) {
                // TODO: cursor は 'HBbuwYDwsNyOvi4AAA==' のような値であり、開始時刻をどのように置き換えればよいかがわからない
                // →独自に解析し、時刻→Like ID→cursor 値へと変換できるように試みている
                let like_id = convert_utc_msec_to_like_id( max_timestamp_ms );
                cursor = self.cursor = create_likes_cursor( like_id );
                log_debug( 'create likes cursor:', cursor, 'like_id:', like_id, 'max_timestamp_ms:', max_timestamp_ms );
            }
            
            self.last_cursor = null;
            self.user_info = null;
            
            self.timeline_status = TIMELINE_STATUS.search;
            
            return self;
        } // end of constructor()
        
        async fetch_tweets_from_likes_timeline() {
            const
                self = this;
            
            let user_info = self.user_info;
            
            if ( ! user_info ) {
                user_info = self.user_info = await TWITTER_API.get_user_info( { user_id : self.user_id, screen_name : self.screen_name } );
            }
            
            self.last_cursor = self.cursor;
            
            let result = self.last_result = await TIMELINE_TOOLBOX.get_likes_timeline_info( {
                    user_id : user_info.id_str,
                    screen_name : user_info.screen_name,
                    user_name : user_info.name,
                    user_icon : user_info.profile_image_url_https,
                    cursor : self.cursor,
                    count : TWITTER_API.definition( TIMELINE_TYPE.likes ).tweet_number.limit,
                } ).catch( ( error ) => {
                    log_error( 'TIMELINE_TOOLBOX.get_likes_timeline_info():', error );
                    self.last_error = error;
                    return null;
                } );
            
            if ( ( ! result ) || ( ! result.timeline_info ) ) {
                log_error( 'unknown result:', result );
                self.timeline_status = TIMELINE_STATUS.error;
                return;
            }
            
            let cursor_info = result.timeline_info.cursor_info,
                tweet_info_list = result.timeline_info.tweet_info_list;
            
            if ( ( tweet_info_list.length <= 0 ) || ( ! cursor_info.bottom ) ) {
                self.timeline_status = TIMELINE_STATUS.end;
                return;
            }
            
            self.tweet_info_list = self.tweet_info_list.concat( tweet_info_list );
            self.cursor = cursor_info.bottom.cursor.value;
        } // end of fetch_tweets_from_likes_timeline()
    }, // end of class ClassLikesTimeline
    
    ClassBookmarksTimeline = class extends ClassTimelineTemplate {
        constructor( parameters ) {
            super( parameters );
            
            const
                self = this;
            
            self.timeline_type = TIMELINE_TYPE.bookmarks;
            
            self.set_fetch_tweets_function( TIMELINE_TYPE.bookmarks, self.fetch_tweets_from_bookmarks_timeline );
            
            parameters = self.parameters;
            
            self.user_id = parameters.user_id;
            self.screen_name = parameters.screen_name;
            self.cursor = parameters.cursor;
            
            let cursor = self.cursor = parameters.cursor,
                max_timestamp_ms = self.max_timestamp_ms;
            
            if ( ( ! cursor ) && max_timestamp_ms ) {
                // TODO: cursor は 'HBaA9ISd7/33hwsAAA==' のような値であり、開始時刻をどのように置き換えればよいかがわからない
                // →独自に解析し、時刻→Bookmark ID→cursor 値へと変換できるように試みている
                let bookmark_id = convert_utc_msec_to_bookmark_id( max_timestamp_ms );
                cursor = self.cursor = create_bookmarks_cursor( bookmark_id );
                log_debug( 'create bookmarks cursor:', cursor, 'bookmark_id:', bookmark_id, 'max_timestamp_ms:', max_timestamp_ms );
            }
            
            self.last_cursor = null;
            self.user_info = null;
            
            self.timeline_status = TIMELINE_STATUS.search;
            
            return self;
        } // end of constructor()
        
        async fetch_tweets_from_bookmarks_timeline() {
            const
                self = this;
            
            let user_info = self.user_info;
            
            if ( ! user_info ) {
                user_info = self.user_info = await TWITTER_API.get_user_info( { user_id : self.user_id, screen_name : self.screen_name } );
            }
            
            self.last_cursor = self.cursor;
            
            let result = self.last_result = await TIMELINE_TOOLBOX.get_bookmarks_timeline_info( {
                    user_id : user_info.id_str,
                    screen_name : user_info.screen_name,
                    user_name : user_info.name,
                    user_icon : user_info.profile_image_url_https,
                    cursor : self.cursor,
                    count : TWITTER_API.definition( TIMELINE_TYPE.bookmarks ).tweet_number.limit,
                } ).catch( ( error ) => {
                    log_error( 'TIMELINE_TOOLBOX.get_bookmarks_timeline_info():', error );
                    self.last_error = error;
                    return null;
                } );
            
            if ( ( ! result ) || ( ! result.timeline_info ) ) {
                log_error( 'unknown result:', result );
                self.timeline_status = TIMELINE_STATUS.error;
                return;
            }
            
            let cursor_info = result.timeline_info.cursor_info,
                tweet_info_list = result.timeline_info.tweet_info_list;
            
            if ( ( tweet_info_list.length <= 0 ) || ( ! cursor_info.bottom ) ) {
                self.timeline_status = TIMELINE_STATUS.end;
                return;
            }
            
            self.tweet_info_list = self.tweet_info_list.concat( tweet_info_list );
            self.cursor = cursor_info.bottom.cursor.value;
        } // end of fetch_tweets_from_bookmarks_timeline()
    }, // end of class ClassBookmarksTimeline
    
    CLASS_TIMELINE_SET = {
        [ TIMELINE_TYPE.user ] : ClassUserTimeline,
        [ TIMELINE_TYPE.search ] : ClassSearchTimeline,
        [ TIMELINE_TYPE.notifications ] : ClassNotificationsTimeline,
        [ TIMELINE_TYPE.likes_legacy ] : ClassLikesLegacyTimeline,
        //[ TIMELINE_TYPE.likes ] : ClassLikesLegacyTimeline, // TODO: /1.1/favorites/list だと、いいねした時系列順ではなく、ツイートID順に並んでしまう
        [ TIMELINE_TYPE.likes ] : ClassLikesTimeline,
        [ TIMELINE_TYPE.bookmarks ] : ClassBookmarksTimeline,
    };


Object.assign( exports, {
    version : VERSION,
    module_name : MODULE_NAME,
    debug_mode : DEFAULT_DEBUG_MODE,
    
    logged_script_name : DEFAULT_SCRIPT_NAME,
    log_debug,
    log,
    log_info,
    log_error,
    
    TIMELINE_TYPE,
    TIMELINE_STATUS,
    REACTION_TYPE,
    MEDIA_TYPE,
    
    TWITTER_API,
    TIMELINE_TOOLBOX,
    
    CLASS_TIMELINE_SET,
} );

} )( ( typeof exports != 'undefined' ) ? exports : context_global[ MODULE_NAME ] = {} );

} )();
