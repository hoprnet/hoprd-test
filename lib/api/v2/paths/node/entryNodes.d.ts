import type Hopr from '@hoprnet/hopr-core';
export type EntryNodeInfo = {
    [index: string]: {
        multiaddrs: string[];
        isEligible: boolean;
    };
};
export declare function getEntryNodes(node: Hopr): Promise<EntryNodeInfo>;
declare const _default: {
    GET: import("express-openapi").OperationHandlerArray;
};
export default _default;
//# sourceMappingURL=entryNodes.d.ts.map