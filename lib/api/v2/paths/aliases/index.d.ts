import type { State, StateOps } from '../../../../types.js';
/**
 * Sets an alias and assigns the PeerId to it.
 * Updates HOPRd's state.
 * @returns new state
 */
export declare const setAlias: (stateOps: StateOps, alias: string, peerId: string) => State;
/**
 * @returns All PeerIds keyed by their aliases.
 */
export declare const getAliases: (state: Readonly<State>) => {
    [alias: string]: string;
};
declare const _default: {
    GET: import("express-openapi").OperationHandlerArray;
    POST: import("express-openapi").OperationHandlerArray;
};
export default _default;
//# sourceMappingURL=index.d.ts.map