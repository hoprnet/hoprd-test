/// <reference types="node" resolution-mode="require"/>
import { initialize } from 'express-openapi';
import type { Server } from 'http';
import type { Application } from 'express';
import type { WebSocketServer } from 'ws';
import type Hopr from '@hoprnet/hopr-core';
import { StateOps } from '../types.js';
import type { LogStream } from './../logs.js';
import type { Token } from './token.js';
declare enum AuthResult {
    Failed = 0,
    Authenticated = 1,
    Authorized = 2
}
export declare const RPCH_MESSAGE_REGEXP: RegExp;
export declare function setupRestApi(service: Application, urlPath: string, node: Hopr, stateOps: StateOps, options: {
    apiToken?: string;
    disableApiAuthentication?: boolean;
}): Promise<ReturnType<typeof initialize>>;
export declare function setupWsApi(server: Server, wss: WebSocketServer, node: Hopr, logStream: LogStream, options: {
    apiToken?: string;
}): void;
export declare class Context {
    node: Hopr;
    stateOps: StateOps;
    token: Token;
    authResult: AuthResult;
    constructor(node: Hopr, stateOps: StateOps);
}
declare global {
    namespace Express {
        interface Request {
            context: {
                node: Hopr;
                stateOps: StateOps;
                token: Token;
                authResult: AuthResult;
            };
        }
    }
}
export {};
//# sourceMappingURL=v2.d.ts.map