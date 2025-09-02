import { fail } from "k6";
import { mergeNodesJsonFiles } from "./utils";

export class Route {
    public entryNode: any;
    public relayerNode: any;
    public exitNode: any;
}

export class K6Configuration {

    public executionName: string;
    public clusterNodes: string;
    public topology: string;
    public workload: string;
    public dataPool: Route[];
    public workloadOptions: any;
    public duration: number = 1;
    public vuPerRoute: number = 1;

    public constructor() {
        this.loadK6EnvironmentVariables();
        this.loadJSONFiles();
        if (__VU === 1) { // Only print once to avoid spamming the console
            //dataPool.forEach((route: any) => console.log(`[Setup] DataPool entryNode ${route.entryNode.name} -> ${route.relayerNode.name} -> ${route.exitNode.name}`));
            console.log(`[Setup] Execution name(K6_EXECUTION_NAME): ${this.executionName}`);
            console.log(`[Setup] Cluster nodes(K6_CLUSTER_NODES): ${this.clusterNodes}`);
            console.log(`[Setup] Workload(K6_WORKLOAD_NAME): ${this.workload}`);
            console.log(`[Setup] Topology(K6_TOPOLOGY_NAME): ${this.topology}`);
            console.log(`[Setup] Test duration(K6_TEST_DURATION): ${this.duration}m`);
            let uniqueEntryNodes = Array.from((new Set(this.dataPool.map((route) => route.entryNode.name))));
            let uniqueRelayerNodes = Array.from((new Set(this.dataPool.map((route) => route.relayerNode.name))));
            let uniqueExitNodes = Array.from((new Set(this.dataPool.map((route) => route.exitNode.name))));
            console.log(`[Setup] Entry Nodes: ${uniqueEntryNodes.length}`);
            console.log(`[Setup] Relayer Nodes: ${uniqueRelayerNodes.length}`);
            console.log(`[Setup] Exit Nodes: ${uniqueExitNodes.length}`);
            console.log(`[Setup] Routes: ${this.dataPool.length}`);
            console.log(`[Setup] VU per route(K6_VU_PER_ROUTE): ${this.vuPerRoute}`);
        }
    }

    private loadK6EnvironmentVariables(): void {
        this.executionName = __ENV.K6_EXECUTION_NAME || "local";
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
    }

    private loadJSONFiles(): void {
        const clusterNodesData = JSON.parse(open(`./cluster-nodes-${this.clusterNodes}.json`)).nodes;
        const topologyNodesData = JSON.parse(open(`./topology-${this.topology}.json`)).nodes;

        let mergedNodesData = mergeNodesJsonFiles(clusterNodesData, topologyNodesData);
        const entryNodesData: any[] = [];
        const relayerNodesData: any[] = [];
        const exitNodesData: any[] = [];
        mergedNodesData
            .forEach((node: any) => {
                if (node.isEntryNode) {
                    entryNodesData.push(node);
                }
                if (node.isRelayerNode) {
                    relayerNodesData.push(node);
                }
                if (node.isExitNode) {
                    exitNodesData.push(node);
                }
            });
        // if (__VU === 1) { // Only print once to avoid spamming the console
        //     console.log(`[DEBUG] Entry nodes Data: ${JSON.stringify(entryNodesData)}`);
        //     console.log(`[DEBUG] Relayer nodes Data: ${JSON.stringify(relayerNodesData)}`);
        //     console.log(`[DEBUG] Exit nodes Data: ${JSON.stringify(exitNodesData)}`);
        // }
        this.dataPool = entryNodesData
            .flatMap(entryNode => {
                return exitNodesData.flatMap(exitNode => {
                    return relayerNodesData.map(relayerNode => { return { entryNode, relayerNode, exitNode }; });
                })
            })
            // Only include those routes where the entryNode, relayer and exitNode have an open channel
            .filter((route) => 
                route.entryNode.routes.map(entryRoute => entryRoute.name).includes(route.relayerNode.name) && 
                route.exitNode.routes.map(exitRoute => exitRoute.name).includes(route.relayerNode.name)
            )
            // Only include those routes where the entryNode, relayer and exitNode are not the same
            .filter((route) => 
                route.entryNode.name !== route.exitNode.name &&
                route.entryNode.name !== route.relayerNode.name &&
                route.relayerNode.name !== route.exitNode.name
            );
        // if (__VU === 1) { // Only print once to avoid spamming the console
        //     console.log(`[DEBUG] Data Pool: ${JSON.stringify(this.dataPool)}`);
        // }
    }



}

