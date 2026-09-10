// Modified in 2026 by Axiumine, from the original in
// RedisGrafana/grafana-redis-datasource at 09df07a. See NOTICE and CHANGELOG.md.

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { DataSourceSettings } from '@grafana/data';
import { ClientType, ClientTypeValue } from '../../constants';
import { RedisDataSourceOptions } from '../../types';
import { ConfigEditor } from './ConfigEditor';

/**
 * Override Options
 */
interface OverrideOptions {
  [key: string]: unknown;
  jsonData?: object;
  secureJsonData?: object | null;
}

/**
 * Configuration Options
 */
const getOptions = ({
  jsonData = {},
  secureJsonData = {},
  ...overrideOptions
}: OverrideOptions = {}): DataSourceSettings<RedisDataSourceOptions, any> => ({
  id: 1,
  orgId: 2,
  name: '',
  typeName: '',
  typeLogoUrl: '',
  type: '',
  access: '',
  url: '',
  uid: '',
  user: '',
  database: '',
  basicAuth: false,
  basicAuthUser: '',
  isDefault: false,
  secureJsonFields: {},
  readOnly: false,
  withCredentials: false,
  ...overrideOptions,
  jsonData: {
    poolSize: 0,
    timeout: 0,
    pingInterval: 0,
    pipelineWindow: 0,
    tlsAuth: false,
    tlsSkipVerify: false,
    client: ClientTypeValue.CLUSTER,
    sentinelName: '',
    sentinelAcl: false,
    sentinelUser: '',
    acl: false,
    cliDisabled: false,
    user: '',
    ...jsonData,
  },
  secureJsonData: {
    password: '',
    sentinelPassword: '',
    tlsClientCert: '',
    tlsClientKey: '',
    tlsCACert: '',
    ...secureJsonData,
  },
});

/**
 * Render the editor under test
 */
const renderEditor = (options: DataSourceSettings<RedisDataSourceOptions, any>, onOptionsChange: jest.Mock): void => {
  render(<ConfigEditor options={options} onOptionsChange={onOptionsChange} />);
};

/**
 * Query a `FormField` or a legacy `Switch` by its label.
 *
 * Both associate the label with the input, so the accessible-name query finds them.
 */
const queryField = (label: string) => screen.queryByLabelText<HTMLInputElement>(label);
const getField = (label: string) => screen.getByLabelText<HTMLInputElement>(label);

/**
 * Query a `SecretFormField` by its placeholder.
 *
 * `SecretFormField` hands its input to `FormField` as `inputEl`, and `FormField` renders
 * `inputEl || <input id={id}>`. The input carrying the generated id is therefore never
 * rendered and the label's `htmlFor` dangles, so the label query cannot reach these two
 * fields. The placeholder is the only stable handle the component exposes.
 */
const querySecretField = (placeholder: string) => screen.queryByPlaceholderText<HTMLInputElement>(placeholder);
const getSecretField = (placeholder: string) => screen.getByPlaceholderText<HTMLInputElement>(placeholder);

/**
 * The Reset button a `SecretFormField` renders once the value is configured, scoped to the
 * field carrying the given label so a second configured field cannot match instead.
 */
const getSecretResetButton = (label: string) =>
  within(screen.getByText(label).closest('.gf-form') as HTMLElement).getByRole('button', { name: 'Reset' });

/**
 * A TLS certificate block, located by its heading. Returns null while the block is hidden.
 */
const queryTlsSection = (heading: string): HTMLElement | null => {
  const label = screen.queryByText(heading);
  return label ? (label.closest('.gf-form-inline') as HTMLElement) : null;
};

/**
 * The textarea inside a TLS block, or null when the block is hidden or shows Reset instead.
 */
const queryTlsTextArea = (heading: string, placeholder: string) => {
  const section = queryTlsSection(heading);
  return section ? within(section).queryByPlaceholderText<HTMLTextAreaElement>(placeholder) : null;
};

/**
 * The radio button of the client type carrying the given value.
 */
const getClientTypeRadio = (value: ClientTypeValue) =>
  screen.getByRole<HTMLInputElement>('radio', {
    name: ClientType.find((option) => option.value === value)!.label,
  });

