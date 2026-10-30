# Modified in 2026 by Axiumine, from the original in
# RedisGrafana/grafana-redis-datasource at 09df07a. See NOTICE and CHANGELOG.md.

FROM redis/redis-stack-server:7.2.0-M01@sha256:0a8a91fbcd1a8189ab98cfb0c8a1e4cc40d0da1d8546bddb238bd836966596c9

RUN mkdir -p /redis

WORKDIR /redis

COPY redis.conf .
COPY startup.sh /usr/local/bin/
COPY startup_cluster.sh /usr/local/bin/

RUN useradd redis
RUN chown redis:redis /redis/* 
RUN chmod +x /usr/local/bin/startup.sh
RUN chmod +x /usr/local/bin/startup_cluster.sh

EXPOSE 6379

ENTRYPOINT [ "/usr/local/bin/startup.sh" ]