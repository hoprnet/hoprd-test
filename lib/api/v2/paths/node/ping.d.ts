import type Hopr from '@hoprnet/hopr-core';
/**
 * Pings another node to check its availability.
 * @returns Latency and HOPR protocol version (once known) if ping was successful.
 */
export declare const ping: ({ node, peerId }: {
    node: Hopr;
    peerId: string;
}) => Promise<{
    latency: number;
    reportedVersion: any;
}>;
declare const _default: {
    POST: import("express-openapi").OperationHandlerArray;
};
export default _default;
//# sourceMappingURL=ping.d.ts.map