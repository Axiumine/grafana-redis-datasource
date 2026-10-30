// Copyright 2026 Axiumine
//
// Added in the Axiumine fork of RedisGrafana/grafana-redis-datasource.
// Licensed under the Apache License, Version 2.0. See LICENSE.

package main

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

/**
 * The parsers below read text that a Redis server sends back, and a server is
 * not always one the operator controls. The invariants checked here are the ones
 * a panel relies on: a reply never panics the backend, and a frame it builds is
 * rectangular.
 *
 * `go test` runs the seeds below as ordinary tests; `go test -fuzz=FuzzInfoFrames
 * ./pkg` explores beyond them.
 */

/**
 * infoSectionFrame, through the same pipeline queryInfo runs.
 */
func FuzzInfoFrames(f *testing.F) {
	f.Add("# Server\r\nredis_version:8.10.1\r\nrun_id:abc\r\n\r\n# Clients\r\nconnected_clients:3\r\n")
	f.Add("# Commandstats\r\ncmdstat_get:calls=12,usec=34,usec_per_call=2.83,rejected_calls=0,failed_calls=0\r\n")
	f.Add("# Errorstats\r\nerrorstat_ERR:count=2\r\n")
	f.Add("# Latencystats\r\nlatency_percentiles_usec_client|setinfo:p50=1.003,p99=3.007,p99.9=3.007\r\n")
	f.Add("# Keyspace\r\ndb0:keys=1,expires=0,avg_ttl=0,subexpiry=0\r\n")
	f.Add("# Keysizes\r\ndistrib_strings_sizes:0=1,2=3,4=5\r\n")
	f.Add("# Modules\r\nmodule:name=search,ver=21005,api=1,filters=0,usedby=[],using=[ReJSON|x],options=[handle-io-errors]\r\n")
	f.Add("# Threads\r\nio_thread_0:clients=1,reads=2,writes=3\r\n")
	f.Add("garbage before any header\n# \n#\n:\n=\n,,,\n[[[\n]]]\n")

	f.Fuzz(func(t *testing.T, reply string) {
		for _, section := range splitInfoSections(splitInfoLines(reply)) {
			for _, streaming := range []bool{false, true} {
				frame := infoSectionFrame(section.Name, section.Name, section.Lines, streaming)

				require.NotNil(t, frame)
				_, err := frame.RowLen()
				require.NoError(t, err)
			}
		}
	})
}

/**
 * splitTopLevel only ever removes the separators it splits on, so joining the
 * parts back must give the input.
 */
func FuzzSplitTopLevel(f *testing.F) {
	f.Add("a=1,b=2", byte(','))
	f.Add("using=[a|b],options=[x,y]", byte(','))
	f.Add("[[,]],]", byte(','))
	f.Add("", byte('|'))

	f.Fuzz(func(t *testing.T, value string, sep byte) {
		require.Equal(t, value, strings.Join(splitTopLevel(value, sep), string([]byte{sep})))
	})
}

/**
 * parseInfoPairs drops what it cannot parse instead of shifting the record, so
 * every pair it does return was written as "key=value" in the input.
 */
func FuzzParseInfoPairs(f *testing.F) {
	f.Add("calls=12,usec=34")
	f.Add("a=1,,b,=,c=")
	f.Add("x=[1,2],y=[3|4]")

	f.Fuzz(func(t *testing.T, value string) {
		for _, pair := range parseInfoPairs(value) {
			require.Contains(t, value, pair.Key+"="+pair.Value)
		}
	})
}

/**
 * countClusterSlots reads slot ranges out of CLUSTER NODES. A reversed range or
 * a migration marker must never subtract from the total.
 */
func FuzzCountClusterSlots(f *testing.F) {
	f.Add("0-5460", "5461", "[1234-<-abcdef]")
	f.Add("9-3", "-", "")
	f.Add("9223372036854775807", "0-9223372036854775807", "1-")

	f.Fuzz(func(t *testing.T, a string, b string, c string) {
		require.GreaterOrEqual(t, countClusterSlots([]string{a, b, c}), int64(0))
	})
}
