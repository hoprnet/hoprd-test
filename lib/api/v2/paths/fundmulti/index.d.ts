import type { default as Hopr } from '@hoprnet/hopr-core';
import { STATUS_CODES } from '../../utils.js';
/**
 * Fund channel between two parties (between this node and another one).
 * @returns two channel ids (outgoing and incoming)
 */
export declare function fundMultiChannels(node: Hopr, counterpartyStr: string, outgoingAmountStr: string, incomingAmountStr: string): Promise<{
    success: false;
    reason: keyof typeof STATUS_CODES;
} | {
    success: true;
    outgoingChannelId: string;
    incomingChannelId: string;
    receipt: string;
}>;
declare const _default: {
    POST: import("express-openapi").OperationHandlerArray;
};
export default _default;
//# sourceMappingURL=index.d.ts.map