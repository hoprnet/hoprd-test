FROM node:18-slim as node

WORKDIR /app/k6
COPY . .
RUN npm install \
  && npm run webpack


# Build the k6 binary with the extension
FROM golang:1.20 as xk6

RUN go install go.k6.io/xk6/cmd/xk6@latest
RUN xk6 build v0.55.0 --with github.com/grafana/xk6-output-prometheus-remote@latest --with github.com/NAlexandrov/xk6-tcp --with github.com/hoprnet/xk6-udp --output /k6

FROM grafana/k6:latest

COPY --from=xk6 /k6 /usr/bin/k6
COPY --from=node /app/k6/dist /app/hoprnet

WORKDIR /app/hoprnet

ENV K6_CLUSTER_NODES=core-rotsee
ENV K6_TOPOLOGY_NAME=many2many
ENV K6_WORKLOAD_NAME=simple

ENTRYPOINT [ "/app/hoprnet/k6"]