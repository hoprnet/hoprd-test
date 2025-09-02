import { fail } from "k6";
import { K6Configuration } from "./k6-configuration";

export class WebSocketConfiguration extends K6Configuration{

    public messageDelay: number = 1000;
    public targetDestination: string = "echo-service-http.staging.hoprnet.link:80";

    public constructor() {
        super();
        this.loadWebsocketEnvironmentVariables();
        this.buildWorkloadOptions();
        if (__VU === 1) { // Only print once to avoid spamming the console
            console.log(`[Setup] Target destination: ${this.targetDestination}`);
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

        if (__ENV.K6_TARGET_DESTINATION) {
            this.targetDestination = __ENV.K6_TARGET_DESTINATION
        }
    }

    private buildWorkloadOptions(): void {
        this.workloadOptions = JSON.parse(open(`./workload-${this.workload}.json`));
        Object.keys(this.workloadOptions.scenarios).forEach((scenario) => {
            if (this.workloadOptions.scenarios[scenario].executor === "per-vu-iterations") {
                this.workloadOptions.scenarios[scenario].vus = this.dataPool.length * this.vuPerRoute;
                this.workloadOptions.scenarios[scenario].maxDuration = `${this.duration}m`;
            }
            if (this.workloadOptions.scenarios[scenario].executor === "ramping-vus") {
                this.workloadOptions.scenarios[scenario].stages[0].target = this.dataPool.length * this.vuPerRoute;
                if (scenario === "hysteresis") {
                    const hysteresisDuration = Math.trunc(this.duration / 2);
                    this.workloadOptions.scenarios[scenario].stages[0].duration = `${hysteresisDuration}m`;
                    this.workloadOptions.scenarios[scenario].stages[1].duration = `${hysteresisDuration}m`;
                } else {
                    this.workloadOptions.scenarios[scenario].stages[0].duration = `${this.duration}m`;
                }
            }
        });
    }

}

