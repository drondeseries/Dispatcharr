// src/api.js (updated)
import useAuthStore from './store/auth';
import useChannelsStore from './store/channels';
import useUserAgentsStore from './store/userAgents';
import usePlaylistsStore from './store/playlists';
import useEPGsStore from './store/epgs';
import useStreamsStore from './store/streams';
import useStreamProfilesStore from './store/streamProfiles';
import useSettingsStore from './store/settings';
import { notifications } from '@mantine/notifications';
import useChannelsTableStore from './store/channelsTable';
import useUsersStore from './store/users';

// If needed, you can set a base host or keep it empty if relative requests
const host = import.meta.env.DEV
  ? `http://${window.location.hostname}:5656`
  : '';

const errorNotification = (message, error) => {
  let errorMessage = '';

  if (error.status) {
    try {
      // Try to format the error body if it's an object
      if (typeof error.body === 'object') {
        errorMessage = JSON.stringify(error.body, null, 2);
      } else {
        errorMessage = `${error.status} - ${error.body}`;
      }
    } catch (e) {
      errorMessage = `${error.status} - ${String(error.body)}`;
    }
  } else {
    errorMessage = error.message || 'Unknown error';
  }

  notifications.show({
    title: 'Error',
    message: `${message}: ${errorMessage}`,
    autoClose: 10000,
    color: 'red',
  });

  throw error;
};

