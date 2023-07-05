import type Hopr from '@hoprnet/hopr-core';
export declare const getTickets: (node: Hopr, peerId: string) => Promise<{
    counterparty: string;
    challenge: string;
    epoch: string;
    index: string;
    amount: string;
    winProb: string;
    channelEpoch: string;
    signature: string;
}[]>;
declare const _default: {
    GET: import("express-openapi").OperationHandlerArray;
};
export default _default;
//# sourceMappingURL=tickets.d.ts.map