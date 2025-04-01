#!/bin/bash
export K6_EXECUTION_NAME=manual
export K6_TEST_SCRIPT=udp
export K6_CLUSTER_NODES=core-rotsee
export K6_TOPOLOGY_NAME=receiver
export K6_WORKLOAD_NAME=constant
export K6_TEST_DURATION=30
export K6_ECHO_SERVERS_REPLICAS=4
export K6_PAYLOAD_SIZE=1048576
export K6_DOWNLOAD_THROUGHPUT=51200
export K6_UPLOAD_THROUGHPUT=524288
#npm install
#npm run setup
npm run test:udp
