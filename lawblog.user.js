// ==UserScript==
// @name        lawblog.de - added usability
// @namespace   de.wonko
// @include     http://www.lawblog.de/*
// @version     1
// @grant       GM_setValue
// @grant       GM_getValue
// @grant		GM_log
// @grant		GM_listValues
// @grant		GM_deleteValue
// ==/UserScript==

/*
 * JS required for user interaction
 */
unsafeWindow.toggleArticleVisibility = function( id ) {
	var lb = new LawBlog();
	lb.toggleArticleVisibility( id );
	return false;
}

function log( message ) {
	// unsafeWindow.console.log( '[DBG] ' + message );
	GM_log( message );
}


var LawBlog = function() {
	this.PAGE_TYPE_INDEX   = 1;
	this.PAGE_TYPE_ARTICLE = 2;
	this.PAGE_TYPE_OTHER   = 4;
	
	this.commentStore = {};
	
	/**
	 * @var int
	 */
	this.page_type = null;
	
	/**
	 * detect on what type of page we are on
	 *
	 * there are three page types:
	 *  - index pages, containing articles and links to these articles and 
	 *      their corresponding comments
	 *  - article pages, containing one article and its related comments
	 *  - other pages
	 *
	 * @return int
	 */
	this.detectPageType = function() {
		
		if( null == this.pageType ) {
			
			var pageURI = unsafeWindow.document.URL;
			
			if( pageURI.match( 
				/index\.php\/archives\/[12][0-9]{3}\/[0-9]{2}\/[0-9]{2}/ ) 
			) {
				this.pageType = this.PAGE_TYPE_ARTICLE;
			}
			else if( pageURI.match( /lawblog\.de\/$/ ) ||
				pageURI.match( /index\.php\/page\/[0-9]+/ )
			) {
				this.pageType = this.PAGE_TYPE_INDEX;	
			}
			else {
				this.pageType = this.PAGE_TYPE_OTHER;
			}
		
		}
		
		return this.pageType;
		
	}
	
	/**
	 * create content-id from article-id
	 *
	 * @param string articleId
	 * @return string
	 */
	this.getContentId = function( articleId ) {
		return 'content-' + articleId;	
	}
	
	/**
	 * create link-id from article-id
	 *
	 * @param string articleId
	 * @return string
	 */
	this.getLinkId = function( articleId ) {
		return 'a-' + articleId;	
	}
	
	/**
	 * create HTML snippet 
	 * this HTML snippet will provide a base <a> element to toggle the
	 * visibility of an article
	 *
	 * @param string articleId
	 * @return string
	 */
	this.getToggleHTML = function( articleId ) {
		return '<a ' +
			'id="' + this.getLinkId( articleId ) + '" ' +
			'href="#" ' +
			'onclick="return toggleArticleVisibility( \'' + 
			articleId + 
			'\' )"></a>&nbsp;';
	}
	
	/**
	 * fold all articles on the index page
	 * 
	 * iterate over all articles, hide the article content and add a button in
	 * the articles headline to toggle its visibility
	 *
	 * @return LawBlog
	 */
	this.foldArticles = function() {
		var articles = document.getElementsByTagName( 'article' );
		var article, header, content, articleId;
		
		for( var i=0; i<articles.length; i++ ) {
			article = articles[i];
			articleId = article.getAttribute( 'id' );
			
			header	= article.getElementsByTagName( 'h1' )[0];
			content = article.getElementsByTagName( 'div' )[0];
			
			header.innerHTML = this.getToggleHTML( articleId ) + header.innerHTML;
			content.setAttribute( 'id', this.getContentId( articleId ) );
			this.toggleArticleVisibility( articleId );
			
		}
		
		return this;

	}
	
	/**
	 * toggle visibility of a single article
	 *
	 * @param string id
	 */
	this.toggleArticleVisibility = function( id ) {
		var content = document.getElementById( this.getContentId( id ) );
		var link = document.getElementById( 'a-' + id );
		
		if( 'none' == content.style.display ) {
			content.style.display = 'block';	
			link.innerHTML = '[-]';
		}
		else {
			content.style.display = 'none';	
			link.innerHTML = '[+]';
		}
		
	}
	
	/**
	 * get number of comments for current article
	 * 
	 * if the optional argument evaluates true and the number of comments is
	 * greater than 0 it will be persisted
	 *
	 * @param bool persist (default: true)
	 * @return int
	 */
	this.getCommentCountForDocument = function( persist ) {
		
		persist = persist || typeof persist === 'undefined';	
		var e = document.getElementById( 'comments-title' );
		var num = e ? e.innerHTML.trim().match( /^[0-9]+/ ) : 0;
		
		if( num > 0 && persist ) {
			this.persistCommentCountForArticle( document.URL, num );
		}
		
		if( e ) {
			return e.innerHTML.trim().match( /^[0-9]+/ );
		}
		else {
			return 0;
		}
		
	}
	
	/**
	 * get persisted number of comments for this article
	 *
	 * will return -1 if no data was persisted for this article yet
	 *
	 * @param string rawURI
	 * @return int
	 */
	this.getCommentCountForArticle = function( rawURI ) {
		var nrmURI = normalizeArticleURI( rawURI );
		var value  = -1;
		var obj    =  GM_getValue( nrmURI, value );
		if( -1 != obj ) {
			obj = JSON.parse( obj );
			value = obj.count;
		}

		return value;

	}
	
	/**
	 * set (persist) number of comments for this article
	 *
	 * @param string rawURI
	 * @param int count
	 */
	this.persistCommentCountForArticle = function( rawURI, count ) {
		var nrmURI	= normalizeArticleURI( rawURI );
		var now = new Date();
		var value	= {
			'count' : count,
			'changed' : now.getTime()
		};
		GM_log( JSON.stringify( value ) );
		GM_setValue( nrmURI, JSON.stringify( value ) );
	}
	
	/**
	 * get normalized article uri
	 *
	 * @param string rawURI
	 * @return string
	 */
	normalizeArticleURI = function( rawURI ) {
		
		var RE = /archives\/([0-9]{4})\/([0-9]{2})\/([0-9]{2})\/([^/]+)/g ; 
		var parts = RE.exec( rawURI );
		parts.shift();
		var nrm = parts.join( '-' );
		return nrm;
				
	}
	
	/**
	 * add persisted number of comments
	 */
	this.addCommentCount = function() {
		
		var numCurrent, numPersisted, numDiff, txtDiff;
		
		for( var i=0; i<document.links.length; i++ ) {

			if( document.links[i].href.match( /\/#comments$/ ) ) {
				numCurrent   = document.links[i].firstChild.innerHTML.match( /^[0-9]+/ );
				numPersisted = this.getCommentCountForArticle( document.links[i].href );
				numDiff      = -1 == numPersisted ? 'n/a' : numCurrent - numPersisted;
				
				if( numDiff == 0 ) {
					txtDiff = '+/- 0';
				}
				else if( numDiff > 0 ) {
					txtDiff = '+' + numDiff;
				}
				else {
					txtDiff = numDiff;
				}
				document.links[i].innerHTML += '&nbsp;[' + txtDiff + ']';
			}
		}
		return this;
	}

	this.deleteAllCommentCount = function() {

		if( confirm( 'Delete all comment keys?' ) ) {
			for each ( var val in GM_listValues() ) {
				GM_log( 'Delete ' + val + ' -> ' + GM_deleteValue( val ) );
			}
		}
		
	}
	
	this.listStorage = function() {
		var out = 'Storage:\n';
		var num = 0;
		var value;
		var type;
		for each ( var key in GM_listValues() ) {
			value = GM_getValue( key );
			type = typeof value;
			++num;
			out += ' ' + num + ' ' + key + ' : (' + type + ') ' + value + '\n';
		}
		GM_log( out );
	}

	this.main = function() {
		if( this.PAGE_TYPE_INDEX == this.detectPageType() ) {
			GM_log( '-- index' );
			this.foldArticles();
			this.addCommentCount();
		}
		else if( this.PAGE_TYPE_ARTICLE == this.detectPageType() ) {
			GM_log( '-- article' );
			this.getCommentCountForDocument();
		}
		else {
			GM_log( '-- undefined: ' + 	this.detectPageType() );
		}
		this.listStorage();
	}

}

var lb = new LawBlog();
lb.main();
// lb.deleteAllCommentCount();
//return;

// var type = lb.detectPageType();


/*
var out = '';
for each ( var val in GM_listValues() ) {
	out += val + ' = ' + GM_getValue( val ) + '\n';
}
GM_log( out );
*/
