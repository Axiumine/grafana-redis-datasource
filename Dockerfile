# Modified in 2026 by Axiumine, from the original in
# RedisGrafana/grafana-redis-datasource at 09df07a. See NOTICE and CHANGELOG.md.

FROM golang:1.26.8

WORKDIR /app
ADD . /app
RUN go mod tidy

CMD ["sleep", "infinity"]
