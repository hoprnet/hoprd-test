import type { PeerId } from '@libp2p/interface-peer-id';
export declare enum IdentityErrors {
    FAIL_TO_LOAD_IDENTITY = "Could not load identity",
    EMPTY_PASSWORD = "Password must not be empty",
    WRONG_USAGE_OF_WEAK_CRYPTO = "Attempting to use a development key while not being in development mode",
    WRONG_PASSPHRASE = "Key derivation failed - possibly wrong passphrase",
    INVALID_PRIVATE_KEY_GIVEN = "Invalid private key was given",
    INVALID_SECPK256K1_PRIVATE_KEY_GIVEN = "The key given was not at least 32 bytes long"
}
export declare enum IdentityLogs {
    USING_WEAK_CRYPTO = "Using weaker key protection to accelerate node startup"
}
export type IdentityOptions = {
    initialize: boolean;
    idPath: string;
    password: string;
    useWeakCrypto?: boolean;
    privateKey?: Uint8Array;
};
export declare function getIdentity(options: IdentityOptions): Promise<PeerId>;
//# sourceMappingURL=identity.d.ts.map