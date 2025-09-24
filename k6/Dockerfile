FROM node:22-slim as node

WORKDIR /app/k6
COPY . .
# Install yarn
RUN corepack enable \
  && corepack prepare yarn@1.22.22 --activate
# Install dependencies and build
RUN yarn install --frozen-lockfile \
  && yarn run webpack


# Build the k6 binary with the extension
FROM golang:1.24 as xk6

RUN go install go.k6.io/xk6/cmd/xk6@latest
RUN xk6 build v1.2.3 \
  --with github.com/grafana/xk6-output-prometheus-remote@latest \
  --with github.com/NAlexandrov/xk6-tcp \
  --with github.com/hoprnet/xk6-udp \
  --output /k6

FROM grafana/k6:latest

COPY --from=xk6 /k6 /usr/bin/k6
COPY --from=node /app/k6/dist /app/hoprnet

WORKDIR /app/hoprnet

ENTRYPOINT [ "/app/hoprnet/k6"]