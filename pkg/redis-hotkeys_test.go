// Copyright 2026 Axiumine
//
// Added in the Axiumine fork of RedisGrafana/grafana-redis-datasource.
// Licensed under the Apache License, Version 2.0. See LICENSE.

package main

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

/**
 * fullHotkeysReply is what HOTKEYS GET answers with once tracking has run: a
 * flat map whose by-cpu-time-us and by-net-bytes entries are themselves flat
 * key/value arrays.
 */
func fullHotkeysReply() []interface{} {
	return []interface{}{
		[]byte("tracking-active"), int64(1),
		[]byte("sample-ratio"), int64(100),
		[]byte("selected-slots"), []interface{}{
			[]interface{}{int64(0), int64(8191)},
			[]interface{}{int64(8192), int64(16383)},
		},
		[]byte("collection-duration-ms"), int64(5000),
		[]byte("by-cpu-time-us"), []interface{}{
			[]byte("user:1"), int64(900),
			[]byte("user:2"), int64(300),
		},
		[]byte("by-net-bytes"), []interface{}{
			[]byte("user:1"), int64(4096),
			[]byte("user:3"), int64(128),
		},
	}
}

/**
 * HOTKEYS GET
 */
func TestQueryHotkeysGet(t *testing.T) {
	t.Parallel()

	t.Run("should merge the two orderings into one frame", func(t *testing.T) {
		t.Parallel()

		client := testClient{rcv: fullHotkeysReply(), expectedCmd: "HOTKEYS", expectedArgs: []string{"GET"}}
		response := queryHotkeysGet(queryModel{Command: "hotkeysGet"}, &client)

		require.NoError(t, response.Error)
		require.Len(t, response.Frames, 2)

		summary := response.Frames[0]
		require.Equal(t, "summary", summary.Name)
		require.Len(t, summary.Fields, 4)
		require.Equal(t, "tracking-active", summary.Fields[0].Name)
		require.Equal(t, int64(1), summary.Fields[0].At(0))
		require.Equal(t, "selected-slots", summary.Fields[2].Name)
		require.Equal(t, "0-8191, 8192-16383", summary.Fields[2].At(0))
		require.Equal(t, int64(5000), summary.Fields[3].At(0))

		// user:1 carries both metrics, user:2 only CPU time and user:3 only
		// bytes, so the two absent cells must be nil rather than zero: a key
		// the other ordering never reported has no measurement, not a
		// measurement of nothing.
		keys := response.Frames[1]
		require.Equal(t, "hotkeys", keys.Name)
		require.Equal(t, 3, keys.Fields[0].Len())
		require.Equal(t, []interface{}{"user:1", "user:2", "user:3"},
			[]interface{}{keys.Fields[0].At(0), keys.Fields[0].At(1), keys.Fields[0].At(2)})

		require.Equal(t, int64Pointer(900), keys.Fields[1].At(0))
		require.Equal(t, int64Pointer(300), keys.Fields[1].At(1))
		require.Nil(t, keys.Fields[1].At(2))

		require.Equal(t, int64Pointer(4096), keys.Fields[2].At(0))
		require.Nil(t, keys.Fields[2].At(1))
		require.Equal(t, int64Pointer(128), keys.Fields[2].At(2))
	})

	t.Run("should report a summary alone when tracking was never started", func(t *testing.T) {
		t.Parallel()

		client := testClient{rcv: nil}
		response := queryHotkeysGet(queryModel{}, &client)

		require.NoError(t, response.Error)
		require.Len(t, response.Frames, 1)
		require.Equal(t, "summary", response.Frames[0].Name)
		require.Equal(t, int64(0), response.Frames[0].Fields[0].At(0))
	})

	t.Run("should reject a reply that is not a map", func(t *testing.T) {
		t.Parallel()

		client := testClient{rcv: "OK"}
		response := queryHotkeysGet(queryModel{}, &client)

		require.Equal(t, errUnexpectedHotkeysReply, response.Error)
		require.Nil(t, response.Frames)
	})

	t.Run("should return the error when the command fails", func(t *testing.T) {
		t.Parallel()

		client := testClient{err: errors.New("NOPERM")}
		response := queryHotkeysGet(queryModel{}, &client)

		require.EqualError(t, response.Error, "NOPERM")
	})

	t.Run("should render a non-numeric scalar as text", func(t *testing.T) {
		t.Parallel()

		client := testClient{rcv: []interface{}{
			[]byte("collection-start-time-unix-ms"), []byte("never"),
		}}
		response := queryHotkeysGet(queryModel{}, &client)

		require.NoError(t, response.Error)
		require.Equal(t, "never", response.Frames[0].Fields[0].At(0))
	})

	t.Run("should skip an ordering that is not an array", func(t *testing.T) {
		t.Parallel()

		client := testClient{rcv: []interface{}{
			[]byte("by-cpu-time-us"), []byte("not an array"),
			[]byte("tracking-active"), int64(1),
		}}
		response := queryHotkeysGet(queryModel{}, &client)

		require.NoError(t, response.Error)
		require.Len(t, response.Frames[0].Fields, 1)
		require.Equal(t, 0, response.Frames[1].Fields[0].Len())
	})

	t.Run("should skip a key whose measurement is not a number", func(t *testing.T) {
		t.Parallel()

		client := testClient{rcv: []interface{}{
			[]byte("by-cpu-time-us"), []interface{}{
				[]byte("user:1"), []byte("unknown"),
				[]byte("user:2"), int64(11),
			},
		}}
		response := queryHotkeysGet(queryModel{}, &client)

		require.NoError(t, response.Error)
		require.Equal(t, 1, response.Frames[1].Fields[0].Len())
		require.Equal(t, "user:2", response.Frames[1].Fields[0].At(0))
	})

	t.Run("should ignore a trailing element with no value", func(t *testing.T) {
		t.Parallel()

		client := testClient{rcv: []interface{}{
			[]byte("tracking-active"), int64(1),
			[]byte("sample-ratio"),
		}}
		response := queryHotkeysGet(queryModel{}, &client)

		require.NoError(t, response.Error)
		require.Len(t, response.Frames[0].Fields, 1)
	})
}

/**
 * selected-slots
 */
func TestFormatSlotRanges(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    interface{}
		expected string
	}{
		{
			name: "pairs",
			input: []interface{}{
				[]interface{}{int64(0), int64(8191)},
				[]interface{}{int64(8192), int64(16383)},
			},
			expected: "0-8191, 8192-16383",
		},
		{
			name:     "single pair",
			input:    []interface{}{[]interface{}{int64(0), int64(16383)}},
			expected: "0-16383",
		},
		{
			name:     "empty array",
			input:    []interface{}{},
			expected: "",
		},
		{
			name:     "element that is not a pair",
			input:    []interface{}{[]interface{}{int64(0)}, []byte("all")},
			expected: "",
		},
		{
			name:     "not an array at all",
			input:    []byte("all"),
			expected: "all",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			require.Equal(t, test.expected, formatSlotRanges(test.input))
		})
	}
}
