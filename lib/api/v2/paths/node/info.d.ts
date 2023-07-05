import type Hopr from '@hoprnet/hopr-core';
/**
 * @returns Information about the HOPR Node, including any options it started with.
 */
export declare const getInfo: (node: Hopr) => Promise<{
    network: string;
    announcedAddress: string[];
    listeningAddress: string[];
    chain: string;
    hoprToken: string;
    hoprChannels: string;
    hoprNetworkRegistry: string;
    isEligible: boolean;
    connectivityStatus: string;
    channelClosurePeriod: number;
}>;
declare const _default: {
    GET: import("express-openapi").OperationHandlerArray;
};
export default _default;
//# sourceMappingURL=info.d.ts.map