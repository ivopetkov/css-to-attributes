/*
 * Responsive Attributes
 * http://ivopetkov.com/
 * Copyright (c) Ivo Petkov
 * Free to use under the MIT license.
 * 
 * Notes:
 * Single quotes must be escaped (\' instead of ') to preserve them. Chrome converts them to double quotes id a pair is used (example: 'Arial' will become "Arial").
 * When uneven number of quotes is used, they must be escaped (example: "" \").
 * Always escape ! ; { } in CSS rules.
 * Always escape " and \ in attribute selectors (Example: [attribute="\" \\ value"]).
 */

var cssToAttributes = typeof cssToAttributes !== 'undefined' ? cssToAttributes : (function () {

    var documentHead = document.head;
    var cssPropertyPrefix = '--css-to-attribute-';
    var cssPropertyPrefixLength = cssPropertyPrefix.length;
    var cssPropertyRegExp = new RegExp('\-\-css\-to\-attribute\-.*?:', 'g');
    var observedSelectors = [];
    var observedSelectorsProperties = []; // [selector, [property1, property2, ...]]
    var observedElements = [];
    var observedElementsProperties = [];
    var lastCheckedStyleSheetContent = [];

    var processCssRules = function (cssRules) {
        for (var i = 0; i < cssRules.length; i++) {
            var cssRule = cssRules[i];
            if (cssRule.type === 4) { // media
                processCssRules(cssRule.cssRules);
            } else if (cssRule.type === 1) { // style
                var cssText = cssRule.cssText;
                if (cssText.indexOf(cssPropertyPrefix) !== -1) {
                    var selectorText = cssRule.selectorText;
                    var index = observedSelectors.indexOf(selectorText);
                    if (index === -1) {
                        observedSelectors.push(selectorText);
                        observedSelectorsProperties.push([]);
                        index = observedSelectors.indexOf(selectorText);
                    }
                    var observedSelectorProperties = observedSelectorsProperties[index];
                    var matches = cssText.match(cssPropertyRegExp);
                    for (var j = 0; j < matches.length; j++) {
                        var property = matches[j].replace(':', '').trim();
                        if (observedSelectorProperties.indexOf(property) === -1) {
                            observedSelectorProperties.push(property);
                        }
                    }
                }

            }
        }
    };

    var updateObservedSelectorsList = function (useCache) {
        //var timerLabel = 'cssToAttributes:updateObservedSelectorsList - ' + (useCache ? 'use cache' : 'no cache');
        //console.time(timerLabel);
        var styleSheets = document.styleSheets;
        for (var i = 0; i < styleSheets.length; i++) {
            var styleSheet = styleSheets[i];
            var styleSheetContent = styleSheet.ownerNode.outerHTML;
            if (useCache && typeof lastCheckedStyleSheetContent[i] !== 'undefined' && lastCheckedStyleSheetContent[i] === styleSheetContent) {
                continue;
            }
            try {
                processCssRules(styleSheet.cssRules);
            } catch (e) {
                // ignore; may be CSSStyleSheet.cssRules getter: Not allowed to access cross-origin stylesheet
            }
            lastCheckedStyleSheetContent[i] = styleSheetContent;
        };
        //console.timeEnd(timerLabel);
    }

    var updateObservedElementsList = function () {
        //console.time('cssToAttributes:updateObservedElementsList');
        for (var i = 0; i < observedSelectors.length; i++) {
            var selector = observedSelectors[i];
            var properties = observedSelectorsProperties[i];
            var elements = document.querySelectorAll(selector);
            for (var j = 0; j < elements.length; j++) {
                var element = elements[j];
                var index = observedElements.indexOf(element);
                if (index === -1) {
                    observedElements.push(element);
                    observedElementsProperties.push([]);
                    index = observedElements.indexOf(element);
                }
                var observedElementProperties = observedElementsProperties[index];
                for (var k = 0; k < properties.length; k++) {
                    var property = properties[k];
                    if (observedElementProperties.indexOf(property) === -1) {
                        observedElementProperties.push(property);
                    }
                }
            }
        }
        //console.timeEnd('cssToAttributes:updateObservedElementsList');
    };

    var unescapeValue = function (value) {
        var specialChars = ['!', ';', '{', '}', '"', '\''];
        for (var i = 0; i < specialChars.length; i++) {
            var specialChar = specialChars[i];
            value = value.split('\\' + specialChar).join(specialChar);
        }
        return value;
    };

    var updateObservedElements = function () {
        //console.time('cssToAttributes:updateObservedElements');
        var updatedElements = [];
        for (var i = 0; i < observedElements.length; i++) {
            var element = observedElements[i];
            if (!document.contains(element)) {
                continue;
            }
            var hasChange = false;
            var properties = observedElementsProperties[i];
            var elementStyle = getComputedStyle(element);
            for (var k = 0; k < properties.length; k++) {
                var property = properties[k];
                var value = unescapeValue(elementStyle.getPropertyValue(property).trim());
                var attributeName = property.substring(cssPropertyPrefixLength);
                if (value === '') {
                    if (element.getAttribute(attributeName) !== null) {
                        element.removeAttribute(attributeName);
                        hasChange = true;
                    }
                } else {
                    if (element.getAttribute(attributeName) !== value) {
                        element.setAttribute(attributeName, value);
                        hasChange = true;
                    }
                }
            }
            if (hasChange) {
                updatedElements.push(element);
            }
        }
        if (updatedElements.length > 0) {
            var event = new Event('css-to-attributes-change');
            event.elements = updatedElements;
            window.dispatchEvent(event);
        }
        //console.timeEnd('cssToAttributes:updateObservedElements');
    };

    var eventsAttached = false;
    var attachEvents = function () {
        if (eventsAttached) {
            return;
        }
        eventsAttached = true;
        window.addEventListener('resize', function () {
            updateObservedElementsList();
            updateObservedElements();
        });
        window.addEventListener('load', function () {
            updateObservedSelectorsList(true);
            updateObservedElementsList();
            updateObservedElements();
        });
        window.addEventListener('orientationchange', function () {
            updateObservedElementsList();
            updateObservedElements();
        });
        if (typeof MutationObserver !== 'undefined') {
            var observer = new MutationObserver(function (mutationList) {
                var hasChangeInHead = false;
                var hasExternalChange = false;
                for (var i = 0; i < mutationList.length; i++) {
                    var mutationItem = mutationList[i];
                    var mutationTarget = mutationItem.target;
                    if (documentHead.contains(mutationTarget)) {
                        hasChangeInHead = true;
                        hasExternalChange = true;
                        break;
                    }
                    if (!hasExternalChange) {
                        if (mutationItem.type === 'attributes') {
                            var index = observedElements.indexOf(mutationTarget);
                            if (index !== -1) {
                                if (observedElementsProperties[index].indexOf(cssPropertyPrefix + mutationItem.attributeName) === -1) {
                                    hasExternalChange = true;
                                }
                            } else {
                                hasExternalChange = true;
                            }
                        } else {
                            hasExternalChange = true;
                        }
                    }
                }
                if (hasChangeInHead) {
                    updateObservedSelectorsList(true);
                }
                if (hasExternalChange) {
                    updateObservedElementsList();
                    updateObservedElements();
                }
            });
            observer.observe(document, { childList: true, subtree: true, attributes: true });
        }
    };

    document.addEventListener('readystatechange', () => { // interactive or complete
        attachEvents();
        updateObservedSelectorsList(true);
        updateObservedElementsList();
        updateObservedElements();
    });
    if (document.readyState === 'complete') {
        attachEvents();
    }
    updateObservedSelectorsList(true);
    updateObservedElementsList();
    updateObservedElements();

    return {
        'run': function (forceCheckSelectors) {
            updateObservedSelectorsList(typeof forceCheckSelectors !== 'undefined' && forceCheckSelectors ? false : true);
            updateObservedElementsList();
            updateObservedElements();
        }
    };

}());