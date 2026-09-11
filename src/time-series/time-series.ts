// Modified in 2026 by Axiumine, from the original in
// RedisGrafana/grafana-redis-datasource at 09df07a. See NOTICE and CHANGELOG.md.

import { CircularDataFrame, DataFrame, Field, FieldType } from '@grafana/data';
import { DefaultStreamingCapacity } from '../constants';
import { RedisQuery } from '../redis';

/**
 * Name of the time field added to streamed frames
 */
export const TimeFieldName = 'time';

/**
 * Time Series Streaming
 */
export class TimeSeriesStreaming {
  /**
   * Frame with all values
   */
  frame: CircularDataFrame;

  /**
   * Constructor
   *
   * @param ref
   */
  constructor(ref: RedisQuery) {
    /**
     * This dataframe can have values constantly added, and will never exceed the given capacity
     */
    this.frame = new CircularDataFrame({
      append: 'tail',
      capacity: ref?.streamingCapacity || DefaultStreamingCapacity,
    });

    /**
     * Set refId
     */
    this.frame.refId = ref?.refId;
  }

  /**
   * Add new values for the frame
   *
   * @param {any} fields Fields of the frame the reply produced
   * @returns {Promise<DataFrame>} A detached snapshot of the updated circular frame
   */
  async update(fields: any): Promise<DataFrame> {
    let values: { [index: string]: number } = {};

    /**
     * A frame without a time field cannot be plotted as a time series, and
     * commands like INFO never return one, so the arrival time is added here.
     * Replies that already carry a time field keep their own.
     */
    const hasOwnTime = fields.some((field: Field) => field.type === FieldType.time);
    if (!hasOwnTime) {
      if (!this.frame.fields.some((addedField) => addedField.name === TimeFieldName)) {
        this.frame.addField({ name: TimeFieldName, type: FieldType.time });
      }

      values[TimeFieldName] = Date.now();
    }

    /**
     * Add fields to frame fields and return values
     */
    fields.forEach((field: Field) => {
      /**
       * Add new fields if frame does not have the field
       */
      const fieldValues = field.values.toArray();
      const value = fieldValues[fieldValues.length - 1];

      if (!this.frame.fields.some((addedField) => addedField.name === field.name)) {
        this.frame.addField({
          name: field.name,
          type: field.type === FieldType.string && !isNaN(value) ? FieldType.number : field.type,
        });
      }

      /**
       * Set values. If values.length > 1, should be set the last line
       */
      values[field.name] = value;
    });

    /**
     * Add values and return
     */
    this.frame.add(values);
    return Promise.resolve(this.snapshot());
  }

  /**
   * Copy the buffer into an ordinary frame backed by ordinary arrays
   *
   * Grafana 13 releases the buffers of frames it has stopped rendering by
   * assigning `values.length = 0`. It exempts streaming frames, which it
   * recognises by the `appendRow` method a CircularDataFrame carries, but a
   * panel transformation rebuilds the frame as a plain object and that
   * recognition is lost while the fields still point at the same buffers. The
   * buffers are CircularVector proxies whose `length` is read-only, so the
   * assignment throws and the exception escapes into React, taking the whole
   * dashboard down with it. Handing out a copy keeps the proxies private to
   * this class, so nothing outside it can be asked to release them.
   *
   * @returns {DataFrame} A frame whose fields own plain arrays
   */
  private snapshot(): DataFrame {
    return {
      name: this.frame.name,
      refId: this.frame.refId,
      meta: this.frame.meta,
      fields: this.frame.fields.map((field) => ({
        ...field,
        values: Array.from<any>(field.values as any),
      })),
      length: this.frame.length,
    };
  }
}
