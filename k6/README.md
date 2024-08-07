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

## Target environment

The load testing can be run against a given environment. At this moment we have identified 4 environments:
- **Local cluster**: The local cluster environment is described in `hoprnet` repository as a development environment to run your own tests. It is not expected to receive too much load, but it is useful as it can be use to develop load testing tests 
- **Pluto**: The pluto image is a docker packaged distribution of the local cluster, which makes it easier to run for automated tests.
- **GCP rotsee**: The GCP rotsee environment consists of 10 nodes, not fully interconnected. Each node is running in a different VM and is expected to be used as target environment with more workloads than just developing the load testing.
- **Dufour rotsee**: The GCP dufour environment consists of 10 nodes, not fully interconnected. Each node is running in a different VM and is expected to be used as target environment with more workloads than just developing the load testing.

## Building


Here are the most useful commands:

- `npm install`: Install Node dependencies
- `npm run build`: Build source code for running tests

## Running tests


- `npm run cluster:start`: Start local cluster
- `npm run cluster:stop`: Stops local cluster
- `npm run test`: Execute constant traffic test using previously started local cluster. Used for development purposes of load testing scenarios
- `npm run test:pluto`: Executes a docker compose containing pluto and k6 scripts
- `npm run test:rotsee`: Executes constant traffic test against rotsee environment
- `npm run test:dufour`: Executes constant traffic test against dufour environment
- `npm run test:rotsee:setup`: Setup the rotsee environment to check nodes healthy and open channels
- `npm run test:dufour:setup`: Setup the dufour environment to check nodes healthy and open channels


## Running remotely

A pipeline has been created to run the load testing remotely using a manual [github workflow](https://github.com/hoprnet/hoprnet/actions/workflows/load-tests.yaml) with these parameters

- Cluster of nodes
- Type of workload
- Number of messages per second


## Analyse results

A [grafana dashboard](https://grafana.staging.hoprnet.link/d/01npcT44k/k6-test-result?orgId=1) exists to analyse the results in real time 