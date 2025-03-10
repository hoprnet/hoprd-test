# Load Testing

This package is responsible of creating a set of load testing scenarios to be used to check performance and capacity of Hoprd network

## Use cases

- Generate high peaks of load to test network stability at those circumstances
- Generate high peaks of load to test hoprd node stability at those circumstances
- Generate constant traffic on nodes to test the network and their nodes against long running periods

# Setup development environment

## Installing xk6

The binary [xk6](https://github.com/grafana/xk6) is used to install a binary named `k6` with certain extensions. Follow the installations guidlelines on how to install locally a `k6` binary bundled with the [xk6-output-prometheus-remote](https://github.com/grafana/xk6-output-prometheus-remote). 

Or alternatively execute:
- `npm run install:xk6:linux`: Install k6 locally for Linux
- `npm run install:xk6:mac`: Install k6 locally for Mac

## Building


Here are the most useful commands:

- `npm install`: Install Node dependencies
- `npm run build`: Build source code for running tests

## Execution Parameters

You can modify the type of load test execution by setting these parameters as environment variables before run

### Test duration

The duration of the test is by default `1` (in minutes) unless modified by the environment variable `K6_TEST_DURATION`

### Cluster Nodes 

The cluster of nodes, specified through the environment variable named `K6_CLUSTER_NODES`,  determines which cluster of nodes will be used. By default will be used `core` nodes:
- `local`: Uses the nodes of the local-cluster 
- `core-rotsee`: Uses the set of nodes from core-team at rotsee
- `core-dufour`: Uses the set of nodes from core-team at dufour
- `uhttp`: Uses the active nodes of uhttp
- `team`: Users the nodes that belong to the development team

### API Token

Before running any execution, the environment variable `HOPRD_API_TOKEN` needs to be set with the API token that will be used for the cluster of nodes chosen.

### Workload

The workload environment variable `K6_WORKLOAD_NAME` specifies the kind of workload that has been injected in the executio. Default value is: `sanity-check`. The following workloads are implemented:

- `sanity-check`: This is the default workload for debuging purposes, and it's meant to send few messages during 1 minute using a constant workload
- `constant`: This workload injects the same amount of messages from the begining and keeps doing it until the end of the execution. There is a few warm-up and tear-down phase, but most of the time will be injecting the same workload.
- `incremental`: This wokload starts injecting workload, and as the time goes by, the workload is incremented proporcionally. By the end of the execution, the workload will be injecting the top amount of messages specified in it.
- `hysteresis`: This workload splits the duration of the execution in two. The first half of the execution has an incremental workload pattern, while the second half of the execution has a decremental workload pattern.

### Channels Topology

The topology, specified through the environment variable named `K6_TOPOLOGY_NAME`,  determines how the nodes will interact between each other, and so determines the available paths/routes on them as well. By selecting one topology or other, the nodes are opening and closing channels between them to adapt to the desired topology. The execution is performed with the Autopromiscuous mode disabled, and only participate the nodes involved in the execution (that means that all outgoing channels opened with external nodes are closed before execution). Default value is `many2many`.

- `many2many`: This is a full topology between all the nodes involved in the execution. This means that all nodes are acting as senders, relayers, and receivers. All posible channels between the nodes are opened
- `sender`: This topology sepecifies a single sender node, and multiple relayers and receivers. The sender does not act as a relayer or receiver. The goal of this topology is to test the entry nodes
- `relayer`: This topology sepecifies a single relayer node, and multiple senders and receivers. The relayer does not act as a sender or receiver. The goal of this topology is to test the internal mix nodes
- `receiver`: This topology sepecifies a single receiver node, and multiple senders and relayers. The receiver does not act as a sender or relayer . The goal of this topology is to test the exit nodes

### Echo service

Configure the echo service accordingly to the requirements of your test. You might need to scale up the echo service to be able to accept more requests.
Edit the [helmfile](https://github.com/hoprnet/gitops/blob/master/argocd/apps/k6-operator/helmfile.yaml#L33) and change the number of replicas

Then export the `K6_ECHO_SERVERS_REPLICAS=1` with the same amount of replicas

If you want to execute the load test and avoid using the HOPRD nodes mixnets and opening sessions, you can set `K6_SKIP_HOPRD_SESSIONS=true`. This is only useful when debugging the own echo service or load test without the overload of hoprd network.

### VU per route

The type of topology chosen will determine the amount of routes available for the test execution. A Route is an available communication path between sender, relayer and receiver. 
By setting the virtual users per route through the environment variable named `K6_VU_PER_ROUTE`, the load test will open as many web-socket connections as VU with those route(sender-relayer-receiver) parameters. Default value `K6_VU_PER_ROUTE=1`.

For instnace, the topology `many2many` in the cluster of nodes `local` where there are 5 nodes, would have a total of 60 routes = 5 senders * 4 relayers * 3 receivers.
Setting this parameter `K6_VU_PER_ROUTE=2` would open a total of 120 web-socket connections, 24 web-socket connections per node.

### Requests per VU per route

The default throughtput is to send 1 message per second per route(web-socket connections). But the websocket can be stressed also by adding more messages/s by setting the environment variable named `K6_REQUESTS_PER_SECOND_PER_VU` with a higher number

## Running locally

Setup workspace
```
export HOPRD_API_TOKEN=?????
export K6_CLUSTER_NODES=local
export K6_TOPOLOGY_NAME=receiver
export K6_WORKLOAD_NAME=sanity-check
export K6_SKIP_HOPRD_SESSIONS=false
export K6_ECHO_SERVERS_REPLICAS=4
export K6_TEST_DURATION=1
export K6_ITERATION_TIMEOUT=15
export K6_PAYLOAD_SIZE=$((10 * 1024 * 1024))
export K6_DOWNLOAD_THROUGHPUT=$((1 * 1024 * 1024))
export K6_UPLOAD_THROUGHPUT=$((512 * 1024))
npm run setup
```

Run tests:
```
npm run test:udp
npm run test:tcp
```

## Running remotely

A pipeline has been created to run the load testing remotely using a manual [github workflow](https://github.com/hoprnet/hoprnet/actions/workflows/load-tests.yaml) 

## Analyse results

A [grafana dashboard](https://grafana.staging.hoprnet.link/d/load-tests-results/load-tests-results?orgId=1&from=now-30m&to=now) exists to analyse the results in real time 