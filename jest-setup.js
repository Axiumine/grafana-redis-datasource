// Copyright 2026 Axiumine
//
// Added in the Axiumine fork of RedisGrafana/grafana-redis-datasource.
// Licensed under the Apache License, Version 2.0. See LICENSE.

// Jest setup provided by Grafana scaffolding
import './.config/jest-setup';

/**
 * jsdom implements neither observer API.
 *
 * `@grafana/ui` uses `IntersectionObserver` in the ScrollContainer that wraps every `Select`
 * menu, and `ResizeObserver` in several layout components, so a component test that opens a
 * dropdown throws `ReferenceError` without these. Both stubs are inert: the code under test
 * only needs the constructor and the three methods to exist.
 */
class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

Object.assign(global, {
  IntersectionObserver: global.IntersectionObserver || ObserverStub,
  ResizeObserver: global.ResizeObserver || ObserverStub,
});
