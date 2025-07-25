import { fail } from "k6";
import { K6Configuration } from "./k6-configuration";

export class Route {
    public sender: any;
    public relayer: any;
    public receiver: any;
}

export class SocketConfiguration extends K6Configuration {

    public protocol;
    public iterationsPerVU: number = 1;
    public payloadSize: number = 1 * 1024 * 1024; // 1 MB
    public iterationTimeout: number = 60; // 60 seconds
    public downloadThroughput: number = 1 * 1024 * 1024; // 1MB/s
    public uploadThroughput: number = 1 * 1024 * 1024; // 1MB/s
    public downloadSegmentSize: number;
    public uploadSegmentSize: number;
    private echoServersReplicas: number = 1;
    public runnerIP: string;

    public constructor(protocol: string) {
        super();
        this.protocol = protocol;
        this.loadSocketEnvironmentVariables();
        this.buildWorkloadOptions();
        if (__VU === 1) { // Only print once to avoid spamming the console
            const friendlyPayloadSize = (this.payloadSize / (1024 * 1024)).toFixed(2);
            const fiendlyDownloadThroughput = (this.downloadThroughput / (1024 * 1024)).toFixed(2);
            const fiendlyUploadThroughput = (this.uploadThroughput / (1024 * 1024)).toFixed(2);
            const fiendlyDownloadStreamSize = (this.downloadSegmentSize / 1024).toFixed(2);
            const fiendlyUploadStreamSize = (this.uploadSegmentSize / 1024).toFixed(2);
            const friendlyDownloadSegmentsPerSecond = (this.downloadThroughput / this.downloadSegmentSize).toFixed(0);
            const friendlyUploadSegmentsPerSecond = (this.uploadThroughput / this.uploadSegmentSize).toFixed(0);
            console.log(`[Setup] Echo service replicas(K6_ECHO_SERVERS_REPLICAS): ${this.echoServersReplicas}`);
            console.log(`[Setup] Iteration timeout(K6_ITERATION_TIMEOUT): ${this.iterationTimeout} seconds`);
            console.log(`[Setup] Document payload size(K6_PAYLOAD_SIZE): ${friendlyPayloadSize} MB`);
            console.log(`[Setup] ${protocol.toUpperCase()} server download throughput(K6_DOWNLOAD_THROUGHPUT): ${fiendlyDownloadThroughput} MB/s`);
            console.log(`[Setup] ${protocol.toUpperCase()} server upload throughput(K6_UPLOAD_THROUGHPUT): ${fiendlyUploadThroughput} MB/s`);
            console.log(`[Setup] ${protocol.toUpperCase()} client download segment size(K6_DOWNLOAD_SEGMENT_SIZE): ${fiendlyDownloadStreamSize} KB (${friendlyDownloadSegmentsPerSecond} segments/s)`);
            console.log(`[Setup] ${protocol.toUpperCase()} client upload segment size(K6_UPLOAD_SEGMENT_SIZE): ${fiendlyUploadStreamSize} KB (${friendlyUploadSegmentsPerSecond} segments/s)`);
        }
    }

    public getTargetDestination(action: string): string {
        let targetDestination = ''
        let port = ''
        // Generates a random integer between 0 and this.echoServersReplicas (inclusive)    
        let serverNumber = Math.floor(Math.random() * this.echoServersReplicas);
        if (this.protocol === 'tcp') { // Distribute workload between both services
            targetDestination=`echo-service-tcp-${serverNumber}.staging.hoprnet.link`;
        } else {
            targetDestination=`echo-service-udp-${serverNumber}.staging.hoprnet.link`;
        }
        if (action == "download") {
            port='3002';
        } else {
            port='3001';
        }
        return `${targetDestination}:${port}`;
    }

