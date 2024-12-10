import { fail } from "k6";
import { K6Configuration } from "./k6-configuration";

export class Route {
    public sender: any;
    public relayer: any;
    public receiver: any;
}

export class TCPConfiguration extends K6Configuration {

    public payloadSize: number = 1024 * 1024 * 1024; // 1GB
    public throughput: number = 1024 * 1024; // 1MB/s
    public readStreamSize: number = 64 * 1024; // 64KB


    public constructor() {
        super();
        this.loadTCPEnvironmentVariables();
        if (__VU === 1) { // Only print once to avoid spamming the console
            const friendlyPayloadSize = (this.payloadSize / (1024 * 1024 * 1024)).toFixed(2);
            const fiendlyThroughput = (this.throughput / (1024 * 1024)).toFixed(2);
            const fiendlyReadStreamSize = (this.readStreamSize / 1024).toFixed(2);
            console.log(`[Setup] Document payload size: ${friendlyPayloadSize} GB`);
            console.log(`[Setup] TCP Server throughput ${fiendlyThroughput} MB/s`);
            console.log(`[Setup] TCP client read stream size: ${fiendlyReadStreamSize} KB`);
        }
    }

    private loadTCPEnvironmentVariables(): void {
        if (__ENV.K6_PAYLOAD_SIZE) {
            const payloadSize = parseInt(__ENV.K6_PAYLOAD_SIZE);
            if (!Number.isNaN(payloadSize) && payloadSize > 0) {
                this.payloadSize = payloadSize;
            } else {
                fail('[ERROR] Invalid K6_PAYLOAD_SIZE value.');
            }
        }

        if (__ENV.K6_THROUGHPUT) {
            const throughput = parseInt(__ENV.K6_THROUGHPUT);
            if (!Number.isNaN(throughput) && throughput > 0) {
                this.throughput = throughput;
            } else {
                fail('[ERROR] Invalid K6_THROUGHPUT value.');
            }
        }

        if (__ENV.K6_READ_STREAM_SIZE) {
            const readStreamSize = parseInt(__ENV.K6_READ_STREAM_SIZE);
            if (!Number.isNaN(readStreamSize) && readStreamSize > 0) {
                this.readStreamSize = readStreamSize;
            } else {
                fail('[ERROR] Invalid K6_READ_STREAM_SIZE value.');
            }
        }
    }
}

