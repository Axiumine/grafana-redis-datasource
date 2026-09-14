// Modified in 2026 by Axiumine, from the original in
// RedisGrafana/grafana-redis-datasource at 09df07a. See NOTICE and CHANGELOG.md.

import { lastValueFrom, Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import {
  CircularDataFrame,
  DataQueryRequest,
  DataSourceInstanceSettings,
  Field,
  FieldType,
  MetricFindValue,
  PluginType,
  toDataFrame,
} from '@grafana/data';
import { DataSourceWithBackend, setTemplateSrv, TemplateSrv } from '@grafana/runtime';
import { ClientTypeValue, StreamingBufferLimit, StreamingDataType } from '../constants';
import { QueryTypeValue, RedisQuery } from '../redis';
import { getQuery } from '../tests/utils';
import { TimeFieldName } from '../time-series';
import { RedisDataSourceOptions } from '../types';
import { DataSource } from './datasource';

/**
 * Instance Settings
 */
const getInstanceSettings = (overrideSettings: object = {}): DataSourceInstanceSettings<RedisDataSourceOptions> => ({
  uid: '',
  id: 1,
  type: '',
  name: '',
  access: 'direct',
  readOnly: false,
  meta: {
    id: '',
    name: '',
    type: PluginType.datasource,
    info: {} as any,
    module: '',
    baseUrl: '',
  },
  jsonData: {
    poolSize: 0,
    timeout: 0,
    pingInterval: 0,
    pipelineWindow: 0,
    tlsAuth: false,
    tlsSkipVerify: false,
    client: ClientTypeValue.CLUSTER,
    sentinelName: '',
    sentinelUser: '',
    sentinelAcl: false,
    acl: false,
    cliDisabled: false,
    user: '',
  },
});

/**
 * Override Request
 */
interface OverrideRequest {
  [key: string]: unknown;
  targets?: RedisQuery[];
}

/**
 * Request
 */
const getRequest = (overrideRequest: OverrideRequest = {}): DataQueryRequest<RedisQuery> => ({
  requestId: '',
  interval: '',
  intervalMs: 0,
  range: {} as any,
  scopedVars: {},
  timezone: '',
  app: '',
  startTime: 0,
  ...overrideRequest,
  targets: overrideRequest.targets
    ? overrideRequest.targets
    : [
        {
          type: QueryTypeValue.CLI,
          refId: 'A',
          query: '',
          streaming: false,
        },
      ],
});

/**
 * Data Source
 */
describe('DataSource', () => {
  const superQueryMock = jest.spyOn(DataSourceWithBackend.prototype, 'query').mockImplementation(
    () =>
      new Observable((subscriber) => {
        subscriber.next({
          data: [
            toDataFrame({
              refId: 'A',
              fields: [
                {
                  name: 'get',
                  type: FieldType.number,
                  values: [1, 2, 3],
                },
              ],
            }),
          ],
        });
        subscriber.complete();
      })
  );
  const instanceSettings = getInstanceSettings();
  let dataSource: DataSource;
  let templateSrv: TemplateSrv;

  beforeEach(() => {
    superQueryMock.mockClear();
    dataSource = new DataSource(instanceSettings);
    templateSrv = {
      replace: jest.fn().mockImplementation((value) => `replaced:${value}`),
      getVariables: jest.fn(),
      containsTemplate: jest.fn(),
      updateTimeRange: jest.fn(),
    };
    setTemplateSrv(templateSrv);
  });

  /**
   * Query Method
   */
  describe('query', () => {
    it('If no streaming should use super.query', (done) => {
      const request = getRequest();
      dataSource.query(request).subscribe(() => {
        expect(superQueryMock).toHaveBeenCalledWith(request);
        done();
      });
    });

    it('If no query should use super.query', (done) => {
      const request = getRequest({ targets: [] });
      dataSource.query(request).subscribe(() => {
        expect(superQueryMock).toHaveBeenCalledWith(request);
        done();
      });
    });

    it('Should use TimeSeries as default streamingDataType', (done) => {
      const request = getRequest({
        targets: [
          {
            type: QueryTypeValue.CLI,
            refId: 'A',
            query: '',
            streaming: true,
            streamingCapacity: 1,
            streamingInterval: 1,
          },
        ],
      });

      /**
       * Query
       */
      dataSource
        .query(request)
        .pipe(take(3))
        .subscribe(
          (value) => {
            value.data.forEach((item) => {
              /**
               * TimeSeriesStreaming hands out a detached copy of its circular
               * buffer rather than the buffer itself, so the frame that reaches
               * a panel is an ordinary one whose fields own ordinary arrays.
               */
              expect(item).not.toBeInstanceOf(CircularDataFrame);
              expect(item.fields.some((field: Field) => field.name === TimeFieldName)).toBeTruthy();
              item.fields.forEach((field: Field) => {
                expect(Array.isArray(field.values)).toBeTruthy();
              });
            });
          },
          null,
          () => {
            done();
          }
        );
    });

    it('If streaming exists should get frames in interval', (done) => {
      const request = getRequest({
        targets: [
          {
            type: QueryTypeValue.CLI,
            refId: 'A',
            query: '',
            streaming: true,
            streamingCapacity: 1,
            streamingDataType: StreamingDataType.DATAFRAME,
          },
        ],
      });

      /**
       * Query
       */
      dataSource
        .query(request)
        .pipe(take(3))
        .subscribe(
          (value) => {
            value.data.forEach((item) => {
              expect(item).not.toBeInstanceOf(CircularDataFrame);
              expect(item.fields).toBeDefined();
            });
          },
          null,
          () => {
            done();
          }
        );
    });

    /**
     * One streaming reading, taken and unsubscribed as a refresh would
     */
    const streamOnce = (overrideRequest: OverrideRequest) =>
      lastValueFrom(dataSource.query(getRequest(overrideRequest)).pipe(take(1)));

    /**
     * Streaming target
     */
    const streamingTarget = (overrideTarget: Partial<RedisQuery> = {}): RedisQuery => ({
      type: QueryTypeValue.CLI,
      refId: 'A',
      query: '',
      streaming: true,
      streamingCapacity: 100,
      streamingInterval: 1,
      ...overrideTarget,
    });

    it('Should continue a series across the re-subscription a dashboard refresh makes', (done) => {
      const target = streamingTarget();
      const lengths: number[] = [];

      /**
       * A refresh tears the subscription down and issues the same query again as
       * a new request, so the series has to survive the gap between the two.
       */
      dataSource
        .query(getRequest({ dashboardUID: 'dashboard', panelId: 1, targets: [target] }))
        .pipe(take(3))
        .subscribe({
          next: (value) => lengths.push(value.data[0].length),
          complete: () => {
            dataSource
              .query(getRequest({ dashboardUID: 'dashboard', panelId: 1, targets: [target] }))
              .pipe(take(1))
              .subscribe({
                next: (value) => lengths.push(value.data[0].length),
                complete: () => {
                  expect(lengths).toEqual([1, 2, 3, 4]);
                  done();
                },
              });
          },
        });
    });

    it('Should start a new series when the interpolated query changes', async () => {
      const first = await streamOnce({
        dashboardUID: 'dashboard',
        panelId: 1,
        targets: [streamingTarget({ query: 'INFO' })],
      });
      const second = await streamOnce({
        dashboardUID: 'dashboard',
        panelId: 1,
        targets: [streamingTarget({ query: 'INFO' })],
      });
      const edited = await streamOnce({
        dashboardUID: 'dashboard',
        panelId: 1,
        targets: [streamingTarget({ query: 'DBSIZE' })],
      });

      /**
       * The same query continues, the edited one is a series of its own
       */
      expect(first.data[0].length).toEqual(1);
      expect(second.data[0].length).toEqual(2);
      expect(edited.data[0].length).toEqual(1);
    });

    it('Should drop the least recently used series once the buffer limit is reached', async () => {
      await streamOnce({ dashboardUID: 'dashboard', panelId: 0, targets: [streamingTarget()] });

      /**
       * Fill the cache past its limit, so that panel 0, the oldest, is evicted
       */
      for (let panelId = 1; panelId <= StreamingBufferLimit; panelId++) {
        await streamOnce({ dashboardUID: 'dashboard', panelId, targets: [streamingTarget()] });
      }

      const evicted = await streamOnce({ dashboardUID: 'dashboard', panelId: 0, targets: [streamingTarget()] });
      const kept = await streamOnce({
        dashboardUID: 'dashboard',
        panelId: StreamingBufferLimit,
        targets: [streamingTarget()],
      });

      expect(evicted.data[0].length).toEqual(1);
      expect(kept.data[0].length).toEqual(2);
    });

    it('Should read on subscription rather than waiting out the first interval', async () => {
      /**
       * A refresh clears the timer and starts it from zero, so an interval
       * longer than the refresh period never reached its deadline and the panel
       * drew nothing at all. Jest's own timeout is what asserts it here: a
       * reading that waited for this interval could not arrive in time.
       */
      const reading = await streamOnce({
        dashboardUID: 'dashboard',
        panelId: 2,
        targets: [streamingTarget({ streamingInterval: 60000 })],
      });

      expect(reading.data[0].length).toEqual(1);
    });

    it('Should take the streaming interval from the streaming targets alone', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      /**
       * A panel whose second target does not stream. That target carries no
       * interval, because the query editor never offered it one, and taking it
       * into account would hold the panel at the 1000ms default.
       */
      const subscription = dataSource
        .query(
          getRequest({
            targets: [
              streamingTarget({ streamingInterval: 60000 }),
              { type: QueryTypeValue.CLI, refId: 'B', query: '' },
            ],
          })
        )
        .subscribe();

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);

      subscription.unsubscribe();
      setIntervalSpy.mockRestore();
    });
  });

  /**
   * ApplyTemplateVariables Method
   */
  describe('applyTemplateVariables', () => {
    type KeyType = keyof RedisQuery;
    const testedFieldKeys: KeyType[] = [
      'keyName',
      'query',
      'searchQuery',
      'field',
      'filter',
      'legend',
      'value',
      'path',
      'cypher',
    ];

    testedFieldKeys.forEach((fieldKey) => {
      describe(fieldKey, () => {
        it('If value is exist should replace via templateSrv', () => {
          const value = 'filter';
          const query = getQuery({ [fieldKey]: value });
          const scopedVars = { keyName: { value: 'key', key: '', text: '' } };
          const resultQuery = dataSource.applyTemplateVariables(query, scopedVars);
          expect(templateSrv.replace).toHaveBeenCalledWith(query[fieldKey], scopedVars);
          expect(resultQuery).toEqual({
            ...query,
            [fieldKey]: `replaced:${value}`,
          });
        });

        it('If value is empty should not replace via templateSrv', () => {
          const value = '';
          const query = getQuery({ [fieldKey]: value });
          const scopedVars = { keyName: { value: 'key', key: '', text: '' } };
          const resultQuery = dataSource.applyTemplateVariables(query, scopedVars);
          expect(templateSrv.replace).not.toHaveBeenCalled();
          expect(resultQuery).toEqual({
            ...query,
            [fieldKey]: value,
          });
        });
      });
    });
  });

  /**
   * MetricFindQuery Method
   */
  describe('metricFindQuery', () => {
    it('If query is empty should return empty array', (done) => {
      dataSource.metricFindQuery &&
        dataSource.metricFindQuery('', { variable: { datasource: '123' } }).then((result: MetricFindValue[]) => {
          expect(result).toEqual([]);
          done();
        });
    });

    it('If options.variables.datasource is null (default) should return empty array', (done) => {
      dataSource.metricFindQuery &&
        dataSource.metricFindQuery('123', { variable: { datasource: null } }).then((result: MetricFindValue[]) => {
          expect(result.length).toEqual(3);
          done();
        });
    });

    it('Should call query method', (done) => {
      const querySpyMethod = jest.spyOn(dataSource, 'query').mockImplementation(
        () =>
          new Observable((subscriber) => {
            subscriber.next({
              data: [
                {
                  fields: [
                    {
                      name: 'get',
                      values: {
                        toArray() {
                          return ['1', '2', '3'];
                        },
                      },
                    },
                  ],
                  length: 1,
                },
              ],
            });
            subscriber.complete();
          })
      );

      dataSource.metricFindQuery &&
        dataSource.metricFindQuery('123', { variable: { datasource: '123' } }).then((result: MetricFindValue[]) => {
          expect(querySpyMethod).toHaveBeenCalled();
          expect(result).toEqual([{ text: '1' }, { text: '2' }, { text: '3' }]);
          done();
        });
    });
  });

  it('Should call query method with numbers', (done) => {
    const querySpyMethod = jest.spyOn(dataSource, 'query').mockImplementation(
      () =>
        new Observable((subscriber) => {
          subscriber.next({
            data: [
              {
                fields: [
                  {
                    name: 'get',
                    values: {
                      toArray() {
                        return new Float64Array([21, 31]);
                      },
                    },
                  },
                ],
                length: 1,
              },
            ],
          });
          subscriber.complete();
        })
    );

    dataSource.metricFindQuery &&
      dataSource.metricFindQuery('123', { variable: { datasource: '123' } }).then((result: MetricFindValue[]) => {
        expect(querySpyMethod).toHaveBeenCalled();
        expect(result).toEqual([{ text: 21 }, { text: 31 }]);
        done();
      });
  });

  afterAll(() => {
    superQueryMock.mockReset();
    setTemplateSrv(null as any);
  });
});