/**
 * Config Editor
 */
describe('ConfigEditor', () => {
  /**
   * Client Type
   */
  describe('Type', () => {
    it('Should pass client value to type field', () => {
      const options = getOptions();
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getClientTypeRadio(options.jsonData.client)).toBeChecked();
    });

    it('Should pass standalone as a value if client value is empty', () => {
      const options = getOptions({ jsonData: { client: null } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getClientTypeRadio(ClientTypeValue.STANDALONE)).toBeChecked();
    });

    it('Should call onOptionsChange function when value was changed', () => {
      const options = getOptions();
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const newClient = ClientTypeValue.STANDALONE;
      fireEvent.click(getClientTypeRadio(newClient));
      expect(onOptionsChange).toHaveBeenCalledWith(
        getOptions({
          jsonData: {
            client: newClient,
          },
        })
      );
    });
  });

  /**
   * Sentinel Master group name
   */
  describe('MasterName', () => {
    const getTestedComponent = () => queryField('Master Name');

    it('If client is not sentinel should not be shown', () => {
      const options = getOptions();
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()).not.toBeInTheDocument();
    });

    it('If client is sentinel should be shown Master Name field', () => {
      const options = getOptions({ jsonData: { client: ClientTypeValue.SENTINEL } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const testedComponent = getTestedComponent();
      expect(testedComponent).toBeInTheDocument();
      expect(testedComponent!.value).toEqual(options.jsonData.sentinelName);
    });

    it('Should call onOptionsChange function when value was changed', () => {
      const options = getOptions({ jsonData: { client: ClientTypeValue.SENTINEL } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const newValue = '123';
      fireEvent.change(getTestedComponent()!, { target: { value: newValue } });
      expect(onOptionsChange).toHaveBeenCalledWith(
        getOptions({
          ...options,
          jsonData: {
            ...options.jsonData,
            sentinelName: newValue,
          },
        })
      );
    });
  });

  /**
   * Address (URL)
   */
  describe('Address', () => {
    const getTestedComponent = () => getField('Address');

    it('Should pass url value to address field', () => {
      const options = getOptions({ url: 'localhost' });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent().value).toEqual(options.url);
    });

    it('Should call onOptionsChange when value was changed', () => {
      const options = getOptions({ url: 'localhost' });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const newUrl = 'redis';
      fireEvent.change(getTestedComponent(), { target: { value: newUrl } });
      expect(onOptionsChange).toHaveBeenCalledWith({ ...options, url: newUrl });
    });
  });

  /**
   * ACL
   */
  describe('ACL', () => {
    const getTestedComponent = () => getField('ACL');

    it('Should pass acl value', () => {
      const options = getOptions({ jsonData: { acl: true } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent().checked).toEqual(options.jsonData.acl);
    });

    it('Should pass default value if user value is empty', () => {
      const options = getOptions({ jsonData: { acl: null } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent().checked).toEqual(false);
    });

    it('Should call onOptionsChange when value was changed', () => {
      const options = getOptions({ jsonData: { acl: true } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const newValue = false;
      fireEvent.click(getTestedComponent());
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        jsonData: {
          ...options.jsonData,
          acl: newValue,
        },
      });
    });
  });

  /**
   * Disable CLI
   */
  describe('CLI', () => {
    const getTestedComponent = () => getField('Disable CLI');

    it('Should pass cliDisabled value', () => {
      const options = getOptions({ jsonData: { cliDisable: true } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent().checked).toEqual(options.jsonData.cliDisabled);
    });

    it('Should pass default value if user value is empty', () => {
      const options = getOptions({ jsonData: { cliDisabled: null } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent().checked).toEqual(false);
    });

    it('Should call onOptionsChange when value was changed', () => {
      const options = getOptions({ jsonData: { cliDisabled: true } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const newValue = false;
      fireEvent.click(getTestedComponent());
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        jsonData: {
          ...options.jsonData,
          cliDisabled: newValue,
        },
      });
    });
  });

  /**
   * Sentinel ACL
   */
  describe('Sentinel ACL', () => {
    const getTestedComponent = () => queryField('Sentinel ACL');

    it('If client is not sentinel should not be shown', () => {
      const options = getOptions();
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()).not.toBeInTheDocument();
    });

    it('If client is sentinel should pass acl value', () => {
      const options = getOptions({ jsonData: { client: ClientTypeValue.SENTINEL, sentinelAcl: true } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const testedComponent = getTestedComponent();
      expect(testedComponent).toBeInTheDocument();
      expect(testedComponent!.checked).toEqual(options.jsonData.sentinelAcl);
    });

    it('If client is sentinel should pass default value if user value is empty', () => {
      const options = getOptions({ jsonData: { client: ClientTypeValue.SENTINEL, sentinelAcl: null } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()!.checked).toEqual(false);
    });

    it('If client is sentinel Should call onOptionsChange when value was changed', () => {
      const options = getOptions({ jsonData: { client: ClientTypeValue.SENTINEL, sentinelAcl: true } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const newValue = false;
      fireEvent.click(getTestedComponent()!);
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        jsonData: {
          ...options.jsonData,
          sentinelAcl: newValue,
        },
      });
    });
  });

  /**
   * Sentinel Username for Authentication when ACL enabled
   */
  describe('Sentinel Username', () => {
    const getTestedComponent = () => queryField('Sentinel Username');

    it('If client is not sentinel should not be shown', () => {
      const options = getOptions();
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()).not.toBeInTheDocument();
    });

    it('If client is sentinel and acl checked should be shown', () => {
      const options = getOptions({
        jsonData: { client: ClientTypeValue.SENTINEL, sentinelAcl: true, sentinelUser: 'My user' },
      });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const testedComponent = getTestedComponent();
      expect(testedComponent).toBeInTheDocument();
      expect(testedComponent!.value).toEqual(options.jsonData.sentinelUser);
    });

    it('If client is sentinel and acl not checked should not be shown', () => {
      const options = getOptions({ jsonData: { client: ClientTypeValue.SENTINEL, sentinelAcl: false } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()).not.toBeInTheDocument();
    });

    it('If client is sentinel should call onOptionsChange when value was changed', () => {
      const options = getOptions({
        jsonData: { client: ClientTypeValue.SENTINEL, sentinelAcl: true, sentinelUser: 'admin' },
      });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const newValue = 'guest';
      fireEvent.change(getTestedComponent()!, { target: { value: newValue } });
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        jsonData: {
          ...options.jsonData,
          sentinelUser: newValue,
        },
      });
    });
  });

  /**
   * Sentinel Password
   */
  describe('Sentinel Password', () => {
    const getTestedComponent = () => querySecretField('Sentinel password');

    it('If client is not sentinel should not be shown', () => {
      const options = getOptions();
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()).not.toBeInTheDocument();
    });

    it('If client is sentinel should pass password value', () => {
      const options = getOptions({
        jsonData: { client: ClientTypeValue.SENTINEL },
        secureJsonData: { sentinelPassword: '123' },
      });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()!.value).toEqual(options.secureJsonData?.sentinelPassword);
    });

    it('If client is sentinel should call onSentinelResetPassword method when calls onReset prop', () => {
      const options = getOptions({
        jsonData: { client: ClientTypeValue.SENTINEL },
        secureJsonFields: { sentinelPassword: true },
      });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);

      fireEvent.click(getSecretResetButton('Sentinel Password'));
      expect(onOptionsChange).toHaveBeenCalledTimes(1);
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        secureJsonData: {
          ...options.secureJsonData,
          sentinelPassword: '',
        },
        secureJsonFields: {
          ...options.secureJsonFields,
          sentinelPassword: false,
        },
      });
    });

    it('If client is sentinel should call onSentinelPasswordChange method when calls onChange prop', () => {
      const options = getOptions({ jsonData: { client: ClientTypeValue.SENTINEL } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);

      const newValue = '123';
      fireEvent.change(getTestedComponent()!, { target: { value: newValue } });
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        secureJsonData: {
          ...options.secureJsonData,
          sentinelPassword: newValue,
        },
      });
    });
  });

  /**
   * Username for Authentication when ACL enabled
   */
  describe('Username', () => {
    const getTestedComponent = () => queryField('Username');

    it('If acl checked should be shown', () => {
      const options = getOptions({ jsonData: { acl: true, user: 'My user' } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const testedComponent = getTestedComponent();
      expect(testedComponent).toBeInTheDocument();
      expect(testedComponent!.value).toEqual(options.jsonData.user);
    });

    it('If acl not checked should not be shown', () => {
      const options = getOptions({ jsonData: { acl: false } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()).not.toBeInTheDocument();
    });

    it('Should call onOptionsChange when value was changed', () => {
      const options = getOptions({ jsonData: { acl: true, user: 'admin' } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const newValue = 'guest';
      fireEvent.change(getTestedComponent()!, { target: { value: newValue } });
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        jsonData: {
          ...options.jsonData,
          user: newValue,
        },
      });
    });
  });

  /**
   * Password
   */
  describe('Password', () => {
    const getTestedComponent = () => getSecretField('Database password');

    it('Should pass password value', () => {
      const options = getOptions({ secureJsonData: { password: '123' } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent().value).toEqual(options.secureJsonData?.password);
    });

    it('Should call onResetPassword method when calls onReset prop', () => {
      const options = getOptions({ secureJsonFields: { password: true } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);

      fireEvent.click(getSecretResetButton('Password'));
      expect(onOptionsChange).toHaveBeenCalledTimes(1);
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        secureJsonData: {
          ...options.secureJsonData,
          password: '',
        },
        secureJsonFields: {
          ...options.secureJsonFields,
          password: false,
        },
      });
    });

    it('Should call onPasswordChange method when calls onChange prop', () => {
      const options = getOptions();
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);

      const newValue = '123';
      fireEvent.change(getTestedComponent(), { target: { value: newValue } });
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        secureJsonData: {
          ...options.secureJsonData,
          password: newValue,
        },
      });
    });
  });

  /**
   * Pool size
   */
  describe('PoolSize', () => {
    const getTestedComponent = () => getField('Pool Size');

    it('Should pass value from options', () => {
      const options = getOptions({ jsonData: { poolSize: 10 } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent().value).toEqual(String(options.jsonData.poolSize));
    });

    it('Should call onPoolSizeChange method when calls onChange prop', () => {
      const options = getOptions();
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const newValue = 15;
      fireEvent.change(getTestedComponent(), { target: { value: newValue } });
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        jsonData: {
          ...options.jsonData,
          poolSize: newValue,
        },
      });
    });
  });

  /**
   * Timeout
   */
  describe('Timeout', () => {
    const getTestedComponent = () => getField('Timeout, sec');

    it('Should pass value from options', () => {
      const options = getOptions({ jsonData: { timeout: 10 } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent().value).toEqual(String(options.jsonData.timeout));
    });

    it('Should call onTimeoutChange method when calls onChange prop', () => {
      const options = getOptions();
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const newValue = '15';
      fireEvent.change(getTestedComponent(), { target: { value: newValue } });
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        jsonData: {
          ...options.jsonData,
          timeout: parseInt(newValue, 10),
        },
      });
    });
  });

  /**
   * Ping interval
   */
  describe('PingInterval', () => {
    const getTestedComponent = () => getField('Ping Interval, sec');

    it('Should pass value from options', () => {
      const options = getOptions({ jsonData: { pingInterval: 10 } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent().value).toEqual(String(options.jsonData.pingInterval));
    });

    it('Should call onPingIntervalChange method when calls onChange prop', () => {
      const options = getOptions();
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const newValue = '15';
      fireEvent.change(getTestedComponent(), { target: { value: newValue } });
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        jsonData: {
          ...options.jsonData,
          pingInterval: parseInt(newValue, 10),
        },
      });
    });
  });

  /**
   * Pipeline Window
   */
  describe('PipelineWindow', () => {
    const getTestedComponent = () => getField('Pipeline Window, μs');

    it('Should pass value from options', () => {
      const options = getOptions({ jsonData: { pipelineWindow: 10 } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent().value).toEqual(String(options.jsonData.pipelineWindow));
    });

    it('Should call onPipelineWindowChange method when calls onChange prop', () => {
      const options = getOptions();
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const newValue = '15';
      fireEvent.change(getTestedComponent(), { target: { value: newValue } });
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        jsonData: {
          ...options.jsonData,
          pipelineWindow: parseInt(newValue, 10),
        },
      });
    });
  });

  /**
   * Client Authentication
   */
  describe('ClientAuthentication', () => {
    const getTestedComponent = () => getField('Client Authentication');

    it('Should pass value from options', () => {
      const options = getOptions({ jsonData: { tlsAuth: true } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent().checked).toEqual(options.jsonData.tlsAuth);
    });

    it('Should pass default value if tlsAuth value is empty', () => {
      const options = getOptions({ jsonData: { tlsAuth: '' } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent().checked).toEqual(false);
    });

    it('Should call onChangeOptions', () => {
      const options = getOptions();
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const newValue = true;
      fireEvent.click(getTestedComponent());
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        jsonData: {
          ...options.jsonData,
          tlsAuth: newValue,
        },
      });
    });
  });

  /**
   * Skip Verify
   */
  describe('SkipVerify', () => {
    const getTestedComponent = () => queryField('Skip Verify');

    it('Should be shown if tlsAuth=true', () => {
      const options = getOptions({ jsonData: { tlsAuth: true } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()).toBeInTheDocument();
    });

    it('Should not be shown if tlsAuth=false', () => {
      const options = getOptions({ jsonData: { tlsAuth: false } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()).not.toBeInTheDocument();
    });

    it('Should pass value from options', () => {
      const options = getOptions({ jsonData: { tlsAuth: true, tlsSkipVerify: false } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()!.checked).toEqual(options.jsonData.tlsSkipVerify);
    });

    it('Should pass default value if tlsSkipVerify value is empty', () => {
      const options = getOptions({ jsonData: { tlsAuth: true, tlsSkipVerify: '' } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()!.checked).toEqual(false);
    });

    it('Should call onChangeOptions', () => {
      const options = getOptions({ jsonData: { tlsAuth: true } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const newValue = true;
      fireEvent.click(getTestedComponent()!);
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        jsonData: {
          ...options.jsonData,
          tlsSkipVerify: newValue,
        },
      });
    });
  });

  /**
   * Client Certificate
   */
  describe('ClientCertificate', () => {
    const getTestedComponent = () => queryTlsTextArea('Client Certificate', 'Begins with -----BEGIN CERTIFICATE-----');

    it('Should be shown if tlsAuth=true and tlsClientCert=false', () => {
      const options = getOptions({ jsonData: { tlsAuth: true }, secureJsonFields: { tlsClientCert: false } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()).toBeInTheDocument();
    });

    it('Should not be shown if tlsAuth=false', () => {
      const options = getOptions({ jsonData: { tlsAuth: false } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()).not.toBeInTheDocument();
    });

    it('Should not be shown if tlsClientCert=true', () => {
      const options = getOptions({ jsonData: { tlsAuth: true }, secureJsonFields: { tlsClientCert: true } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()).not.toBeInTheDocument();
    });

    it('Should call onTlsClientCertificateChange when onChange prop was called', () => {
      const options = getOptions({ jsonData: { tlsAuth: true }, secureJsonFields: { tlsClientCert: false } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const newValue = '123';
      fireEvent.change(getTestedComponent()!, { target: { value: newValue } });
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        secureJsonData: {
          ...options.secureJsonData,
          tlsClientCert: newValue,
        },
      });
    });

    it('Should call onResetTlsClientCertificate when reset button was clicked', () => {
      const options = getOptions({ jsonData: { tlsAuth: true }, secureJsonFields: { tlsClientCert: true } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const testedComponent = within(queryTlsSection('Client Certificate')!).getByRole('button', { name: 'Reset' });
      expect(testedComponent).toBeInTheDocument();
      fireEvent.click(testedComponent);
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        secureJsonFields: {
          ...options.secureJsonFields,
          tlsClientCert: false,
        },
        secureJsonData: {
          ...options.secureJsonData,
          tlsClientCert: '',
        },
      });
    });
  });

  /**
   * Client's Key
   */
  describe('ClientKey', () => {
    const getTestedComponent = () => queryTlsTextArea('Client Key', 'Begins with -----BEGIN PRIVATE KEY-----');

    it('Should be shown if tlsAuth=true and tlsClientKey=false', () => {
      const options = getOptions({ jsonData: { tlsAuth: true }, secureJsonFields: { tlsClientKey: false } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()).toBeInTheDocument();
    });

    it('Should not be shown if tlsAuth=false', () => {
      const options = getOptions({ jsonData: { tlsAuth: false } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()).not.toBeInTheDocument();
    });

    it('Should not be shown if tlsClientKey=true', () => {
      const options = getOptions({ jsonData: { tlsAuth: true }, secureJsonFields: { tlsClientKey: true } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()).not.toBeInTheDocument();
    });

    it('Should call onTlsClientKeyChange when onChange prop was called', () => {
      const options = getOptions({ jsonData: { tlsAuth: true }, secureJsonFields: { tlsClientKey: false } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const newValue = '123';
      fireEvent.change(getTestedComponent()!, { target: { value: newValue } });
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        secureJsonData: {
          ...options.secureJsonData,
          tlsClientKey: newValue,
        },
      });
    });

    it('Should call onResetTlsClientKey when reset button was clicked', () => {
      const options = getOptions({ jsonData: { tlsAuth: true }, secureJsonFields: { tlsClientKey: true } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const testedComponent = within(queryTlsSection('Client Key')!).getByRole('button', { name: 'Reset' });
      expect(testedComponent).toBeInTheDocument();
      fireEvent.click(testedComponent);
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        secureJsonFields: {
          ...options.secureJsonFields,
          tlsClientKey: false,
        },
        secureJsonData: {
          ...options.secureJsonData,
          tlsClientKey: '',
        },
      });
    });
  });

  /**
   * Certification Authority
   */
  describe('CertificationAuthority', () => {
    const getTestedComponent = () =>
      queryTlsTextArea('Certification Authority', 'Begins with -----BEGIN CERTIFICATE-----');

    it('Should be shown if tlsAuth=true and tlsCACert=false', () => {
      const options = getOptions({ jsonData: { tlsAuth: true }, secureJsonFields: { tlsCACert: false } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()).toBeInTheDocument();
    });

    it('Should not be shown if tlsAuth=false', () => {
      const options = getOptions({ jsonData: { tlsAuth: false } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()).not.toBeInTheDocument();
    });

    it('Should not be shown if tlsClientKey=true', () => {
      const options = getOptions({ jsonData: { tlsAuth: true }, secureJsonFields: { tlsCACert: true } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      expect(getTestedComponent()).not.toBeInTheDocument();
    });

    it('Should call onTlsCACertificateChange when onChange prop was called', () => {
      const options = getOptions({ jsonData: { tlsAuth: true }, secureJsonFields: { tlsCACert: false } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const newValue = '123';
      fireEvent.change(getTestedComponent()!, { target: { value: newValue } });
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        secureJsonData: {
          ...options.secureJsonData,
          tlsCACert: newValue,
        },
      });
    });

    it('Should call onResetTlsCACertificate when reset button was clicked', () => {
      const options = getOptions({ jsonData: { tlsAuth: true }, secureJsonFields: { tlsCACert: true } });
      const onOptionsChange = jest.fn();
      renderEditor(options, onOptionsChange);
      const testedComponent = within(queryTlsSection('Certification Authority')!).getByRole('button', {
        name: 'Reset',
      });
      expect(testedComponent).toBeInTheDocument();
      fireEvent.click(testedComponent);
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...options,
        secureJsonFields: {
          ...options.secureJsonFields,
          tlsCACert: false,
        },
        secureJsonData: {
          ...options.secureJsonData,
          tlsCACert: '',
        },
      });
    });
  });
});
