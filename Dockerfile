# Modified in 2026 by Axiumine, from the original in
# RedisGrafana/grafana-redis-datasource at 09df07a. See NOTICE and CHANGELOG.md.

FROM golang:1.26.10@sha256:670bb5aa5349ae03b8516764718486f4f16399134bdc9acd0c46a23f043ab05c

WORKDIR /app
ADD . /app
RUN go mod tidy

CMD ["sleep", "infinity"]
