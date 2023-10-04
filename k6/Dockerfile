FROM node:18-slim as node

WORKDIR /app/k6
COPY . .
RUN npm install \
  && npm run build


# Build the k6 binary with the extension
FROM golang:1.20 as xk6

RUN go install go.k6.io/xk6/cmd/xk6@latest
RUN xk6 build --with github.com/grafana/xk6-output-prometheus-remote@latest --output /k6

FROM grafana/k6:latest

COPY --from=builder /k6 /usr/bin/k6
COPY --from=node /app/k6/dist /app/hoprnet

WORKDIR /app/hoprnet

ENV ENVIRONMENT_NAME=pluto
ENV WORKLOAD_NAME=simple

ENTRYPOINT [ "/app/hoprnet/k6"]