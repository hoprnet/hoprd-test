import type Hopr from '@hoprnet/hopr-core';
export declare const getTicketsStatistics: (node: Hopr) => Promise<{
    pending: number;
    unredeemed: number;
    unredeemedValue: string;
    redeemed: number;
    redeemedValue: string;
    losingTickets: number;
    winProportion: number;
    neglected: number;
    rejected: number;
    rejectedValue: string;
}>;
declare const _default: {
    GET: import("express-openapi").OperationHandlerArray;
};
export default _default;
//# sourceMappingURL=statistics.d.ts.map