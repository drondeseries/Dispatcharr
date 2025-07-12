import { create } from 'zustand';
import api from '../api';
import { notifications } from '@mantine/notifications';

const defaultProfiles = { 0: { id: '0', name: 'All', channels: new Set() } };

const useChannelsStore = create((set, get) => ({
  channels: [],
  channelsByUUID: {},
  channelGroups: {},
  profiles: {},
  selectedProfileId: '0',
  channelsPageSelection: [],
  stats: {},
  activeChannels: {},
  activeClients: {},
  logos: {},
  recordings: [],
  isLoading: false,
  error: null,
  forceUpdate: 0,

  triggerUpdate: () => {
    set({ forecUpdate: new Date() });
  },

  fetchChannels: async () => {
    set({ isLoading: true, error: null });
    try {
      const channels = await api.getChannels();
      const channelsByUUID = {};
      const channelsByID = channels.reduce((acc, channel) => {
        acc[channel.id] = channel;
        channelsByUUID[channel.uuid] = channel.id;
        return acc;
      }, {});
      set({
        channels: channelsByID,
        channelsByUUID,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch channels:', error);
      set({ error: 'Failed to load channels.', isLoading: false });
    }
  },

  fetchChannelGroups: async () => {
    set({ isLoading: true, error: null });
    try {
      const channelGroups = await api.getChannelGroups();
      set({
        channelGroups: channelGroups.reduce((acc, group) => {
          acc[group.id] = group;
          return acc;
        }, {}),
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch channel groups:', error);
      set({ error: 'Failed to load channel groups.', isLoading: false });
    }
  },

  fetchChannelProfiles: async () => {
    set({ isLoading: true, error: null });
    try {
      const profiles = await api.getChannelProfiles();
      set({
        profiles: profiles.reduce((acc, profile) => {
          acc[profile.id] = {
            ...profile,
            channels: new Set(profile.channels),
          };
          return acc;
        }, defaultProfiles),
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch channel profiles:', error);
      set({ error: 'Failed to load channel profiles.', isLoading: false });
    }
  },

  addChannel: (newChannel) => {
    get().fetchChannelProfiles();
    set((state) => {
      const profiles = { ...state.profiles };
      Object.values(profiles).forEach((item) => {
        item.channels.add(newChannel.id);
      });

      return {
        channels: {
          ...state.channels,
          [newChannel.id]: newChannel,
        },
        channelsByUUID: {
          ...state.channelsByUUID,
          [newChannel.uuid]: newChannel.id,
        },
        profiles,
      };
    });
  },

  addChannels: (newChannels) =>
    set((state) => {
      const channelsByUUID = {};
      const logos = {};
      const profileChannels = new Set();

      const channelsByID = newChannels.reduce((acc, channel) => {
        acc[channel.id] = channel;
        channelsByUUID[channel.uuid] = channel.id;
        profileChannels.add(channel.id);

        return acc;
      }, {});

      const newProfiles = { ...defaultProfiles };
      Object.entries(state.profiles).forEach(([id, profile]) => {
        newProfiles[id] = {
          ...profile,
          channels: new Set([...profile.channels, ...profileChannels]),
        };
      });

      return {
        channels: {
          ...state.channels,
          ...channelsByID,
        },
        channelsByUUID: {
          ...state.channelsByUUID,
          ...channelsByUUID,
        },
        profiles: newProfiles,
      };
    }),

  updateChannel: (channel) =>
    set((state) => ({
      channels: {
        ...state.channels,
        [channel.id]: channel,
      },
      channelsByUUID: {
        ...state.channelsByUUID,
        [channel.uuid]: channel.id,
      },
    })),

  updateChannels: (channels) => {
    // Ensure channels is an array
    if (!Array.isArray(channels)) {
      console.error('updateChannels expects an array, received:', typeof channels, channels);
      return;
    } const channelsByUUID = {};
    const updatedChannels = channels.reduce((acc, chan) => {
      channelsByUUID[chan.uuid] = chan.id;
      acc[chan.id] = chan;
      return acc;
    }, {});

    set((state) => ({
      channels: {
        ...state.channels,
        ...updatedChannels,
      },
      channelsByUUID: {
        ...state.channelsByUUID,
        ...channelsByUUID,
      },
    }));
  },

  removeChannels: (channelIds) => {
    set((state) => {
      const updatedChannels = { ...state.channels };
      const channelsByUUID = { ...state.channelsByUUID };
      for (const id of channelIds) {
        delete updatedChannels[id];

        for (const uuid in channelsByUUID) {
          if (channelsByUUID[uuid] == id) {
            delete channelsByUUID[uuid];
            break;
          }
        }
      }

      return { channels: updatedChannels, channelsByUUID };
    });
  },

  addChannelGroup: (newChannelGroup) =>
    set((state) => ({
      channelGroups: {
        ...state.channelGroups,
        [newChannelGroup.id]: newChannelGroup,
      },
    })),

  updateChannelGroup: (channelGroup) =>
    set((state) => ({
      ...state.channelGroups,
      [channelGroup.id]: channelGroup,
    })),

  fetchLogos: async () => {
    set({ isLoading: true, error: null });
    try {
      const logos = await api.getLogos();
      set({
        logos: logos.reduce((acc, logo) => {
          acc[logo.id] = {
            ...logo,
            url: logo.url.replace(/^\/data/, ''),
          };
          return acc;
        }, {}),
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch logos:', error);
      set({ error: 'Failed to load logos.', isLoading: false });
    }
  },

  addLogo: (newLogo) =>
    set((state) => ({
      logos: {
        ...state.logos,
        [newLogo.id]: {
          ...newLogo,
          url: newLogo.url.replace(/^\/data/, ''),
        },
      },
    })),

  addProfile: (profile) =>
    set((state) => ({
      profiles: {
        ...state.profiles,
        [profile.id]: {
          ...profile,
          channels: new Set(profile.channels),
        },
      },
    })),

  updateProfile: (profile) =>
    set((state) => ({
      profiles: {
        ...state.profiles,
        [profile.id]: {
          ...profile,
          channels: new Set(profile.channels),
        },
      },
    })),

  removeProfiles: (profileIds) =>
    set((state) => {
      const updatedProfiles = { ...state.profiles };
      for (const id of profileIds) {
        delete updatedProfiles[id];
      }

      let additionalUpdates = {};
      if (profileIds.includes(state.selectedProfileId)) {
        additionalUpdates = {
          selectedProfileId: '0',
        };
      }

      return {
        profiles: updatedProfiles,
        selectedProfileId: profileIds.includes(state.selectedProfileId)
          ? '0'
          : state.selectedProfileId,
        ...additionalUpdates,
      };
    }),

  updateProfileChannels: (channelIds, profileId, enabled) =>
    set((state) => {
      const profile = state.profiles[profileId];
      if (!profile) return {};

      const currentChannelsSet = profile.channels;
      let hasChanged = false;

      if (enabled) {
        for (const id of channelIds) {
          if (!currentChannelsSet.has(id)) {
            currentChannelsSet.add(id);
            hasChanged = true;
          }
        }
      } else {
        for (const id of channelIds) {
          if (currentChannelsSet.has(id)) {
            currentChannelsSet.delete(id);
            hasChanged = true;
          }
        }
      }

      if (!hasChanged) return {}; // No need to update anything

      const updatedProfile = {
        ...profile,
        channels: currentChannelsSet,
      };

      const updates = {
        profiles: {
          ...state.profiles,
          [profileId]: updatedProfile,
        },
      };

      return updates;
    }),

  setChannelsPageSelection: (channelsPageSelection) =>
    set((state) => ({ channelsPageSelection })),

  setSelectedProfileId: (id) =>
    set((state) => ({
      selectedProfileId: id,
    })),

  setChannelStats: (stats) => {
    return set((state) => {
      const {
        channels,
        stats: currentStats,
        activeChannels: oldChannels,
        activeClients: oldClients,
        channelsByUUID,
      } = state;
      const newClients = {};
      const newChannels = stats.channels.reduce((acc, ch) => {
        acc[ch.channel_id] = ch;
        if (currentStats.channels) {
          if (oldChannels[ch.channel_id] === undefined) {
            // Add null checks to prevent accessing properties on undefined
            const channelId = channelsByUUID[ch.channel_id];
            const channel = channelId ? channels[channelId] : null;

            if (channel) {
              notifications.show({
                title: 'New channel streaming',
                message: channel.name,
                color: 'blue.5',
              });
            }
          }
        }
        ch.clients.map((client) => {
          newClients[client.client_id] = client;
          // This check prevents the notifications if streams are active on page load
          if (currentStats.channels) {
            if (oldClients[client.client_id] === undefined) {
              notifications.show({
                title: 'New client started streaming',
                message: `Client streaming from ${client.ip_address}`,
                color: 'blue.5',
              });
            }
          }
        });
        return acc;
      }, {});
      // This check prevents the notifications if streams are active on page load
      if (currentStats.channels) {
        for (const uuid in oldChannels) {
          if (newChannels[uuid] === undefined) {
            // Add null check for channel name
            const channelId = channelsByUUID[uuid];
            const channel = channelId && channels[channelId];

            if (channel) {
              notifications.show({
                title: 'Channel streaming stopped',
                message: channel.name,
                color: 'blue.5',
              });
            } else {
              notifications.show({
                title: 'Channel streaming stopped',
                message: `Channel (${uuid})`,
                color: 'blue.5',
              });
            }
          }
        }
        for (const clientId in oldClients) {
          if (newClients[clientId] === undefined) {
            notifications.show({
              title: 'Client stopped streaming',
              message: `Client stopped streaming from ${oldClients[clientId].ip_address}`,
              color: 'blue.5',
            });
          }
        }
      }
      return {
        stats,
        activeChannels: newChannels,
        activeClients: newClients,
      };
    });
  },

  fetchRecordings: async () => {
    set({ isLoading: true, error: null });
    try {
      set({
        recordings: await api.getRecordings(),
      });
    } catch (error) {
      console.error('Failed to fetch recordings:', error);
      set({ error: 'Failed to load recordings.', isLoading: false });
    }
  },
}));

export default useChannelsStore;
