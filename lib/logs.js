import ws from 'ws';
import { debug } from '@hoprnet/hopr-utils';
// ensure log including JSON objects is always printed on a single line
const debugBase = debug('hoprd');
const debugLog = (msg) => debugBase('%o', msg);
const MAX_MESSAGES_CACHED = 100;
//
// @implements LoggerService of nestjs
export class LogStream {
    constructor() {
        this.messages = [];
        this.connections = [];
    }
    subscribe(sock) {
        debugLog('WS subscribing socket');
        this.connections.push(sock);
        this.messages.forEach((m) => {
            this._sendMessage(m, sock);
        });
    }
    log(...args) {
        const msg = { type: 'log', msg: `${args.join(' ')}`, ts: new Date().toISOString() };
        this._log(msg);
    }
    error(message, trace) {
        this.log(message);
        this.log(trace);
    }
    logFatalError(message) {
        const msg = { type: 'fatal-error', msg: message, ts: new Date().toISOString() };
        this._log(msg);
    }
    warn(message) {
        this.log('WARN', message);
    }
    debug(message) {
        this.log('DEBUG', message);
    }
    verbose(message) {
        this.log('VERBOSE', message);
    }
    logStatus(status) {
        const msg = { type: 'status', msg: status, ts: new Date().toISOString() };
        this._log(msg);
    }
    logFullLine(...args) {
        const msg = { type: 'log', msg: args.join(' '), ts: new Date().toISOString() };
        this._log(msg);
    }
    logConnectedPeers(peers) {
        const it = peers[Symbol.iterator]();
        let chunk = it.next();
        let msg = '';
        while (!chunk.done) {
            msg += chunk.value;
            chunk = it.next();
            if (!chunk.done) {
                msg += ', ';
            }
        }
        this._log({ type: 'connected', msg, ts: new Date().toISOString() });
    }
    logMessage(...args) {
        const msg = { type: 'message', msg: args.join(' '), ts: new Date().toISOString() };
        this._log(msg);
    }
    _log(msg) {
        debugLog(msg);
        this.messages.push(msg);
        if (this.messages.length > MAX_MESSAGES_CACHED) {
            // Avoid memory leak
            this.messages.splice(0, this.messages.length - MAX_MESSAGES_CACHED); // delete elements from start
        }
        this.connections.forEach((conn, i) => {
            if (conn.readyState == ws.OPEN) {
                this._sendMessage(msg, conn);
            }
            else {
                // Handle bad connections:
                if (conn.readyState !== ws.CONNECTING) {
                    // Only other possible states are closing or closed
                    this.connections.splice(i, 1);
                }
            }
        });
    }
    _sendMessage(m, s) {
        s.send(JSON.stringify(m));
    }
}
//# sourceMappingURL=logs.js.map