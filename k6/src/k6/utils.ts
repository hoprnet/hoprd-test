const MaxPayloadBytes = 400;
const Alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// Function to convert string to Uint8Array
export function stringToArrayBuffer(str: string): ArrayBuffer {
    const buffer = new ArrayBuffer(str.length);
    const bufferView = new Uint8Array(buffer);
    for (let i = 0; i < str.length; i++) {
        bufferView[i] = str.charCodeAt(i);
    }
    return buffer;
}

export function stringToUint8Array(str: string): Uint8Array {
    const arr = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        arr[i] = str.charCodeAt(i);
    }
    return arr;
}




export function arrayBufferToString(buffer: ArrayBuffer): string {
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

export function buildHTTPMessagePayload(targetDestination: string, counter: number): ArrayBuffer {
    const messagePayload = `GET /?startTime=${Date.now()}&count=${counter} HTTP/1.1\r\nHost: ${targetDestination}\r\n\r\n`;
    //console.log("Message sent payload:" + JSON.stringify(messagePayload)); 
    return stringToArrayBuffer(messagePayload)
}

export function unpackMessagePayload(messages: string, hostDestination: string): {startTimes: string[], partialMessage: string} {
    //console.log("Message received payload:" + JSON.stringify(httpResponse));
    switch (hostDestination) {
        case "echo-service-http.staging.hoprnet.link": {
            const messageParts = messages.split("HTTP/1.1 200")
                .filter((message: string) => message.length > 0)
                .map((message: string) => {
                    if (message.indexOf("{\"message\"") > 0 && message.indexOf("\"}}") > 0) { // Is a complete message
                        try {
                            const responseBody = message.substring(message.indexOf("{\"message\""), message.length);
                            return JSON.parse(responseBody).message.startTime;
                        } catch (error) {
                            console.error("Error parsing JSON message payload:" + message);
                            throw new Error("Invalid JSON format");
                        }
                    } else { // Is a partial message
                        return "HTTP/1.1 200" + message;
                    }
                });
            // Check if last element is a number or a partial message
            const lastMessage = messageParts[messageParts.length-1];
            if (isNaN(lastMessage)) { // Is partial message
                let response = { startTimes: messageParts.slice(0, messageParts.length-1), partialMessage: lastMessage }
                //console.log("Partial message response: " + JSON.stringify(response));
                return response;
            } else { // Is a number
                return { startTimes: messageParts, partialMessage: '' };
            }
        }
        default: {
            if (messages.indexOf("</html>") < 0) {
                console.error("Error parsing message payload:" + messages);
                throw new Error("Invalid response");
            }
            return { startTimes: [getFakeStartTime()], partialMessage: '' };
        }
    }
}

export function mergeNodesJsonFiles(clusterNodesData: any, topologyNodesData: any): any[] {
    const getClusterNodeByName = (nodeName: string) => clusterNodesData.filter((node: any) => node.name === nodeName)[0];
    return topologyNodesData
        .filter((node: any) => node.enabled)
        .filter((node:any) => getClusterNodeByName(node.name)) // Ensure the node exists in clusterNodesData
        .map((topologyNode: any) => {
            topologyNode.apiToken = __ENV.HOPRD_API_TOKEN
            let node = getClusterNodeByName(topologyNode.name);
            topologyNode.url = node.url;
            topologyNode.instance = node.instance;
            topologyNode.p2p = node.p2p;
            return topologyNode;
        });
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
