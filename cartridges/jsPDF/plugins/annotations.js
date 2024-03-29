/* eslint-disable */

/**
 * @license
 * Copyright (c) 2014 Steven Spungin (TwelveTone LLC)  steven@twelvetone.tv
 *
 * Licensed under the MIT License.
 * http://opensource.org/licenses/mit-license
 */

/**
 * jsPDF Annotations PlugIn
 *
 * There are many types of annotations in a PDF document. Annotations are placed
 * on a page at a particular location. They are not 'attached' to an object.
 * <br />
 * This plugin current supports <br />
 * <li> Goto Page (set pageNumber and top in options)
 * <li> Goto Name (set name and top in options)
 * <li> Goto URL (set url in options)
 * <p>
 * 	The destination magnification factor can also be specified when goto is a page number or a named destination. (see documentation below)
 *  (set magFactor in options).  XYZ is the default.
 * </p>
 * <p>
 *  Links, Text, Popup, and FreeText are supported.
 * </p>
 * <p>
 * Options In PDF spec Not Implemented Yet
 * <li> link border
 * <li> named target
 * <li> page coordinates
 * <li> destination page scaling and layout
 * <li> actions other than URL and GotoPage
 * <li> background / hover actions
 * </p>
 * @name annotations
 * @module
 */

/*
    Destination Magnification Factors
    See PDF 1.3 Page 386 for meanings and options

    [supported]
	XYZ (options; left top zoom)
	Fit (no options)
	FitH (options: top)
	FitV (options: left)

	[not supported]
	FitR
	FitB
	FitBH
	FitBV
 */
