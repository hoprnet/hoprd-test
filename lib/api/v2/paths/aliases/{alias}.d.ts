import type { State, StateOps } from '../../../../types.js';
/**
 * Removes alias and it's assigned PeerId.
 * Updates HOPRd's state.
 * @returns new state
 */
export declare const removeAlias: (stateOps: StateOps, alias: string) => State;
/**
 * @returns The PeerId associated with the alias.
 */
export declare const getAlias: (state: Readonly<State>, alias: string) => string;
declare const _default: {
    GET: import("express-openapi").OperationHandlerArray;
    DELETE: import("express-openapi").OperationHandlerArray;
};
export default _default;
//# sourceMappingURL=%7Balias%7D.d.ts.map