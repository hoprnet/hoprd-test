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

    public static buildMessagePayload(destination: string): ArrayBuffer {
        const messagePayload = `GET /?startTime=${Date.now()} HTTP/1.1\r\nHost: ${destination}\r\n\r\n`;
        return Utils.stringToArrayBuffer(messagePayload)
    }

    public static unpackMessagePayload(messagePayload: ArrayBuffer): string {
        let httpResponse = Utils.arrayBufferToString(messagePayload);

        // This line only works with the echo service not with other targets
        const body = httpResponse.substring(httpResponse.indexOf("{\"message\""), httpResponse.length);
        //const body = httpResponse.substring(httpResponse.indexOf("<!doctype"), httpResponse.length);
        try {
            return JSON.parse(body).message;
            //return new Date().getTime().toString();
        } catch (error) {
            console.error("Error parsing message payload: " + httpResponse);
            return "0";
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