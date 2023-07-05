import type { default as Hopr } from '@hoprnet/hopr-core';
import { type ChannelEntry } from '@hoprnet/hopr-utils';
import { STATUS_CODES } from '../../utils.js';
export interface ChannelInfo {
    type: 'outgoing' | 'incoming';
    channelId: string;
    peerId: string;
    status: string;
    balance: string;
}
export interface ChannelTopologyInfo {
    channelId: string;
    sourcePeerId: string;
    destinationPeerId: string;
    sourceAddress: string;
    destinationAddress: string;
    balance: string;
    status: string;
    commitment: string;
    ticketEpoch: string;
    ticketIndex: string;
    channelEpoch: string;
    closureTime: string;
}
/**
 * Format channel entries
 * @param channel channelEntry entity saved in the database
 * @returns stringified fields from ChannelEntry and both peer id and address for source/destination
 */
export declare const formatChannelTopologyInfo: (channel: ChannelEntry) => ChannelTopologyInfo;
export declare const formatOutgoingChannel: (channel: ChannelEntry) => ChannelInfo;
export declare const formatIncomingChannel: (channel: ChannelEntry) => ChannelInfo;
/**
 * @returns List of incoming and outgoing channels associated with the node.
 */
export declare const getChannels: (node: Hopr, includingClosed: boolean) => Promise<{
    incoming: ChannelInfo[];
    outgoing: ChannelInfo[];
    all: any[];
}>;
/**
 * @returns List of all the channels
 */
export declare const getAllChannels: (node: Hopr) => Promise<{
    incoming: any[];
    outgoing: any[];
    all: ChannelTopologyInfo[];
}>;
/**
 * Opens channel between two parties.
 * @returns The PeerId associated with the alias.
 */
export declare function openChannel(node: Hopr, counterpartyStr: string, amountStr: string): Promise<{
    success: false;
    reason: keyof typeof STATUS_CODES;
} | {
    success: true;
    channelId: string;
    receipt: string;
}>;
declare const _default: {
    POST: import("express-openapi").OperationHandlerArray;
    GET: import("express-openapi").OperationHandlerArray;
};
export default _default;
//# sourceMappingURL=index.d.ts.map