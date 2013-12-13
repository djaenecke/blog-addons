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
// @grant		GM_addStyle
// ==/UserScript==

/*
 * some enhancements for String
 */

/**
 * replace all linebreaks with HTML <br/>
 *
 * @return String
 */
String.prototype.nl2br = function() {
	return this.replace( /(\r\n)|(\n\r)|\r|\n/g, '<br/>' );
}

/**
 * strip withespace or the given list of characters from the beginning
 * of a string
 *
 * @param string clist optional list of characters
 * @return String
 */
String.prototype.ltrim = function( clist ) {
	if (clist) {
		return this.replace (new RegExp ('^[' + clist + ']+'), '');
	}
	return this.replace (/^\s+/, '');
}

/**
 * strip withespace or the given list of characters from the end
 * of a string
 *
 * @param string clist optional list of characters
 * @return String
 */
String.prototype.rtrim = function ( clist ) {
	if (clist) {
		return this.replace (new RegExp ('[' + clist + ']+$'), '');
	}
	return this.replace (/\s+$/, '');
}

/**
 * strip withespace or the given list of characters from the beginning
 * and the end of a string
 *
 * @param string clist optional list of characters
 * @return String
 */
String.prototype.trim = function ( clist ) {
	if (clist) {
		return this.ltrim (clist).rtrim(clist);
	}
	return this.ltrim().rtrim ();
}




/*
 * JS required for user interaction
 */
unsafeWindow.toggleArticleVisibility = function( id ) {
	var lb = new LawBlog();
	lb.toggleArticleVisibility( id );
	return false;
}
unsafeWindow.showPreview = function( content ) {
	document.getElementById( 'commentPreview' ).innerHTML = content.nl2br();
}
unsafeWindow.addMarkup = function( txtarea, text ) {

	var scrollPos = txtarea.scrollTop;
	var strPosStart = txtarea.selectionStart;
	var strPosEnd = txtarea.selectionEnd;

	var front = txtarea.value.substring( 0, strPosStart );
	var middle = txtarea.value.substring( strPosStart, strPosEnd );
	var back = txtarea.value.substring( strPosEnd, txtarea.value.length );

	var tagOpen = '<' + text + '>';
	var tagClose = '</' + text + '>';

	txtarea.value = front + tagOpen + middle + tagClose + back;
	strPos = strPosStart + tagOpen.length;
	txtarea.selectionStart = strPosStart + tagOpen.length;
	txtarea.selectionEnd = txtarea.selectionStart + middle.length;
	txtarea.focus();
	txtarea.scrollTop = scrollPos;

	unsafeWindow.showPreview( txtarea.value );
}

/**
 * check form
 *
 * Will check the comment form before submitting it.
 * In case any of the mandatory fields is empty the form will *not* be submitted.
 *
 * @param HTMLFormElement frm
 * @return bool
 */
unsafeWindow.checkForm = function( frm ) {

	var missing = new Array();

	for( var i=0; i<frm.elements.length; i++ ) {
		if( !frm.elements[i].value &&
			frm.elements[i].hasAttribute( 'aria-required' ) &&
			frm.elements[i].getAttribute( 'aria-required' ) == 'true'
		){
			missing.push( frm.elements[i].name );
		}
	}

	if( missing.length > 0 ) {
		alert( 'Das Formular ist unvollständig, bitte ausfüllen: \n\t- ' + missing.join( '\n\t- ' ) );
	}

	return missing.length == 0;

}

/**
 * The class holding LawBlog functions
 */
