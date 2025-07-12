import React, { useEffect, useState } from 'react';
import API from '../api';
import useSettingsStore from '../store/settings';
import useUserAgentsStore from '../store/userAgents';
import useStreamProfilesStore from '../store/streamProfiles';
import {
  Accordion,
  Alert,
  Box,
  Button,
  Center,
  Flex,
  Group,
  MultiSelect,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  NumberInput,
} from '@mantine/core';
import { isNotEmpty, useForm } from '@mantine/form';
import UserAgentsTable from '../components/tables/UserAgentsTable';
import StreamProfilesTable from '../components/tables/StreamProfilesTable';
import useLocalStorage from '../hooks/useLocalStorage';
import useAuthStore from '../store/auth';
import {
  USER_LEVELS,
  NETWORK_ACCESS_OPTIONS,
  PROXY_SETTINGS_OPTIONS,
  REGION_CHOICES,
} from '../constants';
import ConfirmationDialog from '../components/ConfirmationDialog';

const SettingsPage = () => {
  const settings = useSettingsStore((s) => s.settings);
  const userAgents = useUserAgentsStore((s) => s.userAgents);
  const streamProfiles = useStreamProfilesStore((s) => s.profiles);
  const authUser = useAuthStore((s) => s.user);

  const [accordianValue, setAccordianValue] = useState(null);
  const [networkAccessSaved, setNetworkAccessSaved] = useState(false);
  const [networkAccessError, setNetworkAccessError] = useState(null);
  const [networkAccessConfirmOpen, setNetworkAccessConfirmOpen] =
    useState(false);
  const [netNetworkAccessConfirmCIDRs, setNetNetworkAccessConfirmCIDRs] =
    useState([]);

  const [proxySettingsSaved, setProxySettingsSaved] = useState(false);

  // UI / local storage settings
  const [tableSize, setTableSize] = useLocalStorage('table-size', 'default');

  const regionChoices = REGION_CHOICES;

  const form = useForm({
    mode: 'controlled',
    initialValues: {
      'default-user-agent': '',
      'default-stream-profile': '',
      'preferred-region': '',
      'auto-import-mapped-files': true,
      'm3u-hash-key': [],
    },

    validate: {
      'default-user-agent': isNotEmpty('Select a user agent'),
      'default-stream-profile': isNotEmpty('Select a stream profile'),
      'preferred-region': isNotEmpty('Select a region'),
    },
  });

  const networkAccessForm = useForm({
    mode: 'controlled',
    initialValues: Object.keys(NETWORK_ACCESS_OPTIONS).reduce((acc, key) => {
      acc[key] = '0.0.0.0/0';
      return acc;
    }, {}),
    validate: Object.keys(NETWORK_ACCESS_OPTIONS).reduce((acc, key) => {
      acc[key] = (value) => {
        const cidrs = value.split(',');
        for (const cidr of cidrs) {
          if (cidr.match(/^([0-9]{1,3}\.){3}[0-9]{1,3}\/\d+$/)) {
            continue;
          }

          return 'Invalid CIDR range';
        }

        return null;
      };
      return acc;
    }, {}),
  });

  const proxySettingsForm = useForm({
    mode: 'controlled',
    initialValues: Object.keys(PROXY_SETTINGS_OPTIONS).reduce((acc, key) => {
      acc[key] = '';
      return acc;
    }, {}),
  });

  useEffect(() => {
    if (settings) {
      const formValues = Object.entries(settings).reduce(
        (acc, [key, value]) => {
          // Modify each value based on its own properties
          switch (value.value) {
            case 'true':
              value.value = true;
              break;
            case 'false':
              value.value = false;
              break;
          }

          let val = null;
          switch (key) {
            case 'm3u-hash-key':
              val = value.value.split(',');
              break;
            default:
              val = value.value;
              break;
          }

          acc[key] = val;
          return acc;
        },
        {}
      );

      form.setValues(formValues);

      const networkAccessSettings = JSON.parse(
        settings['network-access'].value || '{}'
      );
      networkAccessForm.setValues(
        Object.keys(NETWORK_ACCESS_OPTIONS).reduce((acc, key) => {
          acc[key] = networkAccessSettings[key] || '0.0.0.0/0';
          return acc;
        }, {})
      );

      if (settings['proxy-settings']?.value) {
        try {
          const proxySettings = JSON.parse(settings['proxy-settings'].value);
          proxySettingsForm.setValues(proxySettings);
        } catch (error) {
          console.error('Error parsing proxy settings:', error);
        }
      }
    }
  }, [settings]);

  const onSubmit = async () => {
    const values = form.getValues();
    const changedSettings = {};
    for (const settingKey in values) {
      // If the user changed the setting’s value from what’s in the DB:
      if (String(values[settingKey]) !== String(settings[settingKey].value)) {
        changedSettings[settingKey] = `${values[settingKey]}`;
      }
    }

    // Update each changed setting in the backend
    for (const updatedKey in changedSettings) {
      await API.updateSetting({
        ...settings[updatedKey],
        value: changedSettings[updatedKey],
      });
    }
  };

  const onNetworkAccessSubmit = async () => {
    setNetworkAccessSaved(false);
    setNetworkAccessError(null);
    const check = await API.checkSetting({
      ...settings['network-access'],
      value: JSON.stringify(networkAccessForm.getValues()),
    });

    if (check.error && check.message) {
      setNetworkAccessError(`${check.message}: ${check.data}`);
      return;
    }

    // For now, only warn if we're blocking the UI
    const blockedAccess = check.UI;
    if (blockedAccess.length == 0) {
      return saveNetworkAccess();
    }

    setNetNetworkAccessConfirmCIDRs(blockedAccess);
    setNetworkAccessConfirmOpen(true);
  };

  const onProxySettingsSubmit = async () => {
    setProxySettingsSaved(false);

    await API.updateSetting({
      ...settings['proxy-settings'],
      value: JSON.stringify(proxySettingsForm.getValues()),
    });

    setProxySettingsSaved(true);
  };

  const resetProxySettingsToDefaults = () => {
    const defaultValues = {
      buffering_timeout: 15,
      buffering_speed: 1.0,
      redis_chunk_ttl: 60,
      channel_shutdown_delay: 0,
      channel_init_grace_period: 5,
    };

    proxySettingsForm.setValues(defaultValues);
  };

  const saveNetworkAccess = async () => {
    setNetworkAccessSaved(false);
    try {
      await API.updateSetting({
        ...settings['network-access'],
        value: JSON.stringify(networkAccessForm.getValues()),
      });
      setNetworkAccessSaved(true);
      setNetworkAccessConfirmOpen(false);
    } catch (e) {
      const errors = {};
      for (const key in e.body.value) {
        errors[key] = `Invalid CIDR(s): ${e.body.value[key]}`;
      }
      networkAccessForm.setErrors(errors);
    }
  };

  const onUISettingsChange = (name, value) => {
    switch (name) {
      case 'table-size':
        setTableSize(value);
        break;
    }
  };

  return (
    <Center
      style={{
        padding: 10,
      }}
    >
      <Box style={{ width: '100%', maxWidth: 800 }}>
        <Accordion
          variant="separated"
          defaultValue="ui-settings"
          onChange={setAccordianValue}
          style={{ minWidth: 400 }}
        >
          <Accordion.Item value="ui-settings">
            <Accordion.Control>UI Settings</Accordion.Control>
            <Accordion.Panel>
              <Select
                label="Table Size"
                value={tableSize}
                onChange={(val) => onUISettingsChange('table-size', val)}
                data={[
                  {
                    value: 'default',
                    label: 'Default',
                  },
                  {
                    value: 'compact',
                    label: 'Compact',
                  },
                  {
                    value: 'large',
                    label: 'Large',
                  },
                ]}
              />
            </Accordion.Panel>
          </Accordion.Item>

          {authUser.user_level == USER_LEVELS.ADMIN && (
            <>
              <Accordion.Item value="stream-settings">
                <Accordion.Control>Stream Settings</Accordion.Control>
                <Accordion.Panel>
                  <form onSubmit={form.onSubmit(onSubmit)}>
                    <Select
                      searchable
                      {...form.getInputProps('default-user-agent')}
                      key={form.key('default-user-agent')}
                      id={
                        settings['default-user-agent']?.id ||
                        'default-user-agent'
                      }
                      name={
                        settings['default-user-agent']?.key ||
                        'default-user-agent'
                      }
                      label={
                        settings['default-user-agent']?.name ||
                        'Default User Agent'
                      }
                      data={userAgents.map((option) => ({
                        value: `${option.id}`,
                        label: option.name,
                      }))}
                    />

                    <Select
                      searchable
                      {...form.getInputProps('default-stream-profile')}
                      key={form.key('default-stream-profile')}
                      id={
                        settings['default-stream-profile']?.id ||
                        'default-stream-profile'
                      }
                      name={
                        settings['default-stream-profile']?.key ||
                        'default-stream-profile'
                      }
                      label={
                        settings['default-stream-profile']?.name ||
                        'Default Stream Profile'
                      }
                      data={streamProfiles.map((option) => ({
                        value: `${option.id}`,
                        label: option.name,
                      }))}
                    />
                    <Select
                      searchable
                      {...form.getInputProps('preferred-region')}
                      key={form.key('preferred-region')}
                      id={
                        settings['preferred-region']?.id ||
                        'preferred-region'
                      }
                      name={
                        settings['preferred-region']?.key ||
                        'preferred-region'
                      }
                      label={
                        settings['preferred-region']?.name ||
                        'Preferred Region'
                      }
                      data={regionChoices.map((r) => ({
                        label: r.label,
                        value: `${r.value}`,
                      }))}
                    />

                    <Group
                      justify="space-between"
                      style={{ paddingTop: 5 }}
                    >
                      <Text size="sm" fw={500}>
                        Auto-Import Mapped Files
                      </Text>
                      <Switch
                        {...form.getInputProps('auto-import-mapped-files', {
                          type: 'checkbox',
                        })}
                        key={form.key('auto-import-mapped-files')}
                        id={
                          settings['auto-import-mapped-files']?.id ||
                          'auto-import-mapped-files'
                        }
                      />
                    </Group>

                    <MultiSelect
                      id="m3u-hash-key"
                      name="m3u-hash-key"
                      label="M3U Hash Key"
                      data={[
                        {
                          value: 'name',
                          label: 'Name',
                        },
                        {
                          value: 'url',
                          label: 'URL',
                        },
                        {
                          value: 'tvg_id',
                          label: 'TVG-ID',
                        },
                      ]}
                      {...form.getInputProps('m3u-hash-key')}
                      key={form.key('m3u-hash-key')}
                    />

                    <Flex
                      mih={50}
                      gap="xs"
                      justify="flex-end"
                      align="flex-end"
                    >
                      <Button
                        type="submit"
                        disabled={form.submitting}
                        variant="default"
                      >
                        Save
                      </Button>
                    </Flex>
                  </form>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="user-agents">
                <Accordion.Control>User-Agents</Accordion.Control>
                <Accordion.Panel>
                  <UserAgentsTable />
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="stream-profiles">
                <Accordion.Control>Stream Profiles</Accordion.Control>
                <Accordion.Panel>
                  <StreamProfilesTable />
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="network-access">
                <Accordion.Control>
                  <Box>Network Access</Box>
                  {accordianValue == 'network-access' && (
                    <Box>
                      <Text size="sm">Comma-Delimited CIDR ranges</Text>
                    </Box>
                  )}
                </Accordion.Control>
                <Accordion.Panel>
                  <form
                    onSubmit={networkAccessForm.onSubmit(
                      onNetworkAccessSubmit
                    )}
                  >
                    <Stack gap="sm">
                      {networkAccessSaved && (
                        <Alert
                          variant="light"
                          color="green"
                          title="Saved Successfully"
                        ></Alert>
                      )}
                      {networkAccessError && (
                        <Alert
                          variant="light"
                          color="red"
                          title={networkAccessError}
                        ></Alert>
                      )}
                      {Object.entries(NETWORK_ACCESS_OPTIONS).map(
                        ([key, config]) => {
                          return (
                            <TextInput
                              label={config.label}
                              {...networkAccessForm.getInputProps(key)}
                              key={networkAccessForm.key(key)}
                              description={config.description}
                            />
                          );
                        }
                      )}

                      <Flex
                        mih={50}
                        gap="xs"
                        justify="flex-end"
                        align="flex-end"
                      >
                        <Button
                          type="submit"
                          disabled={networkAccessForm.submitting}
                          variant="default"
                        >
                          Save
                        </Button>
                      </Flex>
                    </Stack>
                  </form>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="proxy-settings">
                <Accordion.Control>
                  <Box>Proxy Settings</Box>
                </Accordion.Control>
                <Accordion.Panel>
                  <form
                    onSubmit={proxySettingsForm.onSubmit(
                      onProxySettingsSubmit
                    )}
                  >
                    <Stack gap="sm">
                      {proxySettingsSaved && (
                        <Alert
                          variant="light"
                          color="green"
                          title="Saved Successfully"
                        ></Alert>
                      )}
                      {Object.entries(PROXY_SETTINGS_OPTIONS).map(
                        ([key, config]) => {
                          // Determine if this field should be a NumberInput
                          const isNumericField = [
                            'buffering_timeout',
                            'redis_chunk_ttl',
                            'channel_shutdown_delay',
                            'channel_init_grace_period'
                          ].includes(key);

                          const isFloatField = key === 'buffering_speed';

                          if (isNumericField) {
                            return (
                              <NumberInput
                                key={key}
                                label={config.label}
                                {...proxySettingsForm.getInputProps(key)}
                                description={config.description || null}
                                min={0}
                                max={key === 'buffering_timeout' ? 300 :
                                  key === 'redis_chunk_ttl' ? 3600 :
                                    key === 'channel_shutdown_delay' ? 300 : 60}
                              />
                            );
                          } else if (isFloatField) {
                            return (
                              <NumberInput
                                key={key}
                                label={config.label}
                                {...proxySettingsForm.getInputProps(key)}
                                description={config.description || null}
                                min={0.0}
                                max={10.0}
                                step={0.01}
                                precision={1}
                              />
                            );
                          } else {
                            return (
                              <TextInput
                                key={key}
                                label={config.label}
                                {...proxySettingsForm.getInputProps(key)}
                                description={config.description || null}
                              />
                            );
                          }
                        }
                      )}

                      <Flex
                        mih={50}
                        gap="xs"
                        justify="space-between"
                        align="flex-end"
                      >
                        <Button
                          variant="subtle"
                          color="gray"
                          onClick={resetProxySettingsToDefaults}
                        >
                          Reset to Defaults
                        </Button>
                        <Button
                          type="submit"
                          disabled={networkAccessForm.submitting}
                          variant="default"
                        >
                          Save
                        </Button>
                      </Flex>
                    </Stack>
                  </form>
                </Accordion.Panel>
              </Accordion.Item>
            </>
          )}
        </Accordion>
      </Box>

      <ConfirmationDialog
        opened={networkAccessConfirmOpen}
        onClose={() => setNetworkAccessConfirmOpen(false)}
        onConfirm={saveNetworkAccess}
        title={`Confirm Network Access Blocks`}
        message={
          <>
            <Text>
              Your client is not included in the allowed networks for the web
              UI. Are you sure you want to proceed?
            </Text>

            <ul>
              {netNetworkAccessConfirmCIDRs.map((cidr) => (
                <li>{cidr}</li>
              ))}
            </ul>
          </>
        }
        confirmLabel="Save"
        cancelLabel="Cancel"
        size="md"
      />
    </Center>
  );
};

export default SettingsPage;
