// Modified in 2026 by Axiumine, from the original in
// RedisGrafana/grafana-redis-datasource at 09df07a. See NOTICE and CHANGELOG.md.

import React from 'react';
import { RedisGraph } from 'redis/graph';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { SelectableValue } from '@grafana/data';
import { StreamingDataTypes } from '../../constants';
import {
  Aggregations,
  AggregationValue,
  Commands,
  InfoSections,
  QueryType,
  QueryTypeCli,
  QueryTypeValue,
  Redis,
  RedisGears,
  RedisJson,
  RedisQuery,
  RedisTimeSeries,
  ZRangeQuery,
} from '../../redis';
import { getQuery } from '../../tests/utils';
import { QueryEditor } from './QueryEditor';
import { RediSearch } from '../../redis/search';

/**
 * Data Source
 */
const dataSourceMock = {
  name: 'datasource',
};
const dataSourceInstanceSettingsMock = {
  jsonData: { cliDisabled: false },
};

const dataSourceSrvGetMock = jest.fn().mockImplementation(() => Promise.resolve(dataSourceMock));
const dataSourceSrvGetInstanceSettingsMock = jest.fn().mockImplementation(() => dataSourceInstanceSettingsMock);

jest.mock('@grafana/runtime', () => ({
  getDataSourceSrv: () => ({
    get: dataSourceSrvGetMock,
    getInstanceSettings: dataSourceSrvGetInstanceSettingsMock,
  }),
}));

/**
 * Locators
 *
 * A real render only exposes what a user can reach, so each kind of control is addressed the way
 * it is labelled: `FormField` and the legacy `Switch` tie their label to the input with `htmlFor`,
 * while `Select`, `TextArea` and `RadioButtonGroup` sit next to a bare `InlineFormLabel` and carry
 * an `aria-label` of their own.
 */
const field = (label: string) => () => screen.queryByLabelText<HTMLInputElement>(label);
const textArea = (label: string) => () => screen.queryByRole<HTMLTextAreaElement>('textbox', { name: label });
const select = (label: string) => () => screen.queryByRole<HTMLInputElement>('combobox', { name: label });
const radioGroup = (label: string) => () => screen.queryByRole('radiogroup', { name: label });

/**
 * `react-select` keeps its search input empty and renders the selected option's label beside it,
 * in the value container, so that is where the current value has to be read from.
 */
const selectedOptionLabel = (element: HTMLElement): string =>
  element.closest('[class*="grafana-select-value-container"]')?.textContent ?? '';

/**
 * An option renders its label and its description one after the other, so its accessible name is
 * the two concatenated. Matching on the label alone would also match every option whose label
 * merely starts with it, hence the comparison against the label element itself.
 */
const byOptionLabel = (option: SelectableValue<any>) => (_name: string, element: Element | null) =>
  element?.querySelector('span')?.textContent === option.label;

const openMenu = (element: HTMLElement) => fireEvent.keyDown(element, { key: 'ArrowDown', code: 'ArrowDown' });

const selectOption = (element: HTMLElement, option: SelectableValue<any>) => {
  openMenu(element);
  fireEvent.click(screen.getByRole('option', { name: byOptionLabel(option) }));
};

/**
 * Query Field
 */
interface QueryFieldTest {
  name: keyof RedisQuery;
  testName?: string;

  /**
   * Locates the control, and returns null when it is not rendered.
   */
  queryElement: () => HTMLElement | null;
  type: 'number' | 'string' | 'select' | 'switch' | 'radioButton';
  queryWhenShown: RedisQuery;
  queryWhenHidden: RedisQuery;

  /**
   * The option list a `select` or a `radioButton` renders. Such a control can only ever hold one
   * of its own options, so the first entry stands in for the value carried by the query and the
   * second for the value the test switches to.
   */
  options?: Array<SelectableValue<any>>;
}

/**
 * Query Editor
 */
describe('QueryEditor', () => {
  const onRunQuery = jest.fn();
  const onChange = jest.fn();

  const renderEditor = (query: RedisQuery) =>
    render(<QueryEditor datasource={{} as any} query={query} onRunQuery={onRunQuery} onChange={onChange} />);

  beforeEach(() => {
    onRunQuery.mockReset();
    onChange.mockReset();
  });

  /**
   * Run tests for query fields
   *
   * @param tests
   */
  const runQueryFieldsTest = (tests: QueryFieldTest[]) =>
    tests.forEach(({ name, queryElement, queryWhenShown, queryWhenHidden, type, options, testName = name }) => {
      describe(testName, () => {
        it('Should be shown', () => {
          renderEditor(getQuery(queryWhenShown));
          expect(queryElement()).toBeInTheDocument();
        });

        it('Should not be shown', () => {
          renderEditor(getQuery(queryWhenHidden));
          expect(queryElement()).not.toBeInTheDocument();
        });

        it('Should set value from query', () => {
          const query = getQuery({ [name]: options ? options[0].value : 123, ...queryWhenShown });
          renderEditor(query);
          const testedComponent = queryElement() as HTMLElement;

          if (type === 'select') {
            expect(selectedOptionLabel(testedComponent)).toEqual(options![0].label);
          } else if (type === 'radioButton') {
            expect(within(testedComponent).getByRole('radio', { name: options![0].label })).toBeChecked();
          } else if (type === 'switch') {
            expect((testedComponent as HTMLInputElement).checked).toEqual(query[name]);
          } else {
            expect((testedComponent as HTMLInputElement).value).toEqual(String(query[name]));
          }
        });

        it('Should call onChange prop when value was changed', () => {
          const query = getQuery(queryWhenShown);
          renderEditor(query);
          const testedComponent = queryElement() as HTMLElement;

          let newValue: any = '1234';
          if (type === 'number' || type === 'string') {
            fireEvent.change(testedComponent, { target: { value: newValue } });
            newValue = type === 'number' ? parseInt(newValue, 10) : newValue;
          } else if (type === 'select') {
            newValue = options![1].value;
            selectOption(testedComponent, options![1]);
          } else if (type === 'switch') {
            newValue = !query[name];
            fireEvent.click(testedComponent);
          } else if (type === 'radioButton') {
            newValue = options![1].value;
            fireEvent.click(within(testedComponent).getByRole('radio', { name: options![1].label }));
          }

          expect(onChange).toHaveBeenCalledWith({
            ...query,
            [name]: newValue,
          });
        });
      });
    });

  describe('Return Fields', () => {
    const getQueryProp = (): RedisQuery => ({ refId: '', type: QueryTypeValue.SEARCH, command: RediSearch.SEARCH });

    it('should click and add an input', () => {
      const { container } = renderEditor(getQueryProp());
      const inputsDiv = container.querySelector('#returnFieldInputs') as HTMLElement;
      expect(inputsDiv.children).toHaveLength(0);

      fireEvent.click(screen.getByRole('button', { name: 'Add Return Field' }));
      expect(inputsDiv.children).toHaveLength(1);
    });

    it('should call onReturnFieldChange successfully', () => {
      const query = getQueryProp();
      const { container } = renderEditor(query);
      fireEvent.click(screen.getByRole('button', { name: 'Add Return Field' }));

      const input = container.querySelector('input[name="returnField:0"]') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'foo' } });
      expect(query.returnFields).toEqual(['foo']);
    });

    it('should submit form', async () => {
      const { container } = renderEditor(getQueryProp());
      const form = container.querySelector('#returnFieldsForm') as HTMLFormElement;
      await act(async () => {
        fireEvent.submit(form);
      });
      expect(form).toBeInTheDocument();
    });
  });

  /**
   * Query Type
   */
  describe('Type', () => {
    const getComponent = () => screen.getByRole('combobox', { name: 'Type' });

    it('Should set value from query to CLI', () => {
      const query = getQuery({ type: QueryTypeValue.CLI });
      renderEditor(query);
      const testedComponent = getComponent();
      expect(selectedOptionLabel(testedComponent)).toEqual(QueryTypeCli.label);

      openMenu(testedComponent);
      expect(screen.queryByRole('option', { name: byOptionLabel(QueryTypeCli) })).toBeInTheDocument();
    });

    it('CLI should not be seen if disabled', () => {
      dataSourceInstanceSettingsMock.jsonData.cliDisabled = true;
      const query = getQuery({ type: QueryTypeValue.REDIS });
      renderEditor(query);
      const testedComponent = getComponent();
      expect(selectedOptionLabel(testedComponent)).toEqual(QueryType[0].label);

      openMenu(testedComponent);
      expect(screen.queryByRole('option', { name: byOptionLabel(QueryTypeCli) })).not.toBeInTheDocument();
    });

    it('Should call onTypeChange when onChange prop was called', () => {
      const query = getQuery({ type: QueryTypeValue.CLI });
      renderEditor(query);
      selectOption(getComponent(), QueryType[0]);
      expect(onChange).toHaveBeenCalledWith({
        ...query,
        type: QueryTypeValue.REDIS,
        query: '',
        command: '',
      });
    });
  });

  /**
   * Streaming
   */
  describe('Streaming', () => {
    const getComponent = () => screen.getByLabelText<HTMLInputElement>('Streaming');

    it('Should set value from query', () => {
      renderEditor(getQuery({ streaming: true }));
      expect(getComponent().checked).toEqual(true);
    });

    it('Should call onStreamingChange when onChange prop was called', () => {
      const query = getQuery({ streaming: false });
      renderEditor(query);
      fireEvent.click(getComponent());
      expect(onChange).toHaveBeenCalledWith({
        ...query,
        streaming: true,
      });
    });
  });

  runQueryFieldsTest([
    {
      name: 'query',
      queryElement: textArea('Command'),
      type: 'string',
      queryWhenShown: { refId: '', type: QueryTypeValue.CLI },
      queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS },
    },
    {
      name: 'command',
      queryElement: select('Command'),
      type: 'select',
      options: Commands[QueryTypeValue.REDIS],
      queryWhenShown: { refId: '', type: QueryTypeValue.REDIS },
      queryWhenHidden: { refId: '', type: QueryTypeValue.CLI },
    },
  ]);

  /**
   * Command properties
   */
  describe('Command fields', () => {
    runQueryFieldsTest([
      {
        name: 'keyName',
        queryElement: field('Key'),
        type: 'string',
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: Redis.GET },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'keyName',
        testName: 'Function',
        queryElement: field('Function'),
        type: 'string',
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: RedisGears.PYEXECUTE },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'filter',
        queryElement: field('Label Filter'),
        type: 'string',
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: RedisTimeSeries.MRANGE },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'field',
        queryElement: field('Field'),
        type: 'string',
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: Redis.HGET },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'legend',
        testName: 'Legend',
        queryElement: field('Legend'),
        type: 'string',
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: RedisTimeSeries.RANGE },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'legend',
        testName: 'Legend Label',
        queryElement: field('Legend Label'),
        type: 'string',
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: RedisTimeSeries.MRANGE },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'value',
        queryElement: field('Value Label'),
        type: 'string',
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: RedisTimeSeries.MRANGE },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'cypher',
        queryElement: textArea('Cypher'),
        type: 'string',
        queryWhenShown: { refId: '', type: QueryTypeValue.GRAPH, command: RedisGraph.QUERY },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'offset',
        queryElement: field('Offset'),
        type: 'number',
        queryWhenShown: { refId: '', type: QueryTypeValue.SEARCH, command: RediSearch.SEARCH },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'searchQuery',
        queryElement: textArea('Query'),
        type: 'string',
        queryWhenShown: { refId: '', type: QueryTypeValue.SEARCH, command: RediSearch.SEARCH },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'path',
        queryElement: textArea('Path'),
        type: 'string',
        queryWhenShown: { refId: '', type: QueryTypeValue.JSON, command: RedisJson.GET },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'size',
        queryElement: field('Size'),
        type: 'number',
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: Redis.SLOWLOG_GET },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'cursor',
        queryElement: field('Cursor'),
        type: 'string',
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: Redis.TMSCAN },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'match',
        queryElement: field('Match pattern'),
        type: 'string',
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: Redis.TMSCAN },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'start',
        queryElement: field('Start'),
        type: 'string',
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: Redis.XRANGE },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'end',
        queryElement: field('End'),
        type: 'string',
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: Redis.XRANGE },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'min',
        queryElement: field('Minimum'),
        type: 'string',
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: Redis.ZRANGE },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'max',
        queryElement: field('Maximum'),
        type: 'string',
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: Redis.ZRANGE },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'count',
        queryElement: field('Count'),
        type: 'number',
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: Redis.TMSCAN },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'samples',
        queryElement: field('Samples'),
        type: 'number',
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: Redis.TMSCAN },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'section',
        queryElement: select('Section'),
        type: 'select',
        options: InfoSections,
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.GET },
      },
      {
        name: 'aggregation',
        queryElement: select('Aggregation'),
        type: 'select',
        options: Aggregations,
        queryWhenShown: { refId: '', type: QueryTypeValue.TIMESERIES, command: RedisTimeSeries.RANGE },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'tsGroupByLabel',
        queryElement: field('Group By'),
        type: 'string',
        queryWhenShown: { refId: '', type: QueryTypeValue.TIMESERIES, command: RedisTimeSeries.MRANGE },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'zrangeQuery',
        queryElement: select('Range Query'),
        type: 'select',
        options: ZRangeQuery,
        queryWhenShown: { refId: '', type: QueryTypeValue.REDIS, command: Redis.ZRANGE },
        queryWhenHidden: { refId: '', type: QueryTypeValue.REDIS, command: Redis.INFO },
      },
      {
        name: 'bucket',
        queryElement: field('Time Bucket'),
        type: 'number',
        queryWhenShown: {
          refId: '',
          type: QueryTypeValue.TIMESERIES,
          command: RedisTimeSeries.RANGE,
          aggregation: AggregationValue.AVG,
        },
        queryWhenHidden: {
          refId: '',
          type: QueryTypeValue.TIMESERIES,
          command: RedisTimeSeries.RANGE,
          aggregation: undefined,
        },
      },
      {
        name: 'fill',
        queryElement: field('Fill Missing'),
        type: 'switch',
        queryWhenShown: {
          refId: '',
          type: QueryTypeValue.TIMESERIES,
          command: RedisTimeSeries.RANGE,
          aggregation: AggregationValue.AVG,
          bucket: 123,
          fill: false,
        },
        queryWhenHidden: {
          refId: '',
          type: QueryTypeValue.TIMESERIES,
          command: RedisTimeSeries.RANGE,
          aggregation: AggregationValue.AVG,
          bucket: 0,
        },
      },
    ]);
  });

  /**
   * Streaming options
   */
  describe('Streaming fields', () => {
    runQueryFieldsTest([
      {
        name: 'streamingInterval',
        queryElement: field('Interval'),
        type: 'number',
        queryWhenShown: {
          refId: 'A',
          type: QueryTypeValue.TIMESERIES,
          streaming: true,
        },
        queryWhenHidden: {
          refId: 'A',
          type: QueryTypeValue.TIMESERIES,
          streaming: false,
        },
      },
      {
        name: 'streamingCapacity',
        queryElement: field('Capacity'),
        type: 'number',
        queryWhenShown: {
          refId: 'A',
          type: QueryTypeValue.TIMESERIES,
          streaming: true,
        },
        queryWhenHidden: {
          refId: 'A',
          type: QueryTypeValue.TIMESERIES,
          streaming: false,
        },
      },
      {
        name: 'streamingDataType',
        queryElement: radioGroup('Data type'),
        type: 'radioButton',
        options: StreamingDataTypes,
        queryWhenShown: {
          refId: 'A',
          type: QueryTypeValue.TIMESERIES,
          streaming: true,
        },
        queryWhenHidden: {
          refId: 'A',
          type: QueryTypeValue.TIMESERIES,
          streaming: false,
        },
      },
    ]);
  });
});
