import { STATUS_CODES } from './v2/utils.js';
/**
 * Authenticates a websocket connection.
 * Will first check from `apiToken` parameter in URL,
 * then try to find `X-Auth-Token` in the cookies.
 * @returns true if connection is authenticated
 */
export declare const authenticateWsConnection: (req: {
    url?: string;
    headers: Record<any, any>;
}, apiToken: string) => boolean;
/**
 * Given a URL path, we strip away query parameters and tailing slash.
 * @param path
 * @returns stripped path
 * @example `/api/v2/messages/websocket?apiToken=^^LOCAL-testing-123^^` becomes `/api/v2/messages/websocket`
 * @example `/api/v2/messages/websocket/?apiToken=^^LOCAL-testing-123^^` becomes `/api/v2/messages/websocket`
 */
export declare const removeQueryParams: (path: string) => string;
export declare const getStatusCodeForInvalidInputInRequest: (inputPath: string) => STATUS_CODES.INVALID_INPUT | STATUS_CODES.INVALID_PEERID | STATUS_CODES.INVALID_CURRENCY | STATUS_CODES.INVALID_AMOUNT | STATUS_CODES.INVALID_ADDRESS | STATUS_CODES.INVALID_SETTING | STATUS_CODES.INVALID_SETTING_VALUE | STATUS_CODES.INVALID_QUALITY;
/**
 * Adds the current timestamp to the message in order to measure the latency.
 * @param msg the message
 */
export declare function encodeMessage(msg: string): Uint8Array;
/**
 * Tries to decode the message and returns the message as well as
 * the measured latency.
 * @param encoded an encoded message
 */
export declare function decodeMessage(encoded: Uint8Array): {
    latency: number;
    msg: string;
};
//# sourceMappingURL=utils.d.ts.map