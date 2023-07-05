import type Hopr from '@hoprnet/hopr-core';
/**
 * Withdraws specified amount of specified currency from the node.
 * @returns Transaction hash if transaction got successfully submited.
 */
export declare const withdraw: (node: Hopr, currency: 'native' | 'hopr', recipient: string, amount: string) => Promise<string>;
declare const _default: {
    POST: import("express-openapi").OperationHandlerArray;
};
export default _default;
//# sourceMappingURL=withdraw.d.ts.map