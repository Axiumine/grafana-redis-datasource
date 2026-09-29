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
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/mediocregopher/radix/v3"
	"github.com/stretchr/testify/require"
)

// unreachableAddress is a loopback port nothing listens on, so a dial fails
// immediately with "connection refused" rather than waiting out a timeout.
const unreachableAddress = "127.0.0.1:1"

/**
 * selfSignedPEM returns a certificate and its key, both PEM encoded.
 *
 * The certificate is generated rather than checked in: a fixture expires, and
 * an expired fixture turns these tests red on a date nobody chose. It names
 * 127.0.0.1, so a loopback server presenting it passes the host name check
 * and the handshake tests below fail or pass on the authority alone.
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
		IPAddresses:           []net.IP{net.IPv4(127, 0, 0, 1)},
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
 * tlsListener starts a loopback TLS listener that completes the handshake of
 * every connection and then says nothing.
 *
 * A server connection shakes hands on its first read or write, and this one
 * does neither, so the handshake is driven explicitly. A maxVersion of 0 leaves
 * the server on TLS 1.2 and newer; any other value caps it there and lowers the
 * floor to TLS 1.0, which is what lets it stand in for an outdated server.
 */
func tlsListener(t *testing.T, certPEM string, keyPEM string, maxVersion uint16) string {
	t.Helper()

	cert, err := tls.X509KeyPair([]byte(certPEM), []byte(keyPEM))
	require.NoError(t, err)

	config := &tls.Config{Certificates: []tls.Certificate{cert}, MinVersion: tls.VersionTLS12}
	if maxVersion != 0 {
		config.MinVersion = tls.VersionTLS10
		config.MaxVersion = maxVersion
	}

	listener, err := tls.Listen("tcp", "127.0.0.1:0", config)
	require.NoError(t, err)

	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}

			t.Cleanup(func() { _ = conn.Close() })

			go func() { _ = conn.(*tls.Conn).Handshake() }()
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
 * getConnOpts, through a TLS handshake
 *
 * The options getConnOpts returns are opaque radix.DialOpt values, so what they
 * configure is observed where it takes effect: radix.Dial performs the TLS
 * handshake, and a dial succeeds exactly when the client accepted the server's
 * certificate and protocol version.
 */
func TestGetConnOptsHandshake(t *testing.T) {
	t.Parallel()

	certPEM, keyPEM := selfSignedPEM(t)

	dial := func(t *testing.T, addr string, configuration redisClientConfiguration) error {
		t.Helper()

		configuration.Timeout = 10
		configuration.TLSAuth = true

		opts, err := getConnOpts(configuration)
		require.NoError(t, err)

		conn, err := radix.Dial("tcp", addr, opts...)
		if err == nil {
			require.NoError(t, conn.Close())
		}

		return err
	}

	t.Run("should refuse a certificate no configured authority vouches for", func(t *testing.T) {
		t.Parallel()

		err := dial(t, tlsListener(t, certPEM, keyPEM, 0), redisClientConfiguration{})

		var authorityErr x509.UnknownAuthorityError
		require.ErrorAs(t, err, &authorityErr)
	})

	t.Run("should accept a certificate the configured authority vouches for", func(t *testing.T) {
		t.Parallel()

		err := dial(t, tlsListener(t, certPEM, keyPEM, 0), redisClientConfiguration{TLSCACert: certPEM})
		require.NoError(t, err)
	})

	t.Run("should accept any certificate when Skip Verify is on", func(t *testing.T) {
		t.Parallel()

		err := dial(t, tlsListener(t, certPEM, keyPEM, 0), redisClientConfiguration{TLSSkipVerify: true})
		require.NoError(t, err)
	})

	// Skip Verify is on, so the certificate cannot be what fails the handshake.
	// Go's client refuses TLS 1.1 by default as well, so this catches a floor
	// lowered below TLS 1.2 rather than one left unset.
	t.Run("should refuse a server that offers nothing newer than TLS 1.1", func(t *testing.T) {
		t.Parallel()

		err := dial(t, tlsListener(t, certPEM, keyPEM, tls.VersionTLS11), redisClientConfiguration{TLSSkipVerify: true})
		require.ErrorContains(t, err, "protocol version")
	})
}

/**
 * newRadixV3Client
 */
func TestNewRadixV3Client(t *testing.T) {
	t.Parallel()

	// Every client type has to dial through getConnOpts. One that dialled around
	// it would pass every getConnOpts test and still accept any certificate.
	certPEM, keyPEM := selfSignedPEM(t)
	for _, clientType := range []string{"standalone", "cluster", "sentinel"} {
		t.Run("should verify the server certificate of a "+clientType+" client", func(t *testing.T) {
			t.Parallel()

			client, err := newRadixV3Client(redisClientConfiguration{
				URL:          tlsListener(t, certPEM, keyPEM, 0),
				Client:       clientType,
				Timeout:      1,
				PoolSize:     1,
				TLSAuth:      true,
				SentinelName: "mymaster",
			})
			require.Nil(t, client)

			var authorityErr x509.UnknownAuthorityError
			require.ErrorAs(t, err, &authorityErr)
		})
	}

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
