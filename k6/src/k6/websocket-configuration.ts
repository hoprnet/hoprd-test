import { fail } from "k6";
import { K6Configuration } from "./k6-configuration";

export class Route {
    public sender: any;
    public relayer: any;
    public receiver: any;
}

export class WebSocketConfiguration extends K6Configuration{

    public messageDelay: number = 1000;

    public constructor() {
        super();
        this.loadWebsocketEnvironmentVariables();
        if (__VU === 1) { // Only print once to avoid spamming the console
            console.log(`[Setup] Request per second per VU: ${__ENV.K6_REQUESTS_PER_SECOND_PER_VU || 1}`);
            console.log(`[Setup] Message delay set to ${Math.trunc(this.messageDelay)} ms`);
        }
    }

    private loadWebsocketEnvironmentVariables(): void {
        if (__ENV.K6_REQUESTS_PER_SECOND_PER_VU) {
            const rps = parseInt(__ENV.K6_REQUESTS_PER_SECOND_PER_VU);
            if (!Number.isNaN(rps) && rps > 0) {
                this.messageDelay = 1000 / rps;
            } else {
                fail('[Error] Invalid K6_REQUESTS_PER_SECOND_PER_VU, using default messageDelay.');
            }
        }
    }

}