const request = async (url, options = {}) => {
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    typeof options.body === 'object'
  ) {
    options.body = JSON.stringify(options.body);
    options.headers = {
      ...options.headers,
      'Content-Type': 'application/json',
    };
  }

  if (options.auth !== false) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${await API.getAuthToken()}`,
    };
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const error = new Error(`HTTP error! Status: ${response.status}`);

    let errorBody = await response.text();

    try {
      errorBody = JSON.parse(errorBody);
    } catch (e) {
      // If parsing fails, leave errorBody as the raw text
    }

    error.status = response.status;
    error.response = response;
    error.body = errorBody;

    throw error;
  }

  try {
    const retval = await response.json();
    return retval;
  } catch (e) {
    return '';
  }
};

export default class API {
  static lastQueryParams = new URLSearchParams();

  /**
   * A static method so we can do:  await API.getAuthToken()
   */
  static async getAuthToken() {
    return await useAuthStore.getState().getToken();
  }

  static async fetchSuperUser() {
    try {
      return await request(`${host}/api/accounts/initialize-superuser/`, {
        auth: false,
        method: 'GET',
      });
    } catch (error) {
      console.error('Error checking superuser status:', error);
      throw error;
    }
  }

  static async createSuperUser({ username, email, password }) {
    try {
      const response = await request(
        `${host}/api/accounts/initialize-superuser/`,
        {
          auth: false,
          method: 'POST',
          body: {
            username,
            password,
            email,
          },
        }
      );

      return response;
    } catch (e) {
      errorNotification('Failed to create superuser', e);
    }
  }

  static async login(username, password) {
    try {
      const response = await request(`${host}/api/accounts/token/`, {
        auth: false,
        method: 'POST',
        body: { username, password },
      });

      return response;
    } catch (e) {
      errorNotification('Login failed', e);
    }
  }

  static async refreshToken(refresh) {
    try {
      return await request(`${host}/api/accounts/token/refresh/`, {
        auth: false,
        method: 'POST',
        body: { refresh },
      });
    } catch (error) {
      // If user does not exist or token is invalid, clear tokens
      if (error.status === 401 || error.message?.includes('does not exist')) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login'; // Redirect to login
      }
      throw error;
    }
  }

  static async logout() {
    return await request(`${host}/api/accounts/auth/logout/`, {
      auth: false,
      method: 'POST',
    });
  }

  static async getChannels() {
    try {
      const response = await request(`${host}/api/channels/channels/`);

      return response;
    } catch (e) {
      errorNotification('Failed to retrieve channels', e);
    }
  }

  static async queryChannels(params) {
    try {
      API.lastQueryParams = params;

      const response = await request(
        `${host}/api/channels/channels/?${params.toString()}`
      );

      useChannelsTableStore.getState().queryChannels(response, params);

      return response;
    } catch (e) {
      errorNotification('Failed to fetch channels', e);
    }
  }

  static async requeryChannels() {
    try {
      const [response, ids] = await Promise.all([
        request(
          `${host}/api/channels/channels/?${API.lastQueryParams.toString()}`
        ),
        API.getAllChannelIds(API.lastQueryParams),
      ]);

      useChannelsTableStore
        .getState()
        .queryChannels(response, API.lastQueryParams);
      useChannelsTableStore.getState().setAllQueryIds(ids);

      return response;
    } catch (e) {
      errorNotification('Failed to fetch channels', e);
    }
  }

  static async getAllChannelIds(params) {
    try {
      const response = await request(
        `${host}/api/channels/channels/ids/?${params.toString()}`
      );

      return response;
    } catch (e) {
      errorNotification('Failed to fetch channel IDs', e);
    }
  }

  static async getChannelGroups() {
    try {
      const response = await request(`${host}/api/channels/groups/`);

      return response;
    } catch (e) {
      errorNotification('Failed to retrieve channel groups', e);
    }
  }

  static async addChannelGroup(values) {
    try {
      const response = await request(`${host}/api/channels/groups/`, {
        method: 'POST',
        body: values,
      });

      if (response.id) {
        useChannelsStore.getState().addChannelGroup(response);
      }

      return response;
    } catch (e) {
      errorNotification('Failed to create channel group', e);
    }
  }

  static async updateChannelGroup(values) {
    try {
      const { id, ...payload } = values;
      const response = await request(`${host}/api/channels/groups/${id}/`, {
        method: 'PUT',
        body: payload,
      });

      if (response.id) {
        useChannelsStore.getState().updateChannelGroup(response);
      }

      return response;
    } catch (e) {
      errorNotification('Failed to update channel group', e);
    }
  }

  static async addChannel(channel) {
    try {
      let body = null;
      if (channel.logo_file) {
        // Must send FormData for file upload
        body = new FormData();
        for (const prop in channel) {
          body.append(prop, channel[prop]);
        }
      } else {
        body = { ...channel };
        delete body.logo_file;
      }

      const response = await request(`${host}/api/channels/channels/`, {
        method: 'POST',
        body: body,
      });

      API.getLogos();

      if (response.id) {
        useChannelsStore.getState().addChannel(response);
      }

      return response;
    } catch (e) {
      errorNotification('Failed to create channel', e);
    }
  }

  static async deleteChannel(id) {
    try {
      await request(`${host}/api/channels/channels/${id}/`, {
        method: 'DELETE',
      });

      useChannelsStore.getState().removeChannels([id]);
    } catch (e) {
      errorNotification('Failed to delete channel', e);
    }
  }

  // @TODO: the bulk delete endpoint is currently broken
  static async deleteChannels(channel_ids) {
    try {
      await request(`${host}/api/channels/channels/bulk-delete/`, {
        method: 'DELETE',
        body: { channel_ids },
      });

      useChannelsStore.getState().removeChannels(channel_ids);
    } catch (e) {
      errorNotification('Failed to delete channels', e);
    }
  }

  static async updateChannel(values) {
    try {
      // Clean up values before sending to API
      const payload = { ...values };

      // Handle special values
      if (
        payload.stream_profile_id === '0' ||
        payload.stream_profile_id === 0
      ) {
        payload.stream_profile_id = null;
      }

      // Handle logo_id properly (0 means "no logo")
      if (payload.logo_id === '0' || payload.logo_id === 0) {
        payload.logo_id = null;
      }

      // Ensure tvg_id is included properly (not as empty string)
      if (payload.tvg_id === '') {
        payload.tvg_id = null;
      }

      // Ensure tvc_guide_stationid is included properly (not as empty string)
      if (payload.tvc_guide_stationid === '') {
        payload.tvc_guide_stationid = null;
      }

      // Handle channel_number properly
      if (payload.channel_number === '') {
        payload.channel_number = null;
      } else if (
        payload.channel_number !== null &&
        payload.channel_number !== undefined
      ) {
        // Ensure channel_number is explicitly treated as a float
        payload.channel_number = parseFloat(payload.channel_number);
      }

      const response = await request(
        `${host}/api/channels/channels/${payload.id}/`,
        {
          method: 'PATCH',
          body: payload,
        }
      );

      useChannelsStore.getState().updateChannel(response);
      return response;
    } catch (e) {
      errorNotification('Failed to update channel', e);
    }
  }

  static async updateChannels(ids, values) {
    const body = [];
    for (const id of ids) {
      body.push({
        id: id,
        ...values,
      });
    }

    try {
      const response = await request(
        `${host}/api/channels/channels/edit/bulk/`,
        {
          method: 'PATCH',
          body,
        }
      );

      // Don't automatically update the store here - let the caller handle it
      return response;
    } catch (e) {
      errorNotification('Failed to update channels', e);
    }
  }

  static async setChannelEPG(channelId, epgDataId) {
    try {
      const response = await request(
        `${host}/api/channels/channels/${channelId}/set-epg/`,
        {
          method: 'POST',
          body: { epg_data_id: epgDataId },
        }
      );

      // Update the channel in the store with the refreshed data
      if (response.channel) {
        useChannelsStore.getState().updateChannel(response.channel);
      }

      // Show notification about task status
      if (response.task_status) {
        notifications.show({
          title: 'EPG Status',
          message: response.task_status,
          color: 'blue',
        });
      }

      return response;
    } catch (e) {
      errorNotification('Failed to update channel EPG', e);
    }
  }

  static async assignChannelNumbers(channelIds, startingNum = 1) {
    try {
      const response = await request(`${host}/api/channels/channels/assign/`, {
        method: 'POST',
        body: { channel_ids: channelIds, starting_number: startingNum },
      });

      return response;
    } catch (e) {
      errorNotification('Failed to assign channel #s', e);
    }
  }

  static async createChannelFromStream(values) {
    try {
      const response = await request(
        `${host}/api/channels/channels/from-stream/`,
        {
          method: 'POST',
          body: values,
        }
      );

      if (response.id) {
        useChannelsStore.getState().addChannel(response);
      }

      return response;
    } catch (e) {
      errorNotification('Failed to create channel', e);
    }
  }

  static async createChannelsFromStreams(values) {
    try {
      const response = await request(
        `${host}/api/channels/channels/from-stream/bulk/`,
        {
          method: 'POST',
          body: values,
        }
      );

      if (response.created.length > 0) {
        useChannelsStore.getState().addChannels(response.created);
      }

      return response;
    } catch (e) {
      errorNotification('Failed to create channels', e);
    }
  }

  static async getStreams(ids = null) {
    try {
      const params = new URLSearchParams();
      if (ids) {
        params.append('ids', ids.join(','));
      }
      const response = await request(
        `${host}/api/channels/streams/?${params.toString()}`
      );

      return response;
    } catch (e) {
      errorNotification('Failed to retrieve streams', e);
    }
  }

  static async getChannelStreams(id) {
    try {
      const response = await request(
        `${host}/api/channels/channels/${id}/streams/`
      );

      return response;
    } catch (e) {
      errorNotification('Failed to retrieve channel streams', e);
    }
  }

  static async queryStreams(params) {
    try {
      const response = await request(
        `${host}/api/channels/streams/?${params.toString()}`
      );

      return response;
    } catch (e) {
      errorNotification('Failed to fetch streams', e);
    }
  }

  static async getAllStreamIds(params) {
    try {
      const response = await request(
        `${host}/api/channels/streams/ids/?${params.toString()}`
      );

      return response;
    } catch (e) {
      errorNotification('Failed to fetch stream IDs', e);
    }
  }

  static async getStreamGroups() {
    try {
      const response = await request(`${host}/api/channels/streams/groups/`);

      return response;
    } catch (e) {
      errorNotification('Failed to retrieve stream groups', e);
    }
  }

  static async addStream(values) {
    try {
      const response = await request(`${host}/api/channels/streams/`, {
        method: 'POST',
        body: values,
      });

      if (response.id) {
        useStreamsStore.getState().addStream(response);
      }

      return response;
    } catch (e) {
      errorNotification('Failed to add stream', e);
    }
  }

  static async updateStream(values) {
    try {
      const { id, ...payload } = values;
      const response = await request(`${host}/api/channels/streams/${id}/`, {
        method: 'PUT',
        body: payload,
      });

      if (response.id) {
        useStreamsStore.getState().updateStream(response);
      }

      return response;
    } catch (e) {
      errorNotification('Failed to update stream', e);
    }
  }

  static async deleteStream(id) {
    try {
      await request(`${host}/api/channels/streams/${id}/`, {
        method: 'DELETE',
      });

      useStreamsStore.getState().removeStreams([id]);
    } catch (e) {
      errorNotification('Failed to delete stream', e);
    }
  }

  static async deleteStreams(ids) {
    try {
      await request(`${host}/api/channels/streams/bulk-delete/`, {
        method: 'DELETE',
        body: { stream_ids: ids },
      });

      useStreamsStore.getState().removeStreams(ids);
    } catch (e) {
      errorNotification('Failed to delete streams', e);
    }
  }

  static async getUserAgents() {
    try {
      const response = await request(`${host}/api/core/useragents/`);

      return response;
    } catch (e) {
      errorNotification('Failed to retrieve user-agents', e);
    }
  }

  static async addUserAgent(values) {
    try {
      const response = await request(`${host}/api/core/useragents/`, {
        method: 'POST',
        body: values,
      });

      useUserAgentsStore.getState().addUserAgent(response);

      return response;
    } catch (e) {
      errorNotification('Failed to create user-agent', e);
    }
  }

  static async updateUserAgent(values) {
    try {
      const { id, ...payload } = values;
      const response = await request(`${host}/api/core/useragents/${id}/`, {
        method: 'PUT',
        body: payload,
      });

      useUserAgentsStore.getState().updateUserAgent(response);

      return response;
    } catch (e) {
      errorNotification('Failed to update user-agent', e);
    }
  }

  static async deleteUserAgent(id) {
    try {
      await request(`${host}/api/core/useragents/${id}/`, {
        method: 'DELETE',
      });

      useUserAgentsStore.getState().removeUserAgents([id]);
    } catch (e) {
      errorNotification('Failed to delete user-agent', e);
    }
  }

  static async getPlaylist(id) {
    try {
      const response = await request(`${host}/api/m3u/accounts/${id}/`);

      return response;
    } catch (e) {
      errorNotification(`Failed to retrieve M3U account ${id}`, e);
    }
  }

  static async getPlaylists() {
    try {
      const response = await request(`${host}/api/m3u/accounts/`);

      return response;
    } catch (e) {
      errorNotification('Failed to retrieve M3U accounts', e);
    }
  }

  static async addPlaylist(values) {
    if (values.custom_properties) {
      values.custom_properties = JSON.stringify(values.custom_properties);
    }

    try {
      let body = null;
      if (values.file) {
        body = new FormData();
        for (const prop in values) {
          body.append(prop, values[prop]);
        }
      } else {
        body = { ...values };
        delete body.file;
      }

      const response = await request(`${host}/api/m3u/accounts/`, {
        method: 'POST',
        body,
      });

      usePlaylistsStore.getState().addPlaylist(response);

      return response;
    } catch (e) {
      errorNotification('Failed to create M3U account', e);
    }
  }

  static async refreshPlaylist(id) {
    try {
      const response = await request(`${host}/api/m3u/refresh/${id}/`, {
        method: 'POST',
      });

      return response;
    } catch (e) {
      errorNotification('Failed to refresh M3U account', e);
    }
  }

  static async refreshAllPlaylist() {
    try {
      const response = await request(`${host}/api/m3u/refresh/`, {
        method: 'POST',
      });

      return response;
    } catch (e) {
      errorNotification('Failed to refresh all M3U accounts', e);
    }
  }

  static async deletePlaylist(id) {
    try {
      await request(`${host}/api/m3u/accounts/${id}/`, {
        method: 'DELETE',
      });

      usePlaylistsStore.getState().removePlaylists([id]);
      // @TODO: MIGHT need to optimize this later if someone has thousands of channels
      // but I'm feeling laze right now
      // useChannelsStore.getState().fetchChannels();
    } catch (e) {
      errorNotification(`Failed to delete playlist ${id}`, e);
    }
  }

  static async updatePlaylist(values, isToggle = false) {
    const { id, ...payload } = values;

    try {
      // If this is just toggling the active state, make a simpler request
      if (
        isToggle &&
        'is_active' in payload &&
        Object.keys(payload).length === 1
      ) {
        const response = await request(`${host}/api/m3u/accounts/${id}/`, {
          method: 'PATCH',
          body: { is_active: payload.is_active },
        });

        usePlaylistsStore.getState().updatePlaylist(response);
        return response;
      }

      // Original implementation for full updates
      let body = null;
      if (payload.file) {
        delete payload.server_url;

        body = new FormData();
        for (const prop in values) {
          body.append(prop, values[prop]);
        }
      } else {
        delete payload.file;
        if (!payload.server_url) {
          delete payload.sever_url;
        }

        body = { ...payload };
        delete body.file;
      }
      console.log(body);

      const response = await request(`${host}/api/m3u/accounts/${id}/`, {
        method: 'PATCH',
        body,
      });

      usePlaylistsStore.getState().updatePlaylist(response);

      return response;
    } catch (e) {
      errorNotification(`Failed to update M3U account ${id}`, e);
    }
  }

  static async getEPGs() {
    try {
      const response = await request(`${host}/api/epg/sources/`);

      return response;
    } catch (e) {
      errorNotification('Failed to retrieve EPGs', e);
    }
  }

  static async getEPGData() {
    try {
      const response = await request(`${host}/api/epg/epgdata/`);

      return response;
    } catch (e) {
      errorNotification('Failed to retrieve EPG data', e);
    }
  }

  // Notice there's a duplicated "refreshPlaylist" method above;
  // you might want to rename or remove one if it's not needed.

  static async addEPG(values) {
    try {
      let body = null;
      if (values.files) {
        body = new FormData();
        for (const prop in values) {
          body.append(prop, values[prop]);
        }
      } else {
        body = { ...values };
        delete body.file;
      }

      const response = await request(`${host}/api/epg/sources/`, {
        method: 'POST',
        body,
      });

      useEPGsStore.getState().addEPG(response);

      return response;
    } catch (e) {
      errorNotification('Failed to create EPG', e);
    }
  }

  static async updateEPG(values, isToggle = false) {
    const { id, ...payload } = values;

    try {
      // If this is just toggling the active state, make a simpler request
      if (
        isToggle &&
        'is_active' in payload &&
        Object.keys(payload).length === 1
      ) {
        const response = await request(`${host}/api/epg/sources/${id}/`, {
          method: 'PATCH',
          body: { is_active: payload.is_active },
        });

        useEPGsStore.getState().updateEPG(response);
        return response;
      }

      // Original implementation for full updates
      let body = null;
      if (payload.files) {
        body = new FormData();
        for (const prop in payload) {
          if (prop == 'url') {
            continue;
          }
          body.append(prop, payload[prop]);
        }
      } else {
        delete payload.file;
        if (!payload.url) {
          delete payload.url;
        }
        body = payload;
      }

      const response = await request(`${host}/api/epg/sources/${id}/`, {
        method: 'PATCH',
        body,
      });

      useEPGsStore.getState().updateEPG(response);

      return response;
    } catch (e) {
      errorNotification(`Failed to update EPG ${id}`, e);
    }
  }

  static async deleteEPG(id) {
    try {
      await request(`${host}/api/epg/sources/${id}/`, {
        method: 'DELETE',
      });

      useEPGsStore.getState().removeEPGs([id]);
    } catch (e) {
      errorNotification(`Failed to delete EPG ${id}`, e);
    }
  }

  static async refreshEPG(id) {
    try {
      const response = await request(`${host}/api/epg/import/`, {
        method: 'POST',
        body: { id },
      });

      return response;
    } catch (e) {
      errorNotification(`Failed to refresh EPG ${id}`, e);
    }
  }

  static async getStreamProfiles() {
    try {
      const response = await request(`${host}/api/core/streamprofiles/`);

      return response;
    } catch (e) {
      errorNotification('Failed to retrieve sream profiles', e);
    }
  }

  static async addStreamProfile(values) {
    try {
      const response = await request(`${host}/api/core/streamprofiles/`, {
        method: 'POST',
        body: values,
      });

      useStreamProfilesStore.getState().addStreamProfile(response);

      return response;
    } catch (e) {
      errorNotification('Failed to create stream profile', e);
    }
  }

  static async updateStreamProfile(values) {
    const { id, ...payload } = values;

    try {
      const response = await request(`${host}/api/core/streamprofiles/${id}/`, {
        method: 'PUT',
        body: payload,
      });

      useStreamProfilesStore.getState().updateStreamProfile(response);

      return response;
    } catch (e) {
      errorNotification(`Failed to update stream profile ${id}`, e);
    }
  }

  static async deleteStreamProfile(id) {
    try {
      await request(`${host}/api/core/streamprofiles/${id}/`, {
        method: 'DELETE',
      });

      useStreamProfilesStore.getState().removeStreamProfiles([id]);
    } catch (e) {
      errorNotification(`Failed to delete stream propfile ${id}`, e);
    }
  }

  static async getGrid() {
    try {
      const response = await request(`${host}/api/epg/grid/`);

      return response.data;
    } catch (e) {
      errorNotification('Failed to retrieve program grid', e);
    }
  }

  static async addM3UProfile(accountId, values) {
    try {
      const response = await request(
        `${host}/api/m3u/accounts/${accountId}/profiles/`,
        {
          method: 'POST',
          body: values,
        }
      );

      // Refresh the playlist
      const playlist = await API.getPlaylist(accountId);
      usePlaylistsStore
        .getState()
        .updateProfiles(playlist.id, playlist.profiles);

      return response;
    } catch (e) {
      errorNotification(`Failed to add profile to account ${accountId}`, e);
    }
  }

  static async deleteM3UProfile(accountId, id) {
    try {
      await request(`${host}/api/m3u/accounts/${accountId}/profiles/${id}/`, {
        method: 'DELETE',
      });

      const playlist = await API.getPlaylist(accountId);
      usePlaylistsStore.getState().updatePlaylist(playlist);
    } catch (e) {
      errorNotification(`Failed to delete profile for account ${accountId}`, e);
    }
  }

  static async updateM3UProfile(accountId, values) {
    const { id, ...payload } = values;

    try {
      await request(`${host}/api/m3u/accounts/${accountId}/profiles/${id}/`, {
        method: 'PUT',
        body: payload,
      });

      const playlist = await API.getPlaylist(accountId);
      usePlaylistsStore
        .getState()
        .updateProfiles(playlist.id, playlist.profiles);
    } catch (e) {
      errorNotification(`Failed to update profile for account ${accountId}`, e);
    }
  }

  static async getSettings() {
    try {
      const response = await request(`${host}/api/core/settings/`);

      return response;
    } catch (e) {
      errorNotification('Failed to retrieve settings', e);
    }
  }

  static async getEnvironmentSettings() {
    try {
      const response = await request(`${host}/api/core/settings/env/`);

      return response;
    } catch (e) {
      errorNotification('Failed to retrieve environment settings', e);
    }
  }

  static async getVersion() {
    try {
      const response = await request(`${host}/api/core/version/`, {
        auth: false,
      });

      return response;
    } catch (e) {
      errorNotification('Failed to retrieve version', e);
    }
  }

  static async checkSetting(values) {
    const { id, ...payload } = values;

    try {
      const response = await request(`${host}/api/core/settings/check/`, {
        method: 'POST',
        body: payload,
      });

      return response;
    } catch (e) {
      errorNotification('Failed to update settings', e);
    }
  }

  static async updateSetting(values) {
    const { id, ...payload } = values;

    try {
      const response = await request(`${host}/api/core/settings/${id}/`, {
        method: 'PUT',
        body: payload,
      });

      useSettingsStore.getState().updateSetting(response);

      return response;
    } catch (e) {
      errorNotification('Failed to update settings', e);
    }
  }

  static async getChannelStats(uuid = null) {
    try {
      const response = await request(`${host}/proxy/ts/status`);

      return response;
    } catch (e) {
      errorNotification('Failed to retrieve channel stats', e);
    }
  }

  static async stopChannel(id) {
    try {
      const response = await request(`${host}/proxy/ts/stop/${id}`, {
        method: 'POST',
      });

      return response;
    } catch (e) {
      errorNotification('Failed to stop channel', e);
    }
  }

  static async stopClient(channelId, clientId) {
    try {
      const response = await request(
        `${host}/proxy/ts/stop_client/${channelId}`,
        {
          method: 'POST',
          body: { client_id: clientId },
        }
      );

      return response;
    } catch (e) {
      errorNotification('Failed to stop client', e);
    }
  }

  static async matchEpg() {
    try {
      const response = await request(
        `${host}/api/channels/channels/match-epg/`,
        {
          method: 'POST',
        }
      );

      return response;
    } catch (e) {
      errorNotification('Failed to run EPG auto-match', e);
    }
  }

  static async getLogos() {
    try {
      const response = await request(`${host}/api/channels/logos/`);

      return response;
    } catch (e) {
      errorNotification('Failed to retrieve logos', e);
    }
  }

  static async uploadLogo(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await request(`${host}/api/channels/logos/upload/`, {
        method: 'POST',
        body: formData,
      });

      useChannelsStore.getState().addLogo(response);

      return response;
    } catch (e) {
      errorNotification('Failed to upload logo', e);
    }
  }

  static async getChannelProfiles() {
    try {
      const response = await request(`${host}/api/channels/profiles/`);

      return response;
    } catch (e) {
      errorNotification('Failed to get channel profiles', e);
    }
  }

  static async addChannelProfile(values) {
    try {
      const response = await request(`${host}/api/channels/profiles/`, {
        method: 'POST',
        body: values,
      });

      useChannelsStore.getState().addProfile(response);

      return response;
    } catch (e) {
      errorNotification('Failed to create channel profile', e);
    }
  }

  static async updateChannelProfile(values) {
    const { id, ...payload } = values;

    try {
      const response = await request(`${host}/api/channels/profiles/${id}/`, {
        method: 'PUT',
        body: payload,
      });

      useChannelsStore.getState().updateProfile(response);

      return response;
    } catch (e) {
      errorNotification('Failed to update channel profile', e);
    }
  }

  static async deleteChannelProfile(id) {
    try {
      await request(`${host}/api/channels/profiles/${id}/`, {
        method: 'DELETE',
      });

      useChannelsStore.getState().removeProfiles([id]);
    } catch (e) {
      errorNotification(`Failed to delete channel profile ${id}`, e);
    }
  }

  static async updateProfileChannel(channelId, profileId, enabled) {
    try {
      await request(
        `${host}/api/channels/profiles/${profileId}/channels/${channelId}/`,
        {
          method: 'PATCH',
          body: { enabled },
        }
      );

      useChannelsStore
        .getState()
        .updateProfileChannels([channelId], profileId, enabled);
    } catch (e) {
      errorNotification(`Failed to update channel for profile ${profileId}`, e);
    }
  }

  static async updateProfileChannels(channelIds, profileId, enabled) {
    try {
      await request(
        `${host}/api/channels/profiles/${profileId}/channels/bulk-update/`,
        {
          method: 'PATCH',
          body: {
            channels: channelIds.map((id) => ({
              channel_id: id,
              enabled,
            })),
          },
        }
      );

      useChannelsStore
        .getState()
        .updateProfileChannels(channelIds, profileId, enabled);
    } catch (e) {
      errorNotification(
        `Failed to bulk update channels for profile ${profileId}`,
        e
      );
    }
  }

  static async getRecordings() {
    try {
      const response = await request(`${host}/api/channels/recordings/`);

      return response;
    } catch (e) {
      errorNotification('Failed to retrieve recordings', e);
    }
  }

  static async createRecording(values) {
    try {
      const response = await request(`${host}/api/channels/recordings/`, {
        method: 'POST',
        body: values,
      });

      useChannelsStore.getState().fetchRecordings();

      return response;
    } catch (e) {
      errorNotification('Failed to create recording', e);
    }
  }

  static async deleteRecording(id) {
    try {
      await request(`${host}/api/channels/recordings/${id}/`, {
        method: 'DELETE',
      });

      useChannelsStore.getState().fetchRecordings();
    } catch (e) {
      errorNotification(`Failed to delete recording ${id}`, e);
    }
  }

  static async switchStream(channelId, streamId) {
    try {
      const response = await request(
        `${host}/proxy/ts/change_stream/${channelId}`,
        {
          method: 'POST',
          body: { stream_id: streamId },
        }
      );

      return response;
    } catch (e) {
      errorNotification('Failed to switch stream', e);
      throw e;
    }
  }

  static async nextStream(channelId, streamId) {
    try {
      const response = await request(
        `${host}/proxy/ts/next_stream/${channelId}`,
        {
          method: 'POST',
          body: { stream_id: streamId },
        }
      );

      return response;
    } catch (e) {
      errorNotification('Failed to switch stream', e);
      throw e;
    }
  }

  static async batchSetEPG(associations) {
    try {
      const response = await request(
        `${host}/api/channels/channels/batch-set-epg/`,
        {
          method: 'POST',
          body: { associations },
        }
      );

      // If successful, requery channels to update UI
      if (response.success) {
        notifications.show({
          title: 'EPG Association',
          message: `Updated ${response.channels_updated} channels, refreshing ${response.programs_refreshed} EPG sources.`,
          color: 'blue',
        });

        // First fetch the complete channel data
        await useChannelsStore.getState().fetchChannels();
        // Then refresh the current table view
        this.requeryChannels();
      }

      return response;
    } catch (e) {
      errorNotification('Failed to update channel EPGs', e);
    }
  }

  static async getChannel(id) {
    try {
      const response = await request(
        `${host}/api/channels/channels/${id}/?include_streams=true`
      );
      return response;
    } catch (e) {
      errorNotification('Failed to fetch channel details', e);
      return null;
    }
  }

  static async me() {
    return await request(`${host}/api/accounts/users/me/`);
  }

  static async getUsers() {
    try {
      const response = await request(`${host}/api/accounts/users/`);
      return response;
    } catch (e) {
      errorNotification('Failed to fetch users', e);
    }
  }

  static async createUser(body) {
    try {
      const response = await request(`${host}/api/accounts/users/`, {
        method: 'POST',
        body,
      });

      useUsersStore.getState().addUser(response);

      return response;
    } catch (e) {
      errorNotification('Failed to fetch users', e);
    }
  }

  static async updateUser(id, body) {
    try {
      const response = await request(`${host}/api/accounts/users/${id}/`, {
        method: 'PATCH',
        body,
      });

      useUsersStore.getState().updateUser(response);

      return response;
    } catch (e) {
      errorNotification('Failed to fetch users', e);
    }
  }

  static async deleteUser(id) {
    try {
      await request(`${host}/api/accounts/users/${id}/`, {
        method: 'DELETE',
      });

      useUsersStore.getState().removeUser(id);
    } catch (e) {
      errorNotification('Failed to delete user', e);
    }
  }
}
