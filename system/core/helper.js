﻿'use strict';

var me = module.exports;

var net = require('net');
var url = require('url');
var qs = require('querystring');
var u = require('util');

var q = require('q');

var cookie = require('./cookie.js');
var log = require('./log.js');
var request = require('./request.js');
var SFFM = require('./SFFM.js');

var mp = {
    self: this
};


/**
 * Domain representation class
 */
me.SHPS_domain = function ($uri, $prependHTTPProtocol/* = false */) {
    
    if ($prependHTTPProtocol && !/^https?\:\/\//i.test($uri)) {
        
        $uri = 'http://' + $uri;
    }

    var parsed = url.parse($uri, true, true);
    var colon = parsed.href.indexOf(':');
    
    if (parsed.hostname) {

        var a = parsed.hostname.split('.');
        
        parsed.tld = a[a.length - 1];
        a.splice(a.length - 1, 1);
        parsed.sld = a[a.length - 1];
        a.splice(a.length - 1, 1);
        if (a.length > 0) {
            
            parsed.sub = a.join('.');
        }
    }
    
    parsed.toString = function () {
        
        return parsed.href;
    };
    
    return parsed;
};

/**
 * Contains state of request:
 * - Domain info
 * - GET and POST variables
 */
me.requestState = function () {
    
    var self = this;
    var _GET = null;
    var _POST = null;
    
    this._COOKIE = [];
    this.cache = {};
    this.locked = false;
    this.uri = '';
    this.path = '/';
    this.SESSION = [];
    this.config = null;
    this.site = '';
    this.namespace = 'default';
    this.httpStatus = 500;
    this.responseType = 'text/plain';
    this.responseHeaders = undefined;
    this.isResponseBinary = false;
    this.responseBody = '';
    this.responseEncoding = 'identity';
    this.request = null;
    this.result = null;
    this.resultPending = true;
    
    this.__defineGetter__('GET', function () {
        
        if (_GET === null) {
            
            _GET = SFFM.splitQueryString(self.path);
        }
        
        return _GET;
    });
    
    this.__defineSetter__('GET', function ($val) {
        
        _GET = $val
    });
    
    this.__defineGetter__('POST', function () {
        
        if (_POST === null) {
            
            var defer = q.defer();
            var queryData = '';
            
            if (self.request.method == 'POST') {
                
                self.request.on('data', function func_processPost_onData($data) {
                    
                    queryData += $data;
                    if (queryData.length > 1e6) { // can only handle requests smaller than 1e6 == 1MB
                        
                        queryData = "";
                        self.response.writeHead(413, { 'Content-Type': 'text/plain' }).end();
                        self.request.connection.destroy();
                        defer.resolve(null);
                    }
                });
                
                self.request.on('end', function func_processPost_onEnd() {
                    
                    defer.resolve(querystring.parse(queryData));
                });
            }
            else {
                
                defer.resolve(null);
            }
            
            return defer.promise;
        }
        
        return _POST;
    });
    
    this.__defineSetter__('POST', function ($val) {
        
        _POST = $val
    });
};

/**
 * Grouphuggable
 * https://github.com/php-fig/fig-standards/blob/master/proposed/psr-8-hug/psr-8-hug.md
 * Breaks after when $breakCondition returns false
 * 
 * @param $hug object
 *  Huggable caller
 *  
 * @param $self object
 *  Hugged object
 *  
 * @param $breakCondition function(int)
 *  break condition (returns false on break)
 *  Takes number of preceded hugs from specific partner as first parameter
 */
var _genericHug 
= me.genericHug = function f_helper_genericHug($h, $self, $breakCondition) {
    
    if (typeof $self.hug.lastPartner === 'undefined') {
        
        $self.hug.lastPartner = [];
    }
    
    if (typeof $self.hug.lastPartner[$self] === 'undefined') {
        
        $self.hug.lastPartner[$self] = $h;
    }
    
    if (typeof $self.hug.count === 'undefined') {
        
        $self.hug.count = [];
    }
    
    if ($self.hug.lastPartner[$self] != $h) {
        
        $self.hug.lastPartner[$self] = $h;
        $self.hug.count[$self] = [];
    }
    
    if (typeof $self.hug.count[$self] === 'undefined') {
        
        $self.hug.count[$self] = [];
    }
    
    if (!u.isArray($h)) {
        
        $h = [$h];
    }
    
    var i = 0;
    var l = $h.length;
    while (i < l) {
        
        if (!$self.hug.count[$self][$h[i]]) {
            
            $self.hug.count[$self][$h[i]] = 0;
        }
        
        $self.hug.count[$self][$h[i]]++;
        if (!$breakCondition($self.hug.count[$self][$h[i]])) {
            
            i++;
            continue;
        }
        
        $h[i].self.hug($self);
        i++;
    }
    
    return $self;
};

/**
 * Grouphuggable
 * Breaks after 3 hugs per partner
 * 
 * @param $hug
 *  Huggable caller
 */
var _hug 
= me.hug = function f_helper_hug($h) {
    
    return helper.genericHug($h, mp, function f_helper_hug_hug($hugCount) {
        
        if ($hugCount > 3) {
            
            return false;
        }
        
        return true;
    });
};