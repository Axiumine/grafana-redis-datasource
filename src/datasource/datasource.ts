// Modified in 2026 by Axiumine, from the original in
// RedisGrafana/grafana-redis-datasource at 09df07a. See NOTICE and CHANGELOG.md.

import { lastValueFrom, Observable } from 'rxjs';
import { map as map$, switchMap as switchMap$ } from 'rxjs/operators';
import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  LoadingState,
  MetricFindValue,
  ScopedVars,
} from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';
import { DefaultStreamingInterval, StreamingBufferLimit, StreamingDataType } from '../constants';
import { RedisQuery } from '../redis';
import { TimeSeriesStreaming } from '../time-series';
import { RedisDataSourceOptions } from '../types';

/**
 * Redis Data Source
 */
export class DataSource extends DataSourceWithBackend<RedisQuery, RedisDataSourceOptions> {
  /**
   * Streaming series, one per panel query, in least recently used order
   *
   * Grafana re-runs a panel's query on every dashboard refresh, and each run
   * subscribes to a new Observable. Holding the buffers inside the subscription,
   * as this did, threw away every point they had accumulated each time that
   * happened: a panel refreshing once a minute drew a minute of history and then
   * went blank, over and over, and the same query with the refresh turned off
   * behaved perfectly, which is what made it look like a rendering problem
   * rather than a query one. They live here instead, so a refresh continues the
   * series it was already drawing.
   *
   * The key carries the interpolated query, so editing a query or moving a
   * template variable starts a new series rather than appending readings of one
   * key to the history of another. A Map iterates in insertion order and every
   * hit is re-inserted, so the first entry is always the least recently used one
   * and eviction at StreamingBufferLimit takes that.
   */
  private streamingSeries = new Map<string, TimeSeriesStreaming>();

  /**
   * Constructor
   *
   * @param {DataSourceInstanceSettings<RedisDataSourceOptions>} instanceSettings Instance Settings
   */
  constructor(instanceSettings: DataSourceInstanceSettings<RedisDataSourceOptions>) {
    super(instanceSettings);
  }

  /**
   * Variable query action
   *
   * @param {string} query Query
   * @param {any} options Options
   * @returns {Promise<MetricFindValue[]>} Metric Find Values
   */
  async metricFindQuery?(query: string, options?: any): Promise<MetricFindValue[]> {
    /**
     * If query is not specified
     */
    if (!query) {
      return Promise.resolve([]);
    }

    /**
     * Run Query
     */
    return lastValueFrom(
      this.query({
        targets: [{ refId: 'A', datasource: options.variable.datasource, query }],
      } as DataQueryRequest<RedisQuery>).pipe(
        switchMap$((response) => response.data),
        switchMap$((data: DataFrame) => data.fields),
        map$((field) => {
          const values: MetricFindValue[] = [];
          field.values.toArray().forEach((value) => {
            values.push({ text: value });
          });

          return values;
        })
      )
    );
  }

  /**
   * Override to apply template variables
   *
   * @param {string} query Query
   * @param {ScopedVars} scopedVars Scoped variables
   */
  applyTemplateVariables(query: RedisQuery, scopedVars: ScopedVars) {
    const templateSrv = getTemplateSrv();

    /**
     * Replace variables
     */
    return {
      ...query,
      keyName: query.keyName ? templateSrv.replace(query.keyName, scopedVars) : '',
      query: query.query ? templateSrv.replace(query.query, scopedVars) : '',
      searchQuery: query.searchQuery ? templateSrv.replace(query.searchQuery, scopedVars) : '',
      field: query.field ? templateSrv.replace(query.field, scopedVars) : '',
      filter: query.filter ? templateSrv.replace(query.filter, scopedVars) : '',
      legend: query.legend ? templateSrv.replace(query.legend, scopedVars) : '',
      value: query.value ? templateSrv.replace(query.value, scopedVars) : '',
      path: query.path ? templateSrv.replace(query.path, scopedVars) : '',
      cypher: query.cypher ? templateSrv.replace(query.cypher, scopedVars) : '',
    };
  }

  /**
   * Override query to support streaming
   */
  query(request: DataQueryRequest<RedisQuery>): Observable<DataQueryResponse> {
    /**
     * No query
     * Need to typescript types narrowing
     */
    if (!request.targets.length) {
      return super.query(request);
    }

    /**
     * No streaming enabled
     */
    const streaming = request.targets.filter((target) => target.streaming);
    if (!streaming.length) {
      return super.query(request);
    }

    /**
     * Streaming enabled
     */
    return new Observable<DataQueryResponse>((subscriber) => {
      const frames: { [id: string]: TimeSeriesStreaming } = {};
      request.targets.forEach((target) => {
        /**
         * Time-series frame
         */
        if (target.streamingDataType !== StreamingDataType.DATAFRAME) {
          frames[target.refId] = this.streamingSeriesFor(request, target);
        }
      });

      /**
       * Get minimum Streaming Interval
       *
       * Only the streaming targets have a say. The interval is a streaming
       * setting, and the query editor shows the field only when the switch is
       * on, so a target with the switch off has never been asked for one and
       * reads back as the 1000ms default. Taken over every target, as it was
       * until 3.0.0, one such target pinned the whole panel to one tick a
       * second however high its streaming sibling had been set.
       */
      const streamingInterval = streaming.map((target) =>
        target.streamingInterval ? target.streamingInterval : DefaultStreamingInterval
      );

      /**
       * Interval
       */
      const intervalId = setInterval(
        async () => {
          const response = await lastValueFrom(super.query(request));

          /**
           * Every frame is updated concurrently, as it was before, but the promises
           * are awaited rather than dropped on the floor: an update that rejects
           * used to become an unhandled rejection with nothing to attribute it to.
           */
          await Promise.all(
            response.data.map(async (frame) => {
              if (frames[frame.refId]) {
                frame = await frames[frame.refId].update(frame.fields);
              }

              subscriber.next({
                data: [frame],
                key: frame.refId,
                state: LoadingState.Streaming,
              });
            })
          );
        },
        Math.min(...streamingInterval)
      );

      return () => {
        clearInterval(intervalId);
      };
    });
  }

  /**
   * Streaming series a target continues, created on first sight
   *
   * @param {DataQueryRequest<RedisQuery>} request Request the target belongs to
   * @param {RedisQuery} target Target
   * @returns {TimeSeriesStreaming} The series this target has been accumulating
   */
  private streamingSeriesFor(request: DataQueryRequest<RedisQuery>, target: RedisQuery): TimeSeriesStreaming {
    /**
     * The panel identifies the series and the interpolated query dates it. Both
     * are absent in Explore, which runs one query at a time, so the refId alone
     * is enough to tell that query's series from another's.
     */
    const key = [
      request.dashboardUID,
      request.panelId,
      target.refId,
      JSON.stringify(this.applyTemplateVariables(target, request.scopedVars)),
    ].join('/');

    const series = this.streamingSeries.get(key);
    if (series) {
      /**
       * Re-insert, so that insertion order stays least recently used first
       */
      this.streamingSeries.delete(key);
      this.streamingSeries.set(key, series);
      return series;
    }

    if (this.streamingSeries.size >= StreamingBufferLimit) {
      this.streamingSeries.delete(this.streamingSeries.keys().next().value as string);
    }

    const created = new TimeSeriesStreaming(target);
    this.streamingSeries.set(key, created);
    return created;
  }
}
