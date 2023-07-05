import type Hopr from '@hoprnet/hopr-core';
/**
 * @returns Current HOPR and native balance.
 */
export declare const getBalances: (node: Hopr) => Promise<{
    native: import("@hoprnet/hopr-utils").Balance;
    hopr: import("@hoprnet/hopr-utils").Balance;
}>;
declare const _default: {
    GET: import("express-openapi").OperationHandlerArray;
};
export default _default;
//# sourceMappingURL=balances.d.ts.map