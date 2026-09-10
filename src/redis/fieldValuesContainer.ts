// Modified in 2026 by Axiumine, from the original in
// RedisGrafana/grafana-redis-datasource at 09df07a. See NOTICE and CHANGELOG.md.

/**
 * Default values handed to the `Form` wrapper around react-hook-form.
 *
 * This has to stay structurally identical to react-hook-form's own `FieldValues`,
 * which is `Record<string, any>`. `Control<T>` is invariant in `T`, and `@grafana/ui`
 * declares `FieldArray` non-generically as `FieldArrayProps extends UseFieldArrayProps`,
 * so its `control` prop is `Control<FieldValues>`. Naming a narrower shape here makes
 * `Form` infer that narrower `T` and the `control` it yields no longer assignable.
 */
export type FieldValuesContainer = Record<string, any>;
