// Copyright 2026 Axiumine
//
// Added in the Axiumine fork of RedisGrafana/grafana-redis-datasource.
// Licensed under the Apache License, Version 2.0. See LICENSE.

package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

// unreachableAddress is a loopback port nothing listens on, so a dial fails
// immediately with "connection refused" rather than waiting out a timeout.
const unreachableAddress = "127.0.0.1:1"

/**
 * selfSignedPEM returns a certificate and its key, both PEM encoded.
 *
 * The certificate is generated rather than checked in: a fixture expires, and
 * an expired fixture turns these tests red on a date nobody chose.
 */
func selfSignedPEM(t *testing.T) (certPEM string, keyPEM string) {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)

	template := x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "redis-datasource-test"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(time.Hour),
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		BasicConstraintsValid: true,
		IsCA:                  true,
	}

	der, err := x509.CreateCertificate(rand.Reader, &template, &template, &key.PublicKey, key)
	require.NoError(t, err)

	keyDER, err := x509.MarshalECPrivateKey(key)
	require.NoError(t, err)

	return string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})),
		string(pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}))
}

/**
 * acceptingListener starts a loopback listener that accepts connections and
 * then says nothing.
 *
 * radix.Dial with no authentication and no SELECT sends no command of its own,
 * so a silent peer is enough to let a pool come up. That is what makes the
 * successful construction path testable without a Redis.
 */
func acceptingListener(t *testing.T) string {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)

	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}

			t.Cleanup(func() { _ = conn.Close() })
		}
	}()

	t.Cleanup(func() { _ = listener.Close() })

	return listener.Addr().String()
}

/**
 * getConnOpts
 */
func TestGetConnOpts(t *testing.T) {
	t.Parallel()

	certPEM, keyPEM := selfSignedPEM(t)

	t.Run("should return only the timeout when TLS is off", func(t *testing.T) {
		t.Parallel()

		opts, err := getConnOpts(redisClientConfiguration{Timeout: 10})
		require.NoError(t, err)
		require.Len(t, opts, 1)
	})

	t.Run("should add a TLS option when TLS is on", func(t *testing.T) {
		t.Parallel()

		opts, err := getConnOpts(redisClientConfiguration{Timeout: 10, TLSAuth: true, TLSSkipVerify: true})
		require.NoError(t, err)
		require.Len(t, opts, 2)
	})

	t.Run("should accept a certification authority", func(t *testing.T) {
		t.Parallel()

		opts, err := getConnOpts(redisClientConfiguration{Timeout: 10, TLSAuth: true, TLSCACert: certPEM})
		require.NoError(t, err)
		require.Len(t, opts, 2)
	})

	// A CA that does not parse leaves the pool on the system roots rather than
	// failing the connection: the operator pasted something wrong, and the
	// server may still present a publicly rooted certificate.
	t.Run("should tolerate a certification authority that does not parse", func(t *testing.T) {
		t.Parallel()

		opts, err := getConnOpts(redisClientConfiguration{Timeout: 10, TLSAuth: true, TLSCACert: "not a certificate"})
		require.NoError(t, err)
		require.Len(t, opts, 2)
	})

	t.Run("should accept a client certificate and key", func(t *testing.T) {
		t.Parallel()

		opts, err := getConnOpts(redisClientConfiguration{
			Timeout:       10,
			TLSAuth:       true,
			TLSClientCert: certPEM,
			TLSClientKey:  keyPEM,
		})
		require.NoError(t, err)
		require.Len(t, opts, 2)
	})

	// A client certificate that does not pair with its key is a configuration
	// error the operator has to see, so it fails rather than falling back to an
	// anonymous connection that would look like a permissions problem later.
	t.Run("should fail on a client certificate that does not match its key", func(t *testing.T) {
		t.Parallel()

		otherCert, _ := selfSignedPEM(t)

		opts, err := getConnOpts(redisClientConfiguration{
			Timeout:       10,
			TLSAuth:       true,
			TLSClientCert: otherCert,
			TLSClientKey:  keyPEM,
		})
		require.Error(t, err)
		require.Nil(t, opts)
	})
}

/**
 * newRadixV3Client
 */
func TestNewRadixV3Client(t *testing.T) {
	t.Parallel()

	t.Run("should build a standalone client", func(t *testing.T) {
		t.Parallel()

		client, err := newRadixV3Client(redisClientConfiguration{
			URL:      acceptingListener(t),
			Timeout:  1,
			PoolSize: 1,
		})
		require.NoError(t, err)
		require.NotNil(t, client)
		require.NoError(t, client.Close())
	})

	t.Run("should report a standalone connection that fails", func(t *testing.T) {
		t.Parallel()

		client, err := newRadixV3Client(redisClientConfiguration{
			URL:      unreachableAddress,
			Timeout:  1,
			PoolSize: 1,
		})
		require.Error(t, err)
		require.Nil(t, client)
	})

	t.Run("should report a cluster connection that fails", func(t *testing.T) {
		t.Parallel()

		client, err := newRadixV3Client(redisClientConfiguration{
			URL:      unreachableAddress + "," + unreachableAddress,
			Client:   "cluster",
			Timeout:  1,
			PoolSize: 1,
		})
		require.Error(t, err)
		require.Nil(t, client)
	})

	t.Run("should report a sentinel connection that fails", func(t *testing.T) {
		t.Parallel()

		client, err := newRadixV3Client(redisClientConfiguration{
			URL:              unreachableAddress,
			Client:           "sentinel",
			SentinelName:     "mymaster",
			SentinelACL:      true,
			SentinelUser:     "sentinel",
			SentinelPassword: "secret",
			Timeout:          1,
			PoolSize:         1,
		})
		require.Error(t, err)
		require.Nil(t, client)
	})

	t.Run("should report a sentinel connection that fails with a password alone", func(t *testing.T) {
		t.Parallel()

		client, err := newRadixV3Client(redisClientConfiguration{
			URL:              unreachableAddress,
			Client:           "sentinel",
			SentinelName:     "mymaster",
			SentinelPassword: "secret",
			Timeout:          1,
			PoolSize:         1,
		})
		require.Error(t, err)
		require.Nil(t, client)
	})

	t.Run("should report a socket connection that fails", func(t *testing.T) {
		t.Parallel()

		client, err := newRadixV3Client(redisClientConfiguration{
			URL:      "/nonexistent/redis.sock",
			Client:   "socket",
			Timeout:  1,
			PoolSize: 1,
		})
		require.Error(t, err)
		require.Nil(t, client)
	})

	t.Run("should authenticate with a user when ACL is on", func(t *testing.T) {
		t.Parallel()

		client, err := newRadixV3Client(redisClientConfiguration{
			URL:      unreachableAddress,
			ACL:      true,
			User:     "grafana",
			Password: "secret",
			Timeout:  1,
			PoolSize: 1,
		})
		require.Error(t, err)
		require.Nil(t, client)
	})

	t.Run("should authenticate with a password alone when ACL is off", func(t *testing.T) {
		t.Parallel()

		client, err := newRadixV3Client(redisClientConfiguration{
			URL:      unreachableAddress,
			Password: "secret",
			Timeout:  1,
			PoolSize: 1,
		})
		require.Error(t, err)
		require.Nil(t, client)
	})

	// The sentinel has a dial function of its own, with its own credentials, so
	// the certificate is checked there as well as on the path to the master.
	t.Run("should report a sentinel certificate that does not match its key", func(t *testing.T) {
		t.Parallel()

		certPEM, _ := selfSignedPEM(t)
		_, otherKey := selfSignedPEM(t)

		client, err := newRadixV3Client(redisClientConfiguration{
			URL:           unreachableAddress,
			Client:        "sentinel",
			SentinelName:  "mymaster",
			Timeout:       1,
			PoolSize:      1,
			TLSAuth:       true,
			TLSClientCert: certPEM,
			TLSClientKey:  otherKey,
		})
		require.Error(t, err)
		require.Nil(t, client)
	})

	// The certificate is checked inside the dial function, so a broken pair
	// surfaces as a failed connection rather than at construction time.
	t.Run("should report a certificate that does not match its key", func(t *testing.T) {
		t.Parallel()

		certPEM, _ := selfSignedPEM(t)
		_, otherKey := selfSignedPEM(t)

		client, err := newRadixV3Client(redisClientConfiguration{
			URL:           acceptingListener(t),
			Timeout:       1,
			PoolSize:      1,
			TLSAuth:       true,
			TLSClientCert: certPEM,
			TLSClientKey:  otherKey,
		})
		require.Error(t, err)
		require.Nil(t, client)
	})
}

/**
 * newDatasource
 */
func TestNewDatasource(t *testing.T) {
	t.Parallel()

	opts := newDatasource()
	require.NotNil(t, opts.QueryDataHandler)
	require.NotNil(t, opts.CheckHealthHandler)
	require.Equal(t, opts.QueryDataHandler, opts.CheckHealthHandler,
		"one datasource answers both, so the instance manager is shared")
}

/**
 * newDataSourceInstance
 */
func TestNewDataSourceInstance(t *testing.T) {
	t.Parallel()

	t.Run("should build an instance", func(t *testing.T) {
		t.Parallel()

		instance, err := newDataSourceInstance(context.Background(), backend.DataSourceInstanceSettings{
			URL:      acceptingListener(t),
			JSONData: []byte(`{"poolSize":1,"timeout":1}`),
		})
		require.NoError(t, err)
		require.NotNil(t, instance)

		settings, ok := instance.(*instanceSettings)
		require.True(t, ok)
		require.NoError(t, settings.client.Close())
	})

	t.Run("should report a configuration that does not parse", func(t *testing.T) {
		t.Parallel()

		instance, err := newDataSourceInstance(context.Background(), backend.DataSourceInstanceSettings{
			JSONData: []byte("{"),
		})
		require.Error(t, err)
		require.Nil(t, instance)
	})

	t.Run("should report a connection that cannot be opened", func(t *testing.T) {
		t.Parallel()

		instance, err := newDataSourceInstance(context.Background(), backend.DataSourceInstanceSettings{
			URL:      unreachableAddress,
			JSONData: []byte(`{"poolSize":1,"timeout":1}`),
		})
		require.Error(t, err)
		require.Nil(t, instance)
	})
}