module.exports = function (jsPDFAPI) {
    'use strict';


    jsPDFAPI.events.push(['addPage', function (addPageData) {
        var pageInfo = this.internal.getPageInfo(addPageData.pageNumber);
        pageInfo.pageContext.annotations = [];
    }]);

    jsPDFAPI.events.push(['putPage', function (putPageData) {
        var pageInfo = this.internal.getPageInfoByObjId(putPageData.objId);
        var pageAnnos = putPageData.pageContext.annotations;

        var notEmpty = function (obj) {
            if (typeof obj !== 'undefined') {
                if (obj != '') {
                    return true;
                }
            }
        };
        var found = false;
        for (var a = 0; a < pageAnnos.length && !found; a++) {
            var anno = pageAnnos[a];
            switch (anno.type) {
                case 'link':
                    if (notEmpty(anno.options.url) || notEmpty(anno.options.pageNumber)) {
                        found = true;
                        break;
                    }
                case 'reference':
                case 'text':
                case 'freetext':
                    found = true;
                    break;
            }
        }
        if (found == false) {
            return;
        }

        this.internal.write('/Annots [');
        var pageHeight = this.internal.pageSize.height;
        var getHorizontalCoordinateString = this.internal.getCoordinateString;
        var getVerticalCoordinateString = this.internal.getVerticalCoordinateString;
        for (var a = 0; a < pageAnnos.length; a++) {
            var anno = pageAnnos[a];

            switch (anno.type) {
                case 'reference':
                // References to Widget Annotations (for AcroForm Fields)
                    this.internal.write(' ' + anno.object.objId + ' 0 R ');
                    break;
                case 'text':
				// Create a an object for both the text and the popup
                    var objText = this.internal.newAdditionalObject();
                    var objPopup = this.internal.newAdditionalObject();

                    var title = anno.title || 'Note';
                    var rect = '/Rect [' + getHorizontalCoordinateString(anno.bounds.x) + ' ' + getVerticalCoordinateString(anno.bounds.y + anno.bounds.h) + ' ' + getHorizontalCoordinateString(anno.bounds.x + anno.bounds.w) + ' ' + getVerticalCoordinateString(anno.bounds.y) + '] ';
                    line = '<</Type /Annot /Subtype /' + 'Text' + ' ' + rect + '/Contents (' + anno.contents + ')';
                    line += ' /Popup ' + objPopup.objId + ' 0 R';
                    line += ' /P ' + pageInfo.objId + ' 0 R';
                    line += ' /T (' + title + ') >>';
                    objText.content = line;

                    var parent = objText.objId + ' 0 R';
                    var popoff = 30;
                    var rect = '/Rect [' + getHorizontalCoordinateString(anno.bounds.x + popoff) + ' ' + getVerticalCoordinateString(anno.bounds.y + anno.bounds.h) + ' ' + getHorizontalCoordinateString(anno.bounds.x + anno.bounds.w + popoff) + ' ' + getVerticalCoordinateString(anno.bounds.y) + '] ';
                    line = '<</Type /Annot /Subtype /' + 'Popup' + ' ' + rect + ' /Parent ' + parent;
                    if (anno.open) {
                        line += ' /Open true';
                    }
                    line += ' >>';
                    objPopup.content = line;

                    this.internal.write(objText.objId, '0 R', objPopup.objId, '0 R');

                    break;
                case 'freetext':
                    var rect = '/Rect [' + getHorizontalCoordinateString(anno.bounds.x) + ' ' + getVerticalCoordinateString(anno.bounds.y) + ' ' + getHorizontalCoordinateString(anno.bounds.x + anno.bounds.w) + ' ' + getVerticalCoordinateString(anno.bounds.y + anno.bounds.h) + '] ';
                    var color = anno.color || '#000000';
                    line = '<</Type /Annot /Subtype /' + 'FreeText' + ' ' + rect + '/Contents (' + anno.contents + ')';
                    line += ' /DS(font: Helvetica,sans-serif 12.0pt; text-align:left; color:#' + color + ')';
                    line += ' /Border [0 0 0]';
                    line += ' >>';
                    this.internal.write(line);
                    break;
                case 'link':
                    if (anno.options.name) {
                        var loc = this.annotations._nameMap[anno.options.name];
                        anno.options.pageNumber = loc.page;
                        anno.options.top = loc.y;
                    } else if (!anno.options.top) {
                        anno.options.top = 0;
                    }

                    var rect = '/Rect [' + getHorizontalCoordinateString(anno.x) + ' ' + getVerticalCoordinateString(anno.y) + ' ' + getHorizontalCoordinateString(anno.x + anno.w) + ' ' + getVerticalCoordinateString(anno.y + anno.h) + '] ';

                    var line = '';
                    if (anno.options.url) {
                        line = '<</Type /Annot /Subtype /Link ' + rect + '/Border [0 0 0] /A <</S /URI /URI (' + anno.options.url + ') >>';
                    } else if (anno.options.pageNumber) {
					// first page is 0
                        var info = this.internal.getPageInfo(anno.options.pageNumber);
                        line = '<</Type /Annot /Subtype /Link ' + rect + '/Border [0 0 0] /Dest [' + info.objId + ' 0 R';
                        anno.options.magFactor = anno.options.magFactor || 'XYZ';
                        switch (anno.options.magFactor) {
                            case 'Fit':
                                line += ' /Fit]';
                                break;
                            case 'FitH':
                                line += ' /FitH ' + anno.options.top + ']';
                                break;
                            case 'FitV':
                                anno.options.left = anno.options.left || 0;
                                line += ' /FitV ' + anno.options.left + ']';
                                break;
                            case 'XYZ':
                            default:
                                var top = getVerticalCoordinateString(anno.options.top);
                                anno.options.left = anno.options.left || 0;
						// 0 or null zoom will not change zoom factor
                                if (typeof anno.options.zoom === 'undefined') {
                                    anno.options.zoom = 0;
                                }
                                line += ' /XYZ ' + anno.options.left + ' ' + top + ' ' + anno.options.zoom + ']';
                                break;
                        }
                    } else {
					// TODO error - should not be here
                    }
                    if (line != '') {
                        line += ' >>';
                        this.internal.write(line);
                    }
                    break;
            }
        }
        this.internal.write(']');
    }]);

	/**
	* @name createAnnotation
	* @function
	* @param {Object} options
	*/
    jsPDFAPI.createAnnotation = function (options) {
        var pageInfo = this.internal.getCurrentPageInfo();
        switch (options.type) {
            case 'link':
                this.link(options.bounds.x, options.bounds.y, options.bounds.w, options.bounds.h, options);
                break;
            case 'text':
            case 'freetext':
                pageInfo.pageContext.annotations.push(options);
                break;
        }
    };

	/**
	 * Create a link
	 *
	 * valid options
	 * <li> pageNumber or url [required]
	 * <p>If pageNumber is specified, top and zoom may also be specified</p>
	 * @name link
	 * @function
	 * @param {number} x
	 * @param {number} y
	 * @param {number} w
	 * @param {number} h
	 * @param {Object} options
	 */
    jsPDFAPI.link = function (x, y, w, h, options) {
        var pageInfo = this.internal.getCurrentPageInfo();
        pageInfo.pageContext.annotations.push({
            x: x,
            y: y,
            w: w,
            h: h,
            options: options,
            type: 'link'
        });
    };

	/**
	 * Currently only supports single line text.
	 * Returns the width of the text/link
	 *
	 * @name textWithLink
	 * @function
	 * @param {string} text
	 * @param {number} x
	 * @param {number} y
	 * @param {Object} options
	 * @returns {number} width the width of the text/link
	 */
    jsPDFAPI.textWithLink = function (text, x, y, options) {
        var width = this.getTextWidth(text);
        var height = this.internal.getLineHeight() / this.internal.scaleFactor;
        this.text(text, x, y);
		// TODO We really need the text baseline height to do this correctly.
		// Or ability to draw text on top, bottom, center, or baseline.
        y += height * 0.2;
        this.link(x, y - height, width, height, options);
        return width;
    };

	// TODO move into external library
	/**
	* @name getTextWidth
	* @function
	* @param {string} text
	* @returns {number} txtWidth
	*/
    jsPDFAPI.getTextWidth = function (text) {
        var fontSize = this.internal.getFontSize();
        var txtWidth = this.getStringUnitWidth(text) * fontSize / this.internal.scaleFactor;
        return txtWidth;
    };

    return this;
};
