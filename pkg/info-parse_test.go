// Copyright 2026 Axiumine
//
// Added in the Axiumine fork of RedisGrafana/grafana-redis-datasource.
// Licensed under the Apache License, Version 2.0. See LICENSE.

package main

import (
	"testing"

	"github.com/stretchr/testify/require"
)

/**
 * parseInfoPairs
 */
func TestParseInfoPairs(t *testing.T) {
	t.Parallel()

	t.Run("should parse ordered key/value pairs", func(t *testing.T) {
		t.Parallel()

		require.Equal(t, []infoPair{{Key: "calls", Value: "12"}, {Key: "usec", Value: "34"}},
			parseInfoPairs("calls=12,usec=34"))
	})

	t.Run("should skip empty and whitespace-only elements", func(t *testing.T) {
		t.Parallel()

		require.Equal(t, []infoPair{{Key: "calls", Value: "12"}, {Key: "usec", Value: "34"}},
			parseInfoPairs("calls=12,,   ,usec=34"))
	})

	// A field with no "=" is dropped rather than treated as a key with an
	// empty value, so a malformed element cannot shift the rest of the record.
	t.Run("should skip an element carrying no separator", func(t *testing.T) {
		t.Parallel()

		require.Equal(t, []infoPair{{Key: "calls", Value: "12"}}, parseInfoPairs("calls=12,rejected"))
	})

	t.Run("should keep a separator inside the value", func(t *testing.T) {
		t.Parallel()

		require.Equal(t, []infoPair{{Key: "args", Value: "a=b"}}, parseInfoPairs("args=a=b"))
	})

	t.Run("should return no pairs for an empty value", func(t *testing.T) {
		t.Parallel()

		require.Empty(t, parseInfoPairs(""))
	})
}

/**
 * parseInfoRecords
 */
func TestParseInfoRecords(t *testing.T) {
	t.Parallel()

	t.Run("should trim the prefix from the record name", func(t *testing.T) {
		t.Parallel()

		records := parseInfoRecords([]string{"cmdstat_get:calls=12,usec=34"}, "cmdstat_")
		require.Len(t, records, 1)
		require.Equal(t, "get", records[0].Name)
		require.Equal(t, []infoPair{{Key: "calls", Value: "12"}, {Key: "usec", Value: "34"}}, records[0].Pairs)
	})

	t.Run("should keep the whole name when no prefix is given", func(t *testing.T) {
		t.Parallel()

		records := parseInfoRecords([]string{"cmdstat_get:calls=12"}, "")
		require.Equal(t, "cmdstat_get", records[0].Name)
	})

	t.Run("should skip a line that is not a record", func(t *testing.T) {
		t.Parallel()

		require.Empty(t, parseInfoRecords([]string{"# Commandstats", ""}, "cmdstat_"))
	})

	// A record whose value parses to no pairs at all carries no measurement,
	// so it must not become a row of nulls.
	t.Run("should skip a record with no pairs", func(t *testing.T) {
		t.Parallel()

		records := parseInfoRecords([]string{"cmdstat_get:unparseable", "cmdstat_set:calls=1"}, "cmdstat_")
		require.Len(t, records, 1)
		require.Equal(t, "set", records[0].Name)
	})
}

/**
 * recordsToFrame
 */
func TestRecordsToFrame(t *testing.T) {
	t.Parallel()

	t.Run("should type a column by the widest value observed for it", func(t *testing.T) {
		t.Parallel()

		// "calls" stays an integer, "usec_per_call" widens from integer to
		// float on the second record, and "note" widens all the way to string:
		// a single non-numeric value must not silently zero the series.
		records := []infoRecord{
			{Name: "get", Pairs: []infoPair{
				{Key: "calls", Value: "12"},
				{Key: "usec_per_call", Value: "3"},
				{Key: "note", Value: "7"},
			}},
			{Name: "set", Pairs: []infoPair{
				{Key: "calls", Value: "8"},
				{Key: "usec_per_call", Value: "3.5"},
				{Key: "note", Value: "n/a"},
			}},
		}

		frame := recordsToFrame("commands", "Command", records, "µs")
		require.Len(t, frame.Fields, 4)

		require.Equal(t, "Command", frame.Fields[0].Name)
		require.Equal(t, "get", frame.Fields[0].At(0))

		require.Equal(t, int64Pointer(12), frame.Fields[1].At(0))
		require.Equal(t, "µs", frame.Fields[1].Config.Unit)

		usec := frame.Fields[2].At(1).(*float64)
		require.Equal(t, 3.5, *usec)
		require.Equal(t, "µs", frame.Fields[2].Config.Unit)

		// A string column carries no unit, because the unit describes a
		// measurement and this column no longer holds one.
		note := frame.Fields[3].At(1).(*string)
		require.Equal(t, "n/a", *note)
		require.Nil(t, frame.Fields[3].Config)
	})

	t.Run("should leave a numeric column without a unit when none is given", func(t *testing.T) {
		t.Parallel()

		records := []infoRecord{
			{Name: "get", Pairs: []infoPair{{Key: "calls", Value: "12"}, {Key: "ratio", Value: "0.5"}}},
		}

		frame := recordsToFrame("commands", "Command", records, "")
		require.Nil(t, frame.Fields[1].Config)
		require.Nil(t, frame.Fields[2].Config)
	})

	// A key absent from a record is null, not zero: the command was never
	// called with it, which is not the same as having called it zero times.
	t.Run("should leave a missing value null", func(t *testing.T) {
		t.Parallel()

		records := []infoRecord{
			{Name: "get", Pairs: []infoPair{{Key: "calls", Value: "12"}}},
			{Name: "set", Pairs: []infoPair{{Key: "rejected", Value: "1"}}},
		}

		frame := recordsToFrame("commands", "Command", records, "")
		require.Nil(t, frame.Fields[1].At(1))
		require.Nil(t, frame.Fields[2].At(0))
	})
}
