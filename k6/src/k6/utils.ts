
const MaxPayloadBytes = 400;
const Alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export enum destinations {
    ECHO_SERVICE = "k6-echo.k6-operator-system.staging.hoprnet.link",
    WWW_EXAMPLE_COM = "www.example.com"
}

export function getDestination(): destinations {
    if ( __ENV.TARGET_DESTINATION === destinations.WWW_EXAMPLE_COM ) {
        return destinations.WWW_EXAMPLE_COM;
    } else {
        return destinations.ECHO_SERVICE;
    }
}

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

    static getFakeStartTime(): string {
        let time = new Date().getTime() - 30000;
        return time.toString();
    }

    public static buildMessagePayload(): ArrayBuffer {
        const messagePayload = `GET /?startTime=${Date.now()} HTTP/1.1\r\nHost: ${getDestination()}\r\n\r\n`;
        //console.log("Message sent payload:" + JSON.stringify(messagePayload)); 
        return Utils.stringToArrayBuffer(messagePayload)
    }

    public static unpackMessagePayload(messagePayload: ArrayBuffer): string {
        let httpResponse = Utils.arrayBufferToString(messagePayload);
        //console.log("Message received payload:" + JSON.stringify(httpResponse));
        let body = "";
        switch (getDestination()) {
            case destinations.ECHO_SERVICE:
                body = httpResponse.substring(httpResponse.indexOf("{\"message\""), httpResponse.length);
                //console.log("Message received body:" + JSON.stringify(body));
                try {
                    return JSON.parse(body).message.startTime;
                } catch (error) {
                    console.error("Error parsing message payload: " + httpResponse);
                    return Utils.getFakeStartTime();
                }
            case destinations.WWW_EXAMPLE_COM:
                if (! httpResponse.startsWith("HTTP/1.1 200 OK") || httpResponse.indexOf("</html>") < 0) {
                    console.error("Error parsing message payload:" + httpResponse);
                }
                return Utils.getFakeStartTime();
            default:
                console.log("Unknown destination");
                return Utils.getFakeStartTime();
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