// Modified in 2026 by Axiumine, from the original in
// RedisGrafana/grafana-redis-datasource at 09df07a. See NOTICE and CHANGELOG.md.

package models

/**
 * Redis Commands
 */
const (
	ClientList   = "clientList"
	ClusterInfo  = "clusterInfo"
	ClusterNodes = "clusterNodes"
	Get          = "get"
	HGet         = "hget"
	HGetAll      = "hgetall"
	HKeys        = "hkeys"
	HotkeysGet   = "hotkeysGet"
	HLen         = "hlen"
	HMGet        = "hmget"
	Info         = "info"
	LLen         = "llen"
	SCard        = "scard"
	SlowlogGet   = "slowlogGet"
	SMembers     = "smembers"
	TTL          = "ttl"
	Type         = "type"
	ZRange       = "zrange"
	XInfoStream  = "xinfoStream"
	XLen         = "xlen"
	XRange       = "xrange"
	XRevRange    = "xrevrange"
)
