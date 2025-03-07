import { fail } from "k6";
import { mergeNodesJsonFiles } from "./utils";

export class Route {
    public sender: any;
    public relayer: any;
    public receiver: any;
}

export class K6Configuration {

    public clusterNodes: string;
    public topology: string;
    public workload: string;
    public dataPool: Route[];
    public workloadOptions: any;
    public duration: number = 1;
    public hops: number = 1;
    public vuPerRoute: number = 1;

    public constructor() {
        this.loadK6EnvironmentVariables();
        this.loadJSONFiles();
        if (__VU === 1) { // Only print once to avoid spamming the console
            //dataPool.forEach((route: any) => console.log(`[Setup] DataPool sender ${route.sender.name} -> ${route.relayer.name} -> ${route.receiver.name}`));
            console.log(`[Setup] Cluster nodes: ${this.clusterNodes}`);
            console.log(`[Setup] Workload: ${this.workload}`);
            console.log(`[Setup] Topology: ${this.topology}`);
            console.log(`[Setup] Test duration set to ${this.duration}m`);
            console.log(`[Setup] Hops: ${__ENV.HOPS || 1}`);
            let uniqueSenders = Array.from((new Set(this.dataPool.map((route) => route.sender.name))));
            let uniqueRelayers = Array.from((new Set(this.dataPool.map((route) => route.relayer.name))));
            let uniqueReceivers = Array.from((new Set(this.dataPool.map((route) => route.receiver.name))));
            console.log(`[Setup] Senders: ${uniqueSenders.length}`);
            console.log(`[Setup] Relayers: ${uniqueRelayers.length}`);
            console.log(`[Setup] Receivers: ${uniqueReceivers.length}`);
            console.log(`[Setup] Routes: ${this.dataPool.length}`);
            console.log(`[Setup] VU per route: ${__ENV.K6_VU_PER_ROUTE || 1}`);
            // console.log("Test execution options: ");
            // console.log(JSON.stringify(workloadOptions))
        }
    }

    private loadK6EnvironmentVariables(): void {
        this.clusterNodes = __ENV.K6_CLUSTER_NODES || "core-rotsee";
        this.topology = __ENV.K6_TOPOLOGY_NAME || "many2many";
        this.workload = __ENV.K6_WORKLOAD_NAME || "sanity-check";
        __ENV.K6_WEBSOCKET_DISCONNECTED = "false";

        if (! __ENV.HOPRD_API_TOKEN) {
                console.warn('[Error] The environment variable "HOPRD_API_TOKEN" must be set.');
        }

        if (__ENV.K6_TEST_DURATION) {
            const duration = parseInt(__ENV.K6_TEST_DURATION);
            if (!Number.isNaN(duration) && duration > 0) {
                this.duration = duration;
            } else {
                fail('[ERROR] Invalid DURATION, using default duration.');
            }
        }
        if (__ENV.K6_VU_PER_ROUTE) {
            const vuPerRoute = parseInt(__ENV.K6_VU_PER_ROUTE);
            if (!Number.isNaN(vuPerRoute) && vuPerRoute > 0) {
                this.vuPerRoute = vuPerRoute;
            } else {
                fail('[ERROR] Invalid K6_VU_PER_ROUTE, using default vuPerRoute.');
            }
        }
        if (__ENV.HOPS) {
            const hops = parseInt(__ENV.HOPS);
            if (!Number.isNaN(hops) && hops > 0) {
                this.hops = hops;
            } else {
                fail('[ERROR] Invalid HOPS, using default hops.');
            }
        }
    }

    private loadJSONFiles(): void {
        const clusterNodesData = JSON.parse(open(`./cluster-nodes-${this.clusterNodes}.json`)).nodes;
        const topologyNodesData = JSON.parse(open(`./topology-${this.topology}.json`)).nodes;

        let mergedNodesData = mergeNodesJsonFiles(clusterNodesData, topologyNodesData);
        const sendersData: any[] = [];
        const relayersData: any[] = [];
        const receiversData: any[] = [];
        mergedNodesData
            .forEach((node: any) => {
                if (node.isSender) {
                    sendersData.push(node);
                }
                if (node.isRelayer) {
                    relayersData.push(node);
                }
                if (node.isReceiver) {
                    receiversData.push(node);
                }
            });
        this.dataPool = sendersData
            .flatMap(sender => {
                return receiversData.flatMap(receiver => {
                    return relayersData.map(relayer => { return { sender, relayer, receiver }; });
                })
            })
            .filter((route) =>
                route.sender.name !== route.receiver.name &&
                route.sender.name !== route.relayer.name &&
                route.relayer.name !== route.receiver.name
            );
    }



}

