import ws from 'ws';
export type Socket = ws;
type Message = {
    type: 'log' | 'fatal-error' | 'status' | 'connected' | 'message';
    msg: string;
    ts: string;
};
export declare class LogStream {
    private messages;
    private connections;
    subscribe(sock: Socket): void;
    log(...args: string[]): void;
    error(message: string, trace: string): void;
    logFatalError(message: string): void;
    warn(message: string): void;
    debug(message: string): void;
    verbose(message: string): void;
    logStatus(status: 'READY' | 'PENDING'): void;
    logFullLine(...args: string[]): void;
    logConnectedPeers(peers: Iterable<string>): void;
    logMessage(...args: string[]): void;
    _log(msg: Message): void;
    _sendMessage(m: Message, s: Socket): void;
}
export {};
//# sourceMappingURL=logs.d.ts.map