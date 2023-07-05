/**
 * At the moment, using our own custom codes
 * and validations in the possibilty we want to
 * reuse the code for commands, will change if said
 * otherwise.
 */
export var STATUS_CODES;
(function (STATUS_CODES) {
    // invalid inputs
    STATUS_CODES["INVALID_INPUT"] = "INVALID_INPUT";
    STATUS_CODES["INVALID_PEERID"] = "INVALID_PEERID";
    STATUS_CODES["INVALID_CURRENCY"] = "INVALID_CURRENCY";
    STATUS_CODES["INVALID_AMOUNT"] = "INVALID_AMOUNT";
    STATUS_CODES["INVALID_ADDRESS"] = "INVALID_ADDRESS";
    STATUS_CODES["INVALID_SETTING"] = "INVALID_SETTING";
    STATUS_CODES["INVALID_SETTING_VALUE"] = "INVALID_SETTING_VALUE";
    STATUS_CODES["INVALID_QUALITY"] = "INVALID_QUALITY";
    STATUS_CODES["INVALID_TOKEN_LIFETIME"] = "INVALID_TOKEN_LIFETIME";
    STATUS_CODES["INVALID_TOKEN_CAPABILITIES"] = "INVALID_TOKEN_CAPABILITIES";
    STATUS_CODES["INVALID_TOKEN_DESCRIPTION"] = "INVALID_TOKEN_DESCRIPTION";
    // protocol
    STATUS_CODES["PEERID_NOT_FOUND"] = "PEERID_NOT_FOUND";
    STATUS_CODES["CHANNEL_NOT_FOUND"] = "CHANNEL_NOT_FOUND";
    STATUS_CODES["TICKETS_NOT_FOUND"] = "TICKETS_NOT_FOUND";
    STATUS_CODES["NOT_ENOUGH_BALANCE"] = "NOT_ENOUGH_BALANCE";
    STATUS_CODES["CHANNEL_ALREADY_OPEN"] = "CHANNEL_ALREADY_OPEN";
    STATUS_CODES["TIMEOUT"] = "TIMEOUT";
    // other
    STATUS_CODES["UNKNOWN_FAILURE"] = "UNKNOWN_FAILURE";
    STATUS_CODES["FORBIDDEN"] = "FORBIDDEN";
    STATUS_CODES["UNAUTHORIZED"] = "UNAUTHORIZED";
    // initiate/close incoming channel is not supported in monte_rosa
    STATUS_CODES["UNSUPPORTED_FEATURE"] = "UNSUPPORTED_FEATURE";
})(STATUS_CODES = STATUS_CODES || (STATUS_CODES = {}));
/**
 * Default responses when for documenting websocket endpoints.
 */
export const WS_DEFAULT_RESPONSES = {
    '101': {
        description: 'Switching protocols'
    },
    '401': {
        description: 'Unauthorized'
    },
    '404': {
        description: 'Not found'
    }
};
/**
 * Generate a websocket endpoint description suffixed with general security data.
 * @param summary Short summary to prefix the endpoint's description.
 * @param path Path of the endpoint after `/api/v2`.
 * @returns endpoint's description
 */
export const generateWsApiDescription = (summary, path) => {
    return `${summary} Authentication (if enabled) is done via either passing an \`apiToken\` parameter in the url or cookie \`X-Auth-Token\`. Connect to the endpoint by using a WS client. No preview available. Example: \`ws://127.0.0.1:3001/api/v2${path}/?apiToken=myApiToken\``;
};
//# sourceMappingURL=utils.js.map