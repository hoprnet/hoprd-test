const MaxPayloadBytes = 400;
const Alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// Function to convert string to Uint8Array
function stringToArrayBuffer(str) {
    const buffer = new ArrayBuffer(str.length);
    const bufferView = new Uint8Array(buffer);
    for (let i = 0; i < str.length; i++) {
        bufferView[i] = str.charCodeAt(i);
    }
    return buffer;
}

function arrayBufferToString(buffer) {
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

function getFakeStartTime(): string {
    let time = new Date().getTime() - 30000;
    return time.toString();
}

export function buildMessagePayload(targetDestination: string, counter: number): ArrayBuffer {
    const messagePayload = `GET /?startTime=${Date.now()}&count=${counter} HTTP/1.1\r\nHost: ${targetDestination}\r\n\r\n`;
    //console.log("Message sent payload:" + JSON.stringify(messagePayload)); 
    return stringToArrayBuffer(messagePayload)
}

export function unpackMessagePayload(messagePayload: ArrayBuffer, hostDestination: string): string {
    let httpResponse = arrayBufferToString(messagePayload);
    //console.log("Message received payload:" + JSON.stringify(httpResponse));
    switch (hostDestination) {
        case "k6-echo.k6-operator-system.staging.hoprnet.link": {
            const body = httpResponse.substring(httpResponse.indexOf("{\"message\""), httpResponse.length);
            //console.log("Message received body:" + JSON.stringify(body));
            try {
                return JSON.parse(body).message.startTime;
            } catch (error) {
                console.error("Error parsing message payload: " + httpResponse);
                throw error;
            }
        }
        default: {
            if (!httpResponse.startsWith("HTTP/1.1 200 OK") || httpResponse.indexOf("</html>") < 0) {
                console.error("Error parsing message payload:" + httpResponse);
                throw new Error("Invalid response");
            }
            return getFakeStartTime();
        }
    }
}

// use random ASCI chars to extend the payload
// UTF-8 uses variying byte sizes - try to keep them in the single byte range
// so we have a predicatble payload size
export function extendWithRandomBytes(bodyString: string): string {
    const body = JSON.parse(bodyString);
    const count = MaxPayloadBytes - bodyString.length - 1;
    let randomContent = "";
    for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * Alphabet.length);
        randomContent += Alphabet.charAt(idx);
    }
    return JSON.stringify({ ...body, randomContent });
}
