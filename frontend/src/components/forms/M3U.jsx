// Modal.js
import React, { useState, useEffect } from 'react';
import API from '../../api';
import useUserAgentsStore from '../../store/userAgents';
import M3UProfiles from './M3UProfiles';
import {
  LoadingOverlay,
  TextInput,
  Button,
  Checkbox,
  Modal,
  Flex,
  Select,
  FileInput,
  useMantineTheme,
  NumberInput,
  Divider,
  Stack,
  Group,
  Switch,
  Box,
  PasswordInput,
} from '@mantine/core';
import M3UGroupFilter from './M3UGroupFilter';
import useChannelsStore from '../../store/channels';
import usePlaylistsStore from '../../store/playlists';
import { notifications } from '@mantine/notifications';
import { isNotEmpty, useForm } from '@mantine/form';
import useEPGsStore from '../../store/epgs';

const M3U = ({
  m3uAccount = null,
  isOpen,
  onClose,
  playlistCreated = false,
}) => {
  const theme = useMantineTheme();

  const userAgents = useUserAgentsStore((s) => s.userAgents);
  const fetchChannelGroups = useChannelsStore((s) => s.fetchChannelGroups);
  const fetchPlaylists = usePlaylistsStore((s) => s.fetchPlaylists);
  const fetchEPGs = useEPGsStore((s) => s.fetchEPGs);

  const [playlist, setPlaylist] = useState(null);
  const [file, setFile] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [groupFilterModalOpen, setGroupFilterModalOpen] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [showCredentialFields, setShowCredentialFields] = useState(false);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      name: '',
      server_url: '',
      user_agent: '0',
      is_active: true,
      max_streams: 0,
      refresh_interval: 24,
      account_type: 'STD',
      create_epg: false,
      username: '',
      password: '',
      stale_stream_days: 7,
    },

    validate: {
      name: isNotEmpty('Please select a name'),
      user_agent: isNotEmpty('Please select a user-agent'),
      refresh_interval: isNotEmpty('Please specify a refresh interval'),
    },
  });

  useEffect(() => {
    console.log(m3uAccount);
    if (m3uAccount) {
      setPlaylist(m3uAccount);
      form.setValues({
        name: m3uAccount.name,
        server_url: m3uAccount.server_url,
        max_streams: m3uAccount.max_streams,
        user_agent: m3uAccount.user_agent ? `${m3uAccount.user_agent}` : '0',
        is_active: m3uAccount.is_active,
        refresh_interval: m3uAccount.refresh_interval,
        account_type: m3uAccount.account_type,
        username: m3uAccount.username ?? '',
        password: '',
        stale_stream_days: m3uAccount.stale_stream_days !== undefined && m3uAccount.stale_stream_days !== null ? m3uAccount.stale_stream_days : 7,
      });

      if (m3uAccount.account_type == 'XC') {
        setShowCredentialFields(true);
      } else {
        setShowCredentialFields(false);
      }
    } else {
      setPlaylist(null);
      form.reset();
    }
  }, [m3uAccount]);

  useEffect(() => {
    if (form.values.account_type == 'XC') {
      setShowCredentialFields(true);
    }
  }, [form.values.account_type]);

  const onSubmit = async () => {
    const { create_epg, ...values } = form.getValues();

    if (values.account_type == 'XC' && values.password == '') {
      // If account XC and no password input, assuming no password change
      // from previously stored value.
      delete values.password;
    }

    if (values.user_agent == '0') {
      values.user_agent = null;
    }

    let newPlaylist;
    if (playlist?.id) {
      await API.updatePlaylist({
        id: playlist.id,
        ...values,
        file,
      });
    } else {
      newPlaylist = await API.addPlaylist({
        ...values,
        file,
      });

      if (create_epg) {
        API.addEPG({
          name: values.name,
          source_type: 'xmltv',
          url: `${values.server_url}/xmltv.php?username=${values.username}&password=${values.password}`,
          api_key: '',
          is_active: true,
          refresh_interval: 24,
        });
      }

      if (values.account_type != 'XC') {
        notifications.show({
          title: 'Fetching M3U Groups',
          message: 'Filter out groups or refresh M3U once complete.',
          // color: 'green.5',
        });

        // Don't prompt for group filters, but keeping this here
        // in case we want to revive it
        newPlaylist = null;
        close();
        return;
      }

      const updatedPlaylist = await API.getPlaylist(newPlaylist.id);
      await Promise.all([fetchChannelGroups(), fetchPlaylists(), fetchEPGs()]);
      console.log('opening group options');
      setPlaylist(updatedPlaylist);
      setGroupFilterModalOpen(true);
      return;
    }

    form.reset();
    setFile(null);
    onClose(newPlaylist);
  };

  const close = () => {
    form.reset();
    setFile(null);
    setPlaylist(null);
    onClose();
  };

  const closeGroupFilter = () => {
    setGroupFilterModalOpen(false);
    close();
  };

  useEffect(() => {
    if (playlistCreated) {
      setGroupFilterModalOpen(true);
    }
  }, [playlist, playlistCreated]);

  if (!isOpen) {
    return <></>;
  }

  return (
    <Modal size={700} opened={isOpen} onClose={close} title="M3U Account">
      <LoadingOverlay
        visible={form.submitting}
        overlayBlur={2}
        loaderProps={loadingText ? { children: loadingText } : {}}
      />

      <form onSubmit={form.onSubmit(onSubmit)}>
        <Group justify="space-between" align="top">
          <Stack gap="5" style={{ flex: 1 }}>
            <TextInput
              style={{ width: '100%' }}
              id="name"
              name="name"
              label="Name"
              description="Unique identifier for this M3U account"
              {...form.getInputProps('name')}
              key={form.key('name')}
            />
            <TextInput
              style={{ width: '100%' }}
              id="server_url"
              name="server_url"
              label="URL"
              description="Direct URL to the M3U playlist or server"
              {...form.getInputProps('server_url')}
              key={form.key('server_url')}
            />

            <Select
              id="account_type"
              name="account_type"
              label="Account Type"
              description={<>Standard for direct M3U URLs, <br />Xtream Codes for panel-based services</>}
              data={[
                {
                  value: 'STD',
                  label: 'Standard',
                },
                {
                  value: 'XC',
                  label: 'Xtream Codes',
                },
              ]}
              key={form.key('account_type')}
              {...form.getInputProps('account_type')}
            />

            {form.getValues().account_type == 'XC' && (
              <Box>
                {!m3uAccount && (
                  <Group justify="space-between">
                    <Box>Create EPG</Box>
                    <Switch
                      id="create_epg"
                      name="create_epg"
                      description="Automatically create matching EPG source for this Xtream account"
                      key={form.key('create_epg')}
                      {...form.getInputProps('create_epg', {
                        type: 'checkbox',
                      })}
                    />
                  </Group>
                )}

                <TextInput
                  id="username"
                  name="username"
                  label="Username"
                  description="Username for Xtream Codes authentication"
                  {...form.getInputProps('username')}
                />

                <PasswordInput
                  id="password"
                  name="password"
                  label="Password"
                  description="Password for Xtream Codes authentication (leave empty to keep existing)"
                  {...form.getInputProps('password')}
                />
              </Box>
            )}

            {form.getValues().account_type != 'XC' && (
              <FileInput
                id="file"
                label="Upload files"
                placeholder="Upload files"
                description="Upload a local M3U file instead of using URL"
                onChange={setFile}
              />
            )}
          </Stack>

          <Divider size="sm" orientation="vertical" />

          <Stack gap="5" style={{ flex: 1 }}>
            <TextInput
              style={{ width: '100%' }}
              id="max_streams"
              name="max_streams"
              label="Max Streams"
              placeholder="0 = Unlimited"
              description="Maximum number of concurrent streams (0 for unlimited)"
              {...form.getInputProps('max_streams')}
              key={form.key('max_streams')}
            />

            <Select
              id="user_agent"
              name="user_agent"
              label="User-Agent"
              description="User-Agent header to use when accessing this M3U source"
              {...form.getInputProps('user_agent')}
              key={form.key('user_agent')}
              data={[{ value: '0', label: '(Use Default)' }].concat(
                userAgents.map((ua) => ({
                  label: ua.name,
                  value: `${ua.id}`,
                }))
              )}
            />

            <NumberInput
              label="Refresh Interval (hours)"
              description={<>How often to automatically refresh M3U data<br />
                (0 to disable automatic refreshes)</>}
              {...form.getInputProps('refresh_interval')}
              key={form.key('refresh_interval')}
            />

            <NumberInput
              min={0}
              max={365}
              label="Stale Stream Retention (days)"
              description="Streams not seen for this many days will be removed"
              {...form.getInputProps('stale_stream_days')}
            />

            <Checkbox
              label="Is Active"
              description="Enable or disable this M3U account"
              {...form.getInputProps('is_active', { type: 'checkbox' })}
              key={form.key('is_active')}
            />
          </Stack>
        </Group>

        <Flex mih={50} gap="xs" justify="flex-end" align="flex-end">
          {playlist && (
            <>
              <Button
                variant="filled"
                // color={theme.custom.colors.buttonPrimary}
                size="sm"
                onClick={() => setGroupFilterModalOpen(true)}
              >
                Groups
              </Button>
              <Button
                variant="filled"
                // color={theme.custom.colors.buttonPrimary}
                size="sm"
                onClick={() => setProfileModalOpen(true)}
              >
                Profiles
              </Button>
            </>
          )}

          <Button
            type="submit"
            variant="filled"
            disabled={form.submitting}
            size="sm"
          >
            Save
          </Button>
        </Flex>
        {playlist && (
          <>
            <M3UProfiles
              playlist={playlist}
              isOpen={profileModalOpen}
              onClose={() => setProfileModalOpen(false)}
            />
            <M3UGroupFilter
              isOpen={groupFilterModalOpen}
              playlist={playlist}
              onClose={closeGroupFilter}
            />
          </>
        )}
      </form>
    </Modal>
  );
};

export default M3U;
