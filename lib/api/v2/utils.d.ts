/**
 * At the moment, using our own custom codes
 * and validations in the possibilty we want to
 * reuse the code for commands, will change if said
 * otherwise.
 */
export declare enum STATUS_CODES {
    INVALID_INPUT = "INVALID_INPUT",
    INVALID_PEERID = "INVALID_PEERID",
    INVALID_CURRENCY = "INVALID_CURRENCY",
    INVALID_AMOUNT = "INVALID_AMOUNT",
    INVALID_ADDRESS = "INVALID_ADDRESS",
    INVALID_SETTING = "INVALID_SETTING",
    INVALID_SETTING_VALUE = "INVALID_SETTING_VALUE",
    INVALID_QUALITY = "INVALID_QUALITY",
    INVALID_TOKEN_LIFETIME = "INVALID_TOKEN_LIFETIME",
    INVALID_TOKEN_CAPABILITIES = "INVALID_TOKEN_CAPABILITIES",
    INVALID_TOKEN_DESCRIPTION = "INVALID_TOKEN_DESCRIPTION",
    PEERID_NOT_FOUND = "PEERID_NOT_FOUND",
    CHANNEL_NOT_FOUND = "CHANNEL_NOT_FOUND",
    TICKETS_NOT_FOUND = "TICKETS_NOT_FOUND",
    NOT_ENOUGH_BALANCE = "NOT_ENOUGH_BALANCE",
    CHANNEL_ALREADY_OPEN = "CHANNEL_ALREADY_OPEN",
    TIMEOUT = "TIMEOUT",
    UNKNOWN_FAILURE = "UNKNOWN_FAILURE",
    FORBIDDEN = "FORBIDDEN",
    UNAUTHORIZED = "UNAUTHORIZED",
    UNSUPPORTED_FEATURE = "UNSUPPORTED_FEATURE"
}
/**
 * Default responses when for documenting websocket endpoints.
 */
export declare const WS_DEFAULT_RESPONSES: Record<string, {
    description: string;
}>;
/**
 * Generate a websocket endpoint description suffixed with general security data.
 * @param summary Short summary to prefix the endpoint's description.
 * @param path Path of the endpoint after `/api/v2`.
 * @returns endpoint's description
 */
export declare const generateWsApiDescription: (summary: string, path: string) => string;
//# sourceMappingURL=utils.d.ts.map