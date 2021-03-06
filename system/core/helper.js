﻿'use strict';

var me = module.exports;

var events = require('events');
var net = require('net');
var url = require('url');
var qs = require('querystring');
var u = require('util');
var q = require('q');

var libs = require('node-mod-load').libs;

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
    
    //TODO: Those 2 do not need getters or setters
    var _POST = null;
    var FILE = null;
    
    this.isDataComplete = false;
    
    this._COOKIE = {};
    this._domain = null;
    this._auth = null;
    this.cache = {};
    this.locked = false;
    this.uri = '';
    this.path = '/';
    this.SESSION = {};
    this.config = null;
    this.site = '';
    this.namespace = 'default';
    this.httpStatus = 500;
    this.responseType = 'text/plain';
    this.responseHeaders = {};
    this.responseTrailers = [];
    this.isResponseBinary = false;
    this.responseBody = '';
    this.responseEncoding = 'identity';
    this.request = null;
    this.response = null;
    this.resultPending = true;
    this.headerPending = true;
    
    this.cache.__defineGetter__('auth', function () {

        if (!self._auth) {

            self._auth = libs.auth.newAuth(self);
        }

        return self._auth;
    });

    this.__defineGetter__('GET', function () {
        
        if (_GET === null) {
            
            _GET = libs.SFFM.splitQueryString(self.path);
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
                    if (queryData.length > 1e6) { // can only handle requests smaller than 1e6 == 1MB, see Node.JS source code
                        
                        queryData = "";
                        self.response.writeHead(413, { 'Content-Type': 'text/plain' }).end();
                        self.request.connection.destroy();
                        defer.resolve(null);
                    }
                });
                
                self.request.on('end', function func_processPost_onEnd() {
                    
                    _POST = qs.parse(queryData);
                    defer.resolve(_POST);
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

    events.EventEmitter.call(this);
};

u.inherits(me.requestState, events.EventEmitter);