    private loadSocketEnvironmentVariables(): void {
        if (__ENV.K6_ECHO_SERVERS_REPLICAS) {
            const replicas = parseInt(__ENV.K6_ECHO_SERVERS_REPLICAS);
            if (!Number.isNaN(replicas) && replicas > 0) {
                this.echoServersReplicas = replicas;
            } else {
                fail('[ERROR] Invalid K6_ECHO_SERVERS_REPLICAS value.');
            }
        }

        if (__ENV.K6_ITERATION_TIMEOUT) {
            const iterationTimeout = parseInt(__ENV.K6_ITERATION_TIMEOUT);
            if (!Number.isNaN(iterationTimeout) && iterationTimeout > 0) {
                this.iterationTimeout = iterationTimeout;
            } else {
                fail('[ERROR] Invalid K6_ITERATION_TIMEOUT value.');
            }
        }

        if (__ENV.K6_PAYLOAD_SIZE) {
            const payloadSize = parseInt(__ENV.K6_PAYLOAD_SIZE);
            if (!Number.isNaN(payloadSize) && payloadSize > 0) {
                this.payloadSize = payloadSize;
            } else {
                fail('[ERROR] Invalid K6_PAYLOAD_SIZE value.');
            }
        }

        if (__ENV.K6_DOWNLOAD_THROUGHPUT) {
            const throughput = parseInt(__ENV.K6_DOWNLOAD_THROUGHPUT);
            if (!Number.isNaN(throughput) && throughput > 0) {
                this.downloadThroughput = throughput;
            } else {
                fail('[ERROR] Invalid K6_DOWNLOAD_THROUGHPUT value.');
            }
        }

        if (__ENV.K6_UPLOAD_THROUGHPUT) {
            const throughput = parseInt(__ENV.K6_UPLOAD_THROUGHPUT);
            if (!Number.isNaN(throughput) && throughput > 0) {
                this.uploadThroughput = throughput;
            } else {
                fail('[ERROR] Invalid K6_UPLOAD_THROUGHPUT value.');
            }
        }

        if (__ENV.K6_DOWNLOAD_SEGMENT_SIZE) {
            const readStreamSize = parseInt(__ENV.K6_DOWNLOAD_SEGMENT_SIZE);
            if (!Number.isNaN(readStreamSize) && readStreamSize > 0) {
                this.downloadSegmentSize = readStreamSize;
            } else {
                fail('[ERROR] Invalid K6_DOWNLOAD_SEGMENT_SIZE value.');
            }
        } else {
            this.downloadSegmentSize = this.protocol === 'tcp' ? 256 * 1024 : 1400; // Default value of 256KB for TCP and 1472 for UDP
        }

        if (__ENV.K6_UPLOAD_SEGMENT_SIZE) {
            const writeStreamSize = parseInt(__ENV.K6_UPLOAD_SEGMENT_SIZE);
            if (!Number.isNaN(writeStreamSize) && writeStreamSize > 0) {
                this.uploadSegmentSize = writeStreamSize;
            } else {
                fail('[ERROR] Invalid K6_UPLOAD_SEGMENT_SIZE value.');
            }
        } else {
            this.uploadSegmentSize = this.protocol === 'tcp' ? 64 * 1024 : 1400; // Default value of 64KB for TCP and 1472 for UDP
        }

        if (__ENV.K6_RUNNER_IP) {
            this.runnerIP = __ENV.K6_RUNNER_IP;
        } else {
            this.runnerIP = '0.0.0.0';
        }
    }

    private deepMerge(target: any, source: any) {
    for (const key of Object.keys(source)) {
        if (source[key] instanceof Object && key in target) {
        Object.assign(source[key], this.deepMerge(target[key], source[key]));
        }
    }

    Object.assign(target || {}, source);
    return target;
    }

    private buildWorkloadOptions(): void {

        let baseWorkload = {
            scenarios: {
                download: {
                    exec: "download",
                    tags: {
                        scenario: "download"
                    }
                },
                upload: {
                    exec: "upload",
                    tags: {
                        scenario: "upload"
                    }
                }
            },
            setupTimeout: "3600000",
            thresholds: {
                hopr_documents_succeed: ["count>0"],
                hopr_documents_failed: ["count<=0"],
                hopr_segment_latency: ["avg<1", "p(90)<2", "p(95)<3"],
                hopr_document_latency: ["avg<6000", "p(90)<7000", "p(95)<8000"]
            },
            summaryTrendStats: ['avg', 'min', 'max', 'p(90)', 'p(95)']
        };
        switch (this.workload) {
            case "constant": 
            case "sanity-check": {
                this.workloadOptions  = this.deepMerge(baseWorkload, {
                    scenarios: {
                        download: {
                            executor: "constant-vus",
                            vus: this.dataPool.length * this.vuPerRoute,
                            duration: `${this.duration}m`,
                        },
                        upload: {
                            executor: "constant-vus",
                            vus: this.dataPool.length * this.vuPerRoute,
                            duration: `${this.duration}m`,
                        }
                    }
                });
                break;
            }
            case "hysteresis": {
                const hysteresisDuration = Math.trunc(this.duration / 2);
                this.workloadOptions  = this.deepMerge(baseWorkload, {
                    scenarios: {
                        download: {
                            executor: "ramping-vus",
                            stages: [
                                { duration: `${hysteresisDuration}m`, target: this.dataPool.length * this.vuPerRoute },
                                { duration: `${hysteresisDuration}m`, target: 0 }
                            ]
                        },
                        upload: {
                            executor: "ramping-vus",
                            stages: [
                                { duration: `${hysteresisDuration}m`, target: this.dataPool.length * this.vuPerRoute },
                                { duration: `${hysteresisDuration}m`, target: 0 }
                            ]
                        }
                    }
                });
                break;
            }
            case "incrememental": {
                this.workloadOptions  = this.deepMerge(baseWorkload, {
                    scenarios: {
                        download: {
                            executor: "ramping-vus",
                            stages: [
                                { duration: `${this.duration}m`, target: this.dataPool.length * this.vuPerRoute },
                                { duration: `1m`, target: 0 }
                            ]
                        },
                        upload: {
                            executor: "ramping-vus",
                            stages: [
                                { duration: `${this.duration}m`, target: this.dataPool.length * this.vuPerRoute },
                                { duration: `1m`, target: 0 }
                            ]
                        }
                    }
                });
                break;
            }
            default: {
                fail(`[Error] Invalid workload type: ${this.workload}`);
            }
        }
    }
}

