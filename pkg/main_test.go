// Copyright 2026 Axiumine
//
// Added in the Axiumine fork of RedisGrafana/grafana-redis-datasource.
// Licensed under the Apache License, Version 2.0. See LICENSE.

package main

import (
	"errors"
	"os"
	"reflect"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

/**
 * stubMain replaces manage and exit for the length of one test.
 */
func stubMain(t *testing.T, stubManage func(string, backend.ServeOpts) error, stubExit func(int)) {
	t.Helper()

	previousManage, previousExit := manage, exit
	manage, exit = stubManage, stubExit

	t.Cleanup(func() { manage, exit = previousManage, previousExit })
}

/**
 * main
 *
 * Not parallel: both subtests replace the package's manage and exit, and Go
 * holds every parallel test back until the sequential ones have finished.
 */
func TestMainServes(t *testing.T) {
	// Checked before any stub is in place: outside the tests, main must reach
	// the real backend.Manage and os.Exit, which the stubs below never prove.
	t.Run("should default to backend.Manage and os.Exit", func(t *testing.T) {
		require.Equal(t, reflect.ValueOf(backend.Manage).Pointer(), reflect.ValueOf(manage).Pointer())
		require.Equal(t, reflect.ValueOf(os.Exit).Pointer(), reflect.ValueOf(exit).Pointer())
	})

	t.Run("should serve the datasource under the plugin id", func(t *testing.T) {
		var servedID string
		var servedOpts backend.ServeOpts
		exited := false

		stubMain(t, func(pluginID string, serveOpts backend.ServeOpts) error {
			servedID, servedOpts = pluginID, serveOpts
			return nil
		}, func(int) { exited = true })

		main()

		require.Equal(t, "axiumine-redis-datasource", servedID)
		require.NotNil(t, servedOpts.QueryDataHandler)
		require.NotNil(t, servedOpts.CheckHealthHandler)
		require.False(t, exited)
	})

	t.Run("should exit with 1 when the datasource cannot be served", func(t *testing.T) {
		code := 0

		stubMain(t, func(string, backend.ServeOpts) error {
			return errors.New("listen tcp: address already in use")
		}, func(c int) { code = c })

		main()

		require.Equal(t, 1, code)
	})
}
