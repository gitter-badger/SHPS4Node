'use strict';

var me = module.exports;

var helper = require('./helper.js');

var mp = {
    self: this
};


var _CL 
= me.CL = function c_CL($requestState) {
    
    var _makeHyperlink =
    this.makeHyperlink = function ($ref, $description, $basicAttributes, $newTab, $namespace, $ssl) {
        $basicAttributes = typeof $basicAttributes !== 'undefined' ? $basicAttributes : null;
        $newTab = typeof $newTab !== 'undefined' ? $newTab : false;
        $namespace = typeof $namespace !== 'undefined' ? $namespace : null;
        $ssl = typeof $ssl !== 'undefined' ? $ssl : null;
        
        var url;
        if (!$ref.match(/[a-zA-Z_\-]+/)) {
            
            var attr = ' rel="nofollow"';
            url = $ref;
        }
        else {
            
            var attr = '';
            var param = {};
            var rawURL = _buildURL($namespace, $ssl, false);
            url = rawURL.url;
            if ($ref !== $requestState.config.generalConfig.URL.value) {

                url += rawURL.paramChar + 'site=' + $ref;
                rawURL.paramChar = '&';
            }
        }
        
        if ($basicAttributes !== null) {
            
            attr += ' ' + $basicAttributes;
        }
        
        if ($newTab) {
            
            attr += ' target="_blank"';
        }
        
        return '<a href="' + url + '"' + attr + '>' + $description + '</a>';
    };
    
    /**
     * Get raw URL<br>
     * This is handy, if just lang and sessID etc. is needed which will not
     * change the site
     * 
     * @param string|null $namespace
     *   If namespace is null, the currently used namespace is inserted //Default: null
     * @param boolean|null $ssl
     *   Should SSL be used? If null, the current protocol will be used //Default: null
     * @param boolean $resourceURL
     *   Should the static resource URL be used? //Default: false
     * @return Object(url, paramChar, toString()->url)
     */
    var _buildURL =
    this.buildURL = function f_componentLibrary_buildURL($namespace, $ssl, $resourceURL) {
        $namespace = typeof $namespace !== 'undefined' ? $namespace : null;
        $ssl = typeof $ssl !== 'undefined' ? $ssl : null;
        $resourceURL = typeof $resourceURL !== 'undefined' ? $resourceURL : false;
        
        var url;
        var pc = '/?';
        if ($ssl === null) {
            
            url = '//';
        }
        else if ($ssl) {
            
            url = 'https://';
        }
        else {
            
            url = 'http://';
        }
        
        if ($resourceURL) {
            
            url += $requestState.config.generalConfig.staticResourcesURL.value;
        }
        else {
            
            url += $requestState.config.generalConfig.URL.value;
        }
        
        if ($requestState.domain.port) {
            
            url += ':' + $requestState.domain.port
        }
        
        if (typeof $requestState.GET['lang'] !== 'undefined') {
            
            url += pc + 'lang=' + $requestState.GET['lang'];
            pc = '&';
        }
        
        if ($namespace === null) {
            
            if ($requestState.namespace !== 'default') {
                
                url += pc + 'ns=' + $requestState.namespace;
                pc = '&';
            }
        }
        else {
            
            url += pc + 'ns=' + $namespace;
            pc = '&';
        }

        return {
            
            url: url,
            paramChar: pc,
            toString: function () { return url; },
        };
    };
    
    /**
     * Grouphuggable
     * https://github.com/php-fig/fig-standards/blob/master/proposed/psr-8-hug/psr-8-hug.md
     * Breaks after 3 hugs per partner
     * 
     * @param $hug
     *  Huggable caller
     */
    var _hug =
    this.hug = function f_componentlibrary_hug($h) {
        
        return helper.genericHug($h, mp, function f_componentlibrary_hug_hug($hugCount) {
            
            if ($hugCount > 3) {
                
                return false;
            }
            
            return true;
        });
    };
};

var _newCL 
= me.newCL = function f_componentLibrary_newCL($requestState) {
    
    return new _CL($requestState);
};
