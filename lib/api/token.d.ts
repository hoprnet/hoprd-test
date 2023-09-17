import { HoprDB } from '@hoprnet/hopr-utils';
declare enum LimitType {
    calls = 0
}
export type LimitTypeString = keyof typeof LimitType;
export type Limit = {
    type: LimitTypeString;
    conditions: {
        max?: number;
    };
    used?: number;
};
export type Capability = {
    endpoint: string;
    limits?: Array<Limit>;
};
export type Token = {
    id: string;
    capabilities: Array<Capability>;
    description?: string;
    valid_until?: number;
};
export declare function authenticateToken(db: HoprDB, id: string): Promise<Token>;
export declare function authorizeToken(db: HoprDB, token: Token, endpointRef: string): Promise<boolean>;
export declare function createToken(db: HoprDB, tokenScope: Token, capabilities: Array<Capability>, description?: string, lifetime?: number): Promise<Token>;
export declare function storeToken(db: HoprDB, token: Token): Promise<void>;
export declare function deleteToken(db: HoprDB, id: string): Promise<void>;
export declare function validateTokenCapabilities(capabilities: Array<Capability>): boolean;
export declare function validateScopedTokenCapabilities(scopeCapabilities: Array<Capability>, capabilities: Array<Capability>): boolean;
export declare function validateScopedTokenLifetime(scopeValidUntil: number, validUntil: number): boolean;
export {};
//# sourceMappingURL=token.d.ts.map