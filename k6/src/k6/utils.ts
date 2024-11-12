import http from "k6/http";
import { Counter, Trend } from "k6/metrics";


const MaxPayloadBytes = 400;
const Alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export class Utils {

    // Function to convert string to Uint8Array
    private static stringToArrayBuffer(str) {
        const buffer = new ArrayBuffer(str.length);
        const bufferView = new Uint8Array(buffer);
        for (let i = 0; i < str.length; i++) {
            bufferView[i] = str.charCodeAt(i);
        }
        return buffer;
    }

    private static arrayBufferToString(buffer) {
        const bufferView = new Uint8Array(buffer);
        let str = '';
        for (let i = 0; i < bufferView.length; i++) {
            const charCode = bufferView[i];
            // Only append printable ASCII characters
            if (charCode >= 32 && charCode <= 126) {
                str += String.fromCharCode(charCode);
            }
        }
        return str;
    }

    public static buildMessagePayload(senderName: string, receiverName: string, relayerName: string): ArrayBuffer {
        let now = Date.now();
        const messagePayload = 'GET /?sender=' + senderName + '&receiver=' + receiverName + '&relayer=' + relayerName + '&startTime=' + now + ' HTTP/1.1\r\nHost: k6-echo.k6-operator-system.staging.hoprnet.link\r\n\r\n';
        return Utils.stringToArrayBuffer(messagePayload)
    }

    public static unpackMessagePayload(messagePayload: ArrayBuffer): {senderName: string, receiverName: string, relayerName: string, startTime: string} {
        let httpResponse = Utils.arrayBufferToString(messagePayload);
        const body = httpResponse.substring(httpResponse.indexOf("{\"message\""), httpResponse.length);
        try {
            return JSON.parse(body).message;
        } catch (error) {
            return {senderName: "unknown", receiverName: "unknown", relayerName: "unknown", startTime: new Date().getTime().toString()};
        }
    }

    // use random ASCI chars to extend the payload
    // UTF-8 uses variying byte sizes - try to keep them in the single byte range
    // so we have a predicatble payload size
    public static extendWithRandomBytes(bodyString: string): string {
    const body = JSON.parse(bodyString);
    const count = MaxPayloadBytes - bodyString.length - 1;
    let randomContent = "";
    for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * Alphabet.length);
        randomContent += Alphabet.charAt(idx);
    }
    return JSON.stringify({ ...body, randomContent });
    }

}