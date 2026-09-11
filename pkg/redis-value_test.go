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
 * redisValueToStringOK
 *
 * radix decodes bulk strings as []byte and integers as int64, and RESP3 adds
 * doubles and booleans, so every scalar shape has to render. Anything that is
 * not a scalar must report false rather than an empty string, because the
 * callers use that to skip a value instead of inserting one.
 */
func TestRedisValueToStringOK(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    interface{}
		expected string
		ok       bool
	}{
		{"bulk string", []byte("key"), "key", true},
		{"empty bulk string", []byte{}, "", true},
		{"string", "key", "key", true},
		{"integer", int64(42), "42", true},
		{"negative integer", int64(-42), "-42", true},
		{"double", 1.5, "1.5", true},
		{"double without a fraction", 2.0, "2", true},
		{"boolean true", true, "true", true},
		{"boolean false", false, "false", true},
		{"array", []interface{}{"a"}, "", false},
		{"map", map[string]interface{}{"a": 1}, "", false},
		{"nil", nil, "", false},
		{"unhandled numeric type", 32, "", false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			text, ok := redisValueToStringOK(test.input)
			require.Equal(t, test.expected, text)
			require.Equal(t, test.ok, ok)
		})
	}
}

/**
 * redisValueToString discards the flag, so a non-scalar renders as "".
 */
func TestRedisValueToString(t *testing.T) {
	t.Parallel()

	require.Equal(t, "key", redisValueToString([]byte("key")))
	require.Equal(t, "7", redisValueToString(int64(7)))
	require.Equal(t, "", redisValueToString([]interface{}{"a"}))
}

/**
 * redisValueToInt64
 *
 * A bulk string that does not parse as an integer must report false rather
 * than the zero that ParseInt returns alongside its error, because the caller
 * cannot otherwise tell it apart from a genuine zero.
 */
func TestRedisValueToInt64(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    interface{}
		expected int64
		ok       bool
	}{
		{"integer", int64(42), 42, true},
		{"negative integer", int64(-42), -42, true},
		{"double truncates", 1.9, 1, true},
		{"numeric bulk string", []byte("42"), 42, true},
		{"non-numeric bulk string", []byte("forty two"), 0, false},
		{"empty bulk string", []byte{}, 0, false},
		{"numeric string", "42", 42, true},
		{"non-numeric string", "forty two", 0, false},
		{"boolean", true, 0, false},
		{"array", []interface{}{"a"}, 0, false},
		{"nil", nil, 0, false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			amount, ok := redisValueToInt64(test.input)
			require.Equal(t, test.expected, amount)
			require.Equal(t, test.ok, ok)
		})
	}
}
