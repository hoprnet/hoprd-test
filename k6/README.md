# Load Testing

This package is responsible of creating a set of load testing scenarios to be used to check performance and capacity of Hoprd network

## Use cases

- Generate high peaks of load to test network stability at those circumstances
- Generate high peaks of load to test hoprd node stability at those circumstances
- Generate constant traffic on nodes to test the network and their nodes against long running periods

# Setup development environment

## Installing xk6

The binary [xk6](https://github.com/grafana/xk6) is used to install a binary named `k6` with certain extensions. Follow the installations guidlelines on how to install locally a `k6` binary bundled with the [xk6-output-prometheus-remote](https://github.com/grafana/xk6-output-prometheus-remote). 

Here is an example to install it in MacOS systems:
```bash
docker run --rm -it -e GOOS=darwin -u "$(id -u):$(id -g)" -v "${PWD}:/xk6" grafana/xk6 build v0.42.0 --with github.com/grafana/xk6-output-prometheus-remote
```

## Nodes Topology

The load testing can be run against a given topology of nodes. At this moment we have identified the following topologies:
- many2many: This topology injects messages from any sender to any destination using any relayer
- sender: This topology injects messages from only 1 sender node(which does not act as relayer or destination), to many relayers to a many destinations
- receiver: This topology injects messages from only many sender nodes, to many relayers to only 1 destination (which does not act as relayer or sender)
- relayer: This topology injects messages from only many sender nodes to only 1 relayer node(which does not act as sender or destination) to a many destinations

## Building


Here are the most useful commands:

- `npm install`: Install Node dependencies
- `npm run build`: Build source code for running tests

## Running tests


- `npm run cluster:start`: Start local cluster
- `npm run cluster:stop`: Stops local cluster
- `npm run test`: Execute constant traffic test using previously started local cluster. Used for development purposes of load testing scenarios
- `npm run test:many2many`: Executes constant traffic test using many 2 many topology
- `npm run setup:rotsee`: Setup the rotsee environment to check nodes healthy and open channels


## Running remotely

A pipeline has been created to run the load testing remotely using a manual [github workflow](https://github.com/hoprnet/hoprnet/actions/workflows/load-tests.yaml) with these parameters

- Cluster of nodes
- Type of workload
- Number of messages per second


## Analyse results

A [grafana dashboard](https://grafana.staging.hoprnet.link/d/01npcT44k/k6-test-result?orgId=1) exists to analyse the results in real time 