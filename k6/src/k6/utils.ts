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
            str += String.fromCharCode(bufferView[i]);
        }
        return str;
    }

    public static buildMessagePayload(senderName: string, receiverName: string): ArrayBuffer {
        let now = Date.now();
        const messagePayload = 'GET /?sender=' + senderName + '&receiver=' + receiverName + '&startTime=' + now + ' HTTP/1.1\r\nHost: k6-echo.k6-operator-system.staging.hoprnet.link\r\n\r\n';
        return Utils.stringToArrayBuffer(messagePayload)
    }

    public static unpackMessagePayload(messagePayload: ArrayBuffer): {sender: string, receiver: string, startTime: number} {
        const message = Utils.arrayBufferToString(messagePayload);
        const senderMatch = message.match(/sender=(.*)&receiver/);
        const sender = senderMatch ? senderMatch[1] : '';
        const receiverMatch = message.match(/receiver=(.*)&startTime/);
        const receiver = receiverMatch ? receiverMatch[1] : '';
        const startTimeMatch = message.match(/startTime=(.*) HTTP/);
        const startTime = startTimeMatch ? parseInt(startTimeMatch[1]) : 0;
        return { sender, receiver, startTime };
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

    public static sendMessage(apiUrl, httpParams, requestPayload, tags, messageRequestsSucceed: Counter, messageRequestsFailed: Counter) {
        let startTime = new Date().getTime();

        const messageRequestResponse = http.post(
            `${apiUrl}/messages`,
            requestPayload,
            httpParams,
        ); // Send the 1 hop message
        if (messageRequestResponse.status === 202) {
            messageRequestsSucceed.add(1, tags);
        } else {
            console.error(
            `Failed to send message request. Details: ${JSON.stringify(messageRequestResponse)}`,
            );
            messageRequestsFailed.add(1, tags);
            return false;
        }
        return true;
    }

}