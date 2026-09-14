// Modified in 2026 by Axiumine, from the original in
// RedisGrafana/grafana-redis-datasource at 09df07a. See NOTICE and CHANGELOG.md.

import { SelectableValue } from '@grafana/data';

/**
 * Default Streaming Interval
 */
export const DefaultStreamingInterval = 1000;

/**
 * Default Streaming Capacity
 */
export const DefaultStreamingCapacity = 1000;

/**
 * Streaming Buffer Limit
 *
 * How many streaming series the data source keeps alive across a refresh. Each
 * entry is one panel query's circular buffer, so the limit bounds what a long
 * browsing session can accumulate; the least recently used entry is dropped once
 * it is reached, and a dropped series simply starts over.
 */
export const StreamingBufferLimit = 100;

/**
 * Client Type Values
 */
export enum ClientTypeValue {
  CLUSTER = 'cluster',
  SENTINEL = 'sentinel',
  SOCKET = 'socket',
  STANDALONE = 'standalone',
}

/**
 * Client Types
 */
export const ClientType = [
  { label: 'Standalone', value: ClientTypeValue.STANDALONE },
  { label: 'Cluster', value: ClientTypeValue.CLUSTER },
  { label: 'Sentinel', value: ClientTypeValue.SENTINEL },
  { label: 'Socket', value: ClientTypeValue.SOCKET },
];

/**
 * Streaming Data Type
 */
export enum StreamingDataType {
  TIMESERIES = 'TimeSeries',
  DATAFRAME = 'DataFrame',
}

/**
 * Streaming
 */
export const StreamingDataTypes: Array<SelectableValue<StreamingDataType>> = [
  {
    label: 'Time series',
    value: StreamingDataType.TIMESERIES,
  },
  {
    label: 'Data frame',
    value: StreamingDataType.DATAFRAME,
  },
];
