import type { State } from '../../types.js';
import type { PeerId } from '@libp2p/interface-peer-id';
import { Multiaddr } from '@multiformats/multiaddr';
import { ChannelEntry, HoprDB } from '@hoprnet/hopr-utils';
export declare const ALICE_PEER_ID: PeerId;
export declare const ALICE_MULTI_ADDR: Multiaddr;
export declare const ALICE_NATIVE_ADDR: () => import("@hoprnet/hopr-utils").Address;
export declare const BOB_PEER_ID: PeerId;
export declare const BOB_MULTI_ADDR: Multiaddr;
export declare const CHARLIE_PEER_ID: PeerId;
export declare const INVALID_PEER_ID = "definetly not a valid peerId";
export declare const TICKET_MOCK: {
    counterparty: {
        to_hex: () => string;
        to_string: () => string;
    };
    challenge: {
        to_hex: () => string;
        to_string: () => string;
    };
    epoch: {
        to_hex: () => string;
        to_string: () => string;
    };
    index: {
        to_hex: () => string;
        to_string: () => string;
    };
    amount: {
        to_hex: () => string;
        to_string: () => string;
    };
    win_prob: {
        to_hex: () => string;
        to_string: () => string;
    };
    channel_epoch: {
        to_hex: () => string;
        to_string: () => string;
    };
    signature: {
        to_hex: () => string;
        to_string: () => string;
    };
};
export declare function channelEntryCreateMock(): ChannelEntry;
/**
 * Creates express app and initializes all routes for testing
 * @returns apiInstance for openAPI validation and express instance for supertest requests
 */
export declare const createTestApiInstance: (node: any) => Promise<{
    api: import("openapi-framework").default;
    service: any;
}>;
/**
 * Creates express app and initializes all routes for testing
 * @returns apiInstance for openAPI validation and express instance for supertest requests with superuser authentication token set to superuser
 */
export declare const createAuthenticatedTestApiInstance: (node: any) => Promise<{
    api: import("openapi-framework").default;
    service: any;
}>;
/**
 * Used in tests to create state mocking.
 * @returns testing mocks
 */
export declare const createTestMocks: () => {
    setState(s: State): void;
    getState(): State;
};
/**
 * Used in tests to create a db mock for generic object storage
 * @returns testing mocked db
 */
export declare const createMockDb: () => HoprDB;
//# sourceMappingURL=fixtures.d.ts.map