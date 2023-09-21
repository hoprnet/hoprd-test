FROM node:18-slim as builder

WORKDIR /app/k6
COPY . .
RUN npm install \
  && npm run build

FROM grafana/xk6:latest

WORKDIR /app/hoprnet
RUN xk6 build --with github.com/grafana/xk6-output-prometheus-remote@latest

COPY --from=builder /app/k6/dist /app/hoprnet

ENV ENVIRONMENT_NAME=pluto
ENV WORKLOAD_NAME=simple

ENTRYPOINT [ "/app/hoprnet/k6"]