﻿'use strict';

var me = module.exports;

var oa = require('object-assign');
var util = require('util');
var zip = require('zlib');
var q = require('q');
var crypt = require('crypto');
var streams = require('stream');

var libs = require('node-mod-load').libs;

var mp = {
    self: this
};


/**
 * Parses the request body and fills POST
 * 
 * @param Object $requestState
 */
var _parseRequestBody 
= me.parseRequestBody = function f_request_parseRequestBody($requestState) {
    
    var cl = $requestState.request.headers['content-length'];
    if (!cl || cl < 0) {
        
        $requestState.isDataComplete = true;
        return;
    }

    var body = ''; //new Buffer($requestState.request.headers['content-length'] * 1);
    $requestState.request.on('data', function ($chunk) {
    
        //body.fill($chunk.toString(), offset, offset + $chunk.length);
        //offset += $chunk.length;
        body += $chunk;
    });

    $requestState.request.once('end', function () {
        
        var ct = $requestState.request.headers['content-type'];
        switch (ct) {

            case 'application/x-www-form-urlencoded': {

                $requestState.POST = libs.SFFM.splitQueryString(body);
                break;
            }

            default: {

                var regexFD = /^multipart\/form-data\s*;\s*boundary=(.+)$/i;
                var match = regexFD.exec(ct);
                if (!match) {
                    
                    $requestState.POST = libs.SFFM.splitQueryString(body);
                    break;
                }
                
                var boundary = '--' + match[1];
                var offset = 0;
                var l = boundary.length;
                var dhStartIndex = 0;
                var dhStopIndex = 0;
                var index = body.indexOf(boundary, offset);
                var data = '';
                var nlL = 1;
                var regexCD = /Content\-Disposition\s*\:\s*(.+)?\n/i;
                var regexCDT = /^([\w-]+)\s*?\;?/i;
                var regexCDN = /name[^;=\n]*=\"?([^;\n"]+)/i;
                var regexCDFN = /filename[^;=\n]*=\"?([^;\n"]+)/i
                var dh = '';
                var cd = '';
                var cdType = '';
                var cdName = '';
                var cdFilename = '';
                while (index >= 0) {

                    index += l;
                    if (body.substr(index, 2) === '--') {

                        break;
                    }

                    offset = index;
                    dhStartIndex = index + 1;
                    dhStopIndex = body.indexOf('\n\n', dhStartIndex) + 2;
                    if (dhStopIndex <= 1) {
                        
                        dhStopIndex = body.indexOf('\r\n\r\n', dhStartIndex) + 4;
                        nlL = 2;
                    }

                    index = body.indexOf(boundary, offset);
                    dh = body.substring(dhStartIndex, dhStopIndex);
                    data = new Buffer(body.substring(dhStopIndex, index - nlL));

                    cd = regexCD.exec(dh);
                    if (cd === undefined) {

                        break;
                    }

                    cdType = regexCDT.exec(cd);
                    cdName = regexCDN.exec(cd)[1];
                    cdFilename = regexCDFN.exec(cd)[1];
                    
                    if (cdFilename === undefined) {

                        $requestState.POST[cdName] = data;
                    }
                    else {

                        $requestState.FILE[cdName] = {

                            filename: cdFilename,
                            filetype: cdType,
                        }
                    }
                    
                    //TODO: Handle multiple boundary names
                }
            }
        }

        $requestState.isDataComplete = true;
    });
};

/**
 * Handles the HTTP request from a client
 * 
 * @param Object $requestState
 */
var _handleRequest 
= me.handleRequest = function f_request_handleRequest($requestState) {
    
    $requestState.httpStatus = 501;
    _parseRequestBody($requestState);
    
    var log = libs.log.newLog($requestState);

    var unblock;
    if (typeof $requestState.config === 'undefined') {
        
        $requestState.response.writeHead(404, { 'Server': 'SHPS' });
        $requestState.response.end('The requested domain is not configured!');
        $requestState.resultPending = false;
    }
    else {
        $requestState.site = $requestState.GET['site'] ? $requestState.GET['site']
                                                       : $requestState.config.generalConfig.indexContent.value;
        
        var siteHandler = function ($loop) {
            
            // "Do Not Track"-handling. We're nice, ain't we :)
            if ($requestState.request.headers['dnt'] !== '1') {
                
                $requestState.SESSION['lastSite'] = $requestState.site;
            }
            
            var defer = q.defer();
            defer.resolve($loop);

            return defer.promise;
        }

        if ($requestState.path === '/favicon.ico') {
            
            // annoying browsers ask for favicon.ico if not specified... have to handle this...
            $requestState.httpStatus = 404;
            var p = q.defer();
            p.resolve('not implemented yet');
            unblock = p.promise;
        }
        else if (typeof $requestState.GET['request'] !== 'undefined') {
            
            // handle request
            unblock = libs.make.requestResponse($requestState, $requestState.GET['request'], typeof $requestState.GET['ns'] !== 'undefined' ? $requestState.GET['ns'] : 'default');
        }
        else if (typeof $requestState.GET['plugin'] !== 'undefined') {
            
            // call plugin
            if (libs.plugin.pluginExists($requestState.GET['plugin'])) {
                
                unblock = libs.plugin.callPluginEvent($requestState, 'onDirectCall', $requestState.GET['plugin'], $requestState);
            }
            else {
                
                $requestState.httpStatus = 404;
            }
        }
        else if (typeof $requestState.GET['file'] !== 'undefined') {
            
            // serve file
            unblock = libs.file.serveFile($requestState, $requestState.GET['file']);
        }
        else if (typeof $requestState.GET['js'] !== 'undefined') {

        // present JS
        }
        else if (typeof $requestState.GET['css'] !== 'undefined') {
            
            var tmp = libs.css.newCSS($requestState);
            unblock = tmp.handle();
        }
        else if (typeof $requestState.GET['site'] !== 'undefined') {
            
            // transmit site
            unblock = libs.make.siteResponse($requestState, $requestState.GET['site'], $requestState.GET['ns']).then(siteHandler);
            
        }
        else if (typeof $requestState.GET['HTCPCP'] !== 'undefined' && libs.main.getHPConfig('eastereggs')) {
            
            $requestState.httpStatus = 418;
            $requestState.responseType = 'text/plain';
            $requestState.responseBody = 'ERROR 418: I\'m a teapot!';
        }
        else {
            
            // if they don't know what they want, they should just get the index site...
            $requestState.GET['site'] = $requestState.site;
            unblock = libs.make.siteResponse($requestState, $requestState.GET['site'], $requestState.GET['ns']).then(siteHandler, siteHandler);
        }
    }
    
    if (typeof unblock === 'undefined') {
        
        unblock = {
        
            then: function ($cb) {

                $cb();
                return this;
            },

            done: function ($cb) {
                
                if ($cb) {

                    $cb();
                }
                return this;
            }
        };
    }
    
    var errFun = function ($err) {
        
        $requestState.response.writeHead(500, { 'Server': 'SHPS' });
        $requestState.response.end($err.toString());//TODO: don't send error info -> might be sensitive data
    };

    // This is just here to ease the transition from using Q to using native Promises
    if (!unblock.done) {

        unblock.done = unblock.then;
    }

    unblock.done(function () {
        
        if (!$requestState.resultPending && !$requestState.headerPending) {
            
            return;
        }

        if ($requestState.resultPending) {
            
            $requestState.responseBody = libs.optimize.compressStream($requestState, $requestState.responseBody, Buffer.byteLength($requestState.responseBody, 'utf8'));
        }
        
        var headers = {
            
            'Age': 0, // <-- insert time since caching here
            'Cache-Control': $requestState.config.generalConfig.timeToCache.value,
            'Content-Type': $requestState.responseType + ';charset=utf-8',
            //'Date': Date.now.toString(), // <-- automatically sent by Node.JS
            'Set-Cookie': $requestState.COOKIE.getChangedCookies(),
            
            'X-Content-Type-Options': 'nosniff',
            'X-XSS-Protection': '1;mode=block',
            
            // ASVS V2 3.10
            'X-Frame-Options': 'SAMEORIGIN',
        };
        
        var trailerHeaders = {

            'Server': 'SHPS',
            'X-Powered-By': 'SHPS4Node',
            //'Content-MD5': '', // <-- useless for HTML sites. Will not implement it since it only serves the purpose of increasing latency. Will leave here as a reminder.
            // 'Etag': <-- insert cache token here (change token whenever the cache was rebuilt)
        };
        
        if (libs.main.isDebug()) {

            trailerHeaders['X-Powered-By'] = 'SHPS4Node/' + SHPS_VERSION + SHPS_BUILD;
            trailerHeaders['X-Version'] = SHPS_VERSION;
        }
        
        if (typeof $requestState.responseHeaders !== 'undefined') {
            
            headers = oa(headers, $requestState.responseHeaders);
        }
        
        if (typeof $requestState.responseTrailers !== 'undefined') {
            
            trailerHeaders = oa(trailerHeaders, $requestState.responseTrailers);
        }
        
        var useTrailers = $requestState.request.headers.TE && $requestState.request.headers.TE.match(/trailers/i);
        if (useTrailers) {
            
            headers['Trailer'] = Object.keys(trailerHeaders).join(',');
        }
        else {
            
            headers = oa(headers, trailerHeaders);
        }
        
        if (libs.SFFM.isHTTPS($requestState.request)) {
            
            // ASVS V2 3.15
            headers['Strict-Transport-Security'] = 'max-age=' + $requestState.config.securityConfig.STSTimeout.value;
            if ($requestState.config.securityConfig.STSIncludeSubDomains.value) {
                
                headers['Strict-Transport-Security'] += ';includeSubDomains';
            }
            
            // SSLLabs suggestion
            if ($requestState.config.TLSConfig.keypin.value != '') {
                
                //TODO: calculate the keypin with openssl
                //Don't use keypin for self-made certificates!
                headers['Public-Key-Pins'] = 'pin-sha256="' + $requestState.config.TLSConfig.keypin.value + '";max-age=2592000';
                if ($requestState.config.securityConfig.HPKPIncludeSubDomains.value) {
                    
                    headers['Public-Key-Pins'] += ';includeSubDomains'
                }
            }
        }
        
        var errfun = function ($err) {

            log.writeError($err);
        };

        var respFun = function ($lang) {
            
            var defer = q.defer();
            if ($requestState.resultPending && typeof $requestState.responseBody === 'string') {
                
                defer.resolve();
                headers['Content-Length'] = libs.SFFM.stringByteLength($requestState.responseBody);
            }
            else if ($requestState.resultPending && $requestState.responseBody && $requestState.responseBody.on) {
                
                var tmp = '';
                var tmpS = new streams.PassThrough();
                $requestState.responseBody.on('data', function ($chunk) {
                    
                    tmp += $chunk;
                    tmpS.write($chunk);
                });

                $requestState.responseBody.once('end', function () {
                    
                    //$requestState.responseBody = tmp;
                    $requestState.responseBody = tmpS;
                    headers['Content-Length'] = tmp.length;
                    defer.resolve();
                });
            }
            else {

                defer.resolve();
            }
                
            headers['Content-Encoding'] = $requestState.responseEncoding;
            headers['Content-Language'] = $lang;
            
            defer.promise.done(function () {
                
                if ($requestState.headerPending && !$requestState.response.headersSent) {
                    
                    $requestState.response.writeHead($requestState.httpStatus, headers);
                    //$requestState.response.flushHeaders();
                    $requestState.emit('headSent');
                }

                if ($requestState.resultPending) {
                    
                    if (typeof $requestState.responseBody.pipe === 'function') {
                        
                        $requestState.responseBody.pipe($requestState.response);
                        $requestState.resultPending = false;
                    }
                    else {
                        
                        $requestState.response.write($requestState.responseBody, $requestState.isResponseBinary ? 'binary'
                                                                                                                : 'utf8');
                    }
                    
                    $requestState.emit('bodySent');
                }
                
                if (useTrailers) {
                    
                    $requestState.response.addTrailers(trailerHeaders);
                }
                
                if ($requestState.resultPending) {
                    
                    $requestState.response.end();
                }
            }, errfun);
        };

        libs.language.newLang($requestState).getLanguage().done(respFun, function ($err) {
                        
            respFun('na');        
        });
    }, errFun);
};


var _focus 
= me.focus = function f_request_focus($requestState) {

    if (typeof $requestState !== 'undefined') {
        
        log.error('Cannot focus undefined requestState!');
    }
    
    this.handleRequest = function f_request_focus_handleRequest() {
        
        _handleRequest($requestState);
    };
};