var LawBlog = function() {

	/**
	 * these are the different kinds of pages that can be found
	 * depending on the page type different kinds of enhancements are added
	 */
	this.PAGE_TYPE_INDEX   = 1;
	this.PAGE_TYPE_ARTICLE = 2;
	this.PAGE_TYPE_OTHER   = 4;

	/**
	 * this is the maximum number of comments per article page
	 */
	this.MAX_NUM_COMMENTS = 500;

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
	 * @return this
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
	this.getPersistedCommentCountForArticle = function( rawURI ) {
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
	 * persist number of comments for this article
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
	 *
	 * this method will iterate all links in the current document. All links
	 * pointing to an article and containing a comment count will given
	 * additional information on the change in the number of comments
	 *
	 * @return this
	 */
	this.addCommentCount = function() {

		var numCurrent, numPersisted, numDiff, txtDiff;

		var append = new Array();

		for( var i=0; i<document.links.length; i++ ) {

			if( document.links[i].href.match( /\/#comments$/ ) &&
				!document.links[i].title.match( /^Seite #/ )
			) {
				numCurrent   = document.links[i].firstChild.innerHTML.match( /^[0-9]+/ );
				numPersisted = this.getPersistedCommentCountForArticle( document.links[i].href );
				numDiff      = -1 == numPersisted ? 'n/a' : numCurrent - numPersisted;

				if( numDiff == 0 ) {
					txtDiff = '&#177; 0';
				}
				else if( numDiff > 0 ) {
					txtDiff = '+' + numDiff;
				}
				else {
					txtDiff = numDiff;
				}
				document.links[i].innerHTML += '&nbsp;[' + txtDiff + ']';

				if( numCurrent > this.MAX_NUM_COMMENTS ) {
					var numPages = Math.ceil( numCurrent / this.MAX_NUM_COMMENTS );

					for( var s=1; s<numPages; s++ ) {

						var lnk = document.links[i].cloneNode( true );
						lnk.innerHTML = '[Seite #' + (s+1) + ']';
						lnk.title = 'Seite #' + (s+1);
						lnk.href=lnk.href.replace( /#comments$/, 'comment-page-' + (s+1) + '/#co	mments' );
						document.links[i].parentNode.innerHTML += '&nbsp;|&nbsp;';
						document.links[i].parentNode.appendChild( lnk );

					}

				}

			}
		}
		return this;

	}

	/**
	 * add a preview box for new comments
	 *
	 * @return this
	 */
	this.addCommentPreview = function() {

		var divPreviewOuter = document.createElement( 'div' );
		divPreviewOuter.setAttribute( 'id', 'dPreviewOuter' );

		var divPreviewTitle = document.createElement( 'div' );
		divPreviewTitle.setAttribute( 'id', 'dPreviewTitle' );
		divPreviewTitle.innerHTML = 'Preview';

		var divPreviewInner = document.createElement( 'div' );
		divPreviewInner.setAttribute( 'id', 'dPreviewInner' );

		var pPreview = document.createElement( 'p' );
		pPreview.setAttribute( 'id', 'commentPreview' );

		divPreviewOuter.appendChild( divPreviewTitle );
		divPreviewOuter.appendChild( divPreviewInner );

		divPreviewInner.appendChild( pPreview );

		document.getElementById( 'commentform' ).appendChild( divPreviewOuter );

		GM_addStyle( '#dPreviewTitle { white-space: pre; background-color: #ff0000; color: #ffffff; font-weight: bold; padding: 2px; }' );
		document.getElementById( 'comment' ).setAttribute( 'onkeypress', 'showPreview( this.value )' );

		return this;

	}

	/**
	 * list all stored key-value pairs/**
	 * add a preview box for new comments
	 *
	 * @return this
	 */
	this.addCommentButtons = function() {

		var allowedMarkup = new Array( 'b', 'i', 'blockquote', 'strike' );

		for( var i=0; i<allowedMarkup.length; i++ ) {

			var myButton = document.createElement( 'input' );
			with( myButton ) {
				setAttribute( 'type', 'button' );
				setAttribute( 'value', '<' + allowedMarkup[i] + '>' );
				setAttribute( 'onclick', 'addMarkup( document.getElementById( "comment" ), "' + allowedMarkup[i] + '" )' );
			}
			document.getElementById( 'commentform' ).appendChild( myButton );

		}

		return this;
	}

	/**
	 * add marker after last already read comment
	 */
	this.addCommentReadMarker = function() {

		var numPersisted = this.getPersistedCommentCountForArticle( unsafeWindow.document.URL );
		var numCurrent   = this.getCommentCountForDocument( false );
		var numPage = 0;
		var pageMinId = 0;
		var commentList = document.getElementById( 'comments' ).getElementsByTagName( 'ol' )[0].getElementsByTagName( 'li' );
		var relativeCommentIdx = 0;

		/*
		 * if the article was not accessed through the comment-link
		 * we do not jump anywhere
		 */
		if( !unsafeWindow.document.URL.match( /#comments/ ) ) {
			return this;
		}

		/*
		 * no persisted data -> leave
		 */
		if( -1 === numPersisted ) {
			return this;
		}

		/*
		 * detect on which sub-page we are (if any)
		 */
		numPage = unsafeWindow.document.URL.match( /(comment-page-)(\d)/ );
		numPage = null == numPage ? 1 : numPage[2];
		pageMinId = (numPage - 1) * this.MAX_NUM_COMMENTS + 1;

		relativeCommentIdx = numPersisted - pageMinId;


		if( relativeCommentIdx < numCurrent ) {
			var marker = document.createElement( 'div' );
			marker.setAttribute( 'id', 'dCommentLastReadMarker' );
			marker.innerHTML = '<strong>&#8595;&#8595;&#8595;</strong>&nbsp;neue Kommentare&nbsp;<strong>&#8595;&#8595;&#8595;</strong>';

			if( commentList.length >= relativeCommentIdx ) {
				commentList[relativeCommentIdx].appendChild( marker );
				marker.scrollIntoView( true );
				GM_addStyle( '#dCommentLastReadMarker { text-align: center; color: #ffffff; background-color: #ff0000; margin-top: 30px;}' );
			}

		}

		return this;

	}

	/**
	 * list all stored elements
	 */
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

	/**
	 * add form check to comment form
	 *
	 * @return this
	 */
	this.addCommentFormSubmitCheck = function() {

		document.getElementById( 'commentform' ).setAttribute( 'onsubmit', 'return checkForm( this )' );
		return this;

	}

	/**
	 * main
	 *
	 * this is the main entry point for all the action
	 */
	this.main = function() {
		if( this.PAGE_TYPE_INDEX == this.detectPageType() ) {
			GM_log( '-- index' );
			this.foldArticles();
			this.addCommentCount();
		}
		else if( this.PAGE_TYPE_ARTICLE == this.detectPageType() ) {
			GM_log( '-- article' );
			this.addCommentButtons();
			this.addCommentPreview();
			this.addCommentReadMarker();
			this.addCommentFormSubmitCheck();
			this.getCommentCountForDocument();


		}
		else {
			GM_log( '-- undefined: ' + 	this.detectPageType() );
		}
		// this.listStorage();
	}

}

var lb = new LawBlog();
lb.main();
