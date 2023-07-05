import type Hopr from '@hoprnet/hopr-core';
import type { Operation } from 'express-openapi';
import type { PeerId } from '@libp2p/interface-peer-id';
export declare const getPeerInfo: (node: Hopr, peerId: PeerId) => Promise<{
    announced: string[];
    observed: string[];
}>;
export declare const GET: Operation;
//# sourceMappingURL=%7Bpeerid%7D.d.ts.map