import type Hopr from '@hoprnet/hopr-core';
export type PeerInfo = {
    peerId: string;
    multiAddr?: string;
    heartbeats: {
        sent: number;
        success: number;
    };
    lastSeen: number;
    quality: number;
    backoff: number;
    isNew: boolean;
    reportedVersion: string;
};
/**
 * @param node a hopr instance
 * @param quality a float range from 0 to 1
 * @returns List of peers alongside their connection status.
 */
export declare function getPeers(node: Hopr, quality: number): Promise<{
    announced: PeerInfo[];
    connected: PeerInfo[];
}>;
declare const _default: {
    GET: import("express-openapi").OperationHandlerArray;
};
export default _default;
//# sourceMappingURL=peers.d.ts.map