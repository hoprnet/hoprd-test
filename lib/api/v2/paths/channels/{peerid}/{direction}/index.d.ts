import type Hopr from '@hoprnet/hopr-core';
import { STATUS_CODES } from '../../../../utils.js';
import { ChannelInfo } from '../../index.js';
import { ChannelStatus } from '@hoprnet/hopr-utils';
/**
 * Closes a channel with provided peerId.
 * @returns Channel status and receipt.
 */
export declare function closeChannel(node: Hopr, peerIdStr: string, direction: ChannelInfo['type']): Promise<{
    success: false;
    reason: keyof typeof STATUS_CODES;
} | {
    success: true;
    channelStatus: ChannelStatus;
    receipt: string;
}>;
/**
 * Fetches channel between node and counterparty in the direction provided.
 * @returns the channel between node and counterparty
 */
export declare const getChannel: (node: Hopr, counterparty: string, direction: ChannelInfo['type']) => Promise<ChannelInfo>;
declare const _default: {
    DELETE: import("express-openapi").OperationHandlerArray;
    GET: import("express-openapi").OperationHandlerArray;
};
export default _default;
//# sourceMappingURL=index.d.ts.map