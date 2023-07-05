import type Hopr from '@hoprnet/hopr-core';
import type { Ticket } from '@hoprnet/hopr-utils';
export declare var formatTicket: (ticket: Ticket) => {
    counterparty: string;
    challenge: string;
    epoch: string;
    index: string;
    amount: string;
    winProb: string;
    channelEpoch: string;
    signature: string;
};
export declare const getAllTickets: (node: Hopr) => Promise<{
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
//# sourceMappingURL=index.d.ts.map