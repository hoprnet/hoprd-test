import type Hopr from '@hoprnet/hopr-core';
import { State, StateOps } from '../../../../types.js';
/**
 * Sets node setting/s in HOPRd state.
 * Updates HOPRd's state.
 * @returns Setting value or all settings values.
 */
export declare const setSetting: (node: Hopr, stateOps: StateOps, key: keyof State['settings'], value: any) => void;
declare const _default: {
    PUT: import("express-openapi").OperationHandlerArray;
};
export default _default;
//# sourceMappingURL=%7Bsetting%7D.d.ts.map