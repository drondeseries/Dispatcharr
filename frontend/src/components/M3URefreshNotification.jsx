// frontend/src/components/FloatingVideo.js
import React, { useEffect, useState } from 'react';
import usePlaylistsStore from '../store/playlists';
import { notifications } from '@mantine/notifications';
import useStreamsStore from '../store/streams';
import useChannelsStore from '../store/channels';
import useEPGsStore from '../store/epgs';
import { Stack, Button, Group } from '@mantine/core';
import API from '../api';
import { useNavigate } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';

export default function M3URefreshNotification() {
  const playlists = usePlaylistsStore((s) => s.playlists);
  const refreshProgress = usePlaylistsStore((s) => s.refreshProgress);
  const fetchStreams = useStreamsStore((s) => s.fetchStreams);
  const fetchChannelGroups = useChannelsStore((s) => s.fetchChannelGroups);
  const fetchPlaylists = usePlaylistsStore((s) => s.fetchPlaylists);
  const fetchEPGData = useEPGsStore((s) => s.fetchEPGData);

  const [notificationStatus, setNotificationStatus] = useState({});
  const navigate = useNavigate();

  const handleM3UUpdate = (data) => {
    if (
      JSON.stringify(notificationStatus[data.account]) == JSON.stringify(data)
    ) {
      return;
    }

    const playlist = playlists.find((pl) => pl.id == data.account);
    if (!playlist) {
      return;
    }

    // Store the updated status first
    setNotificationStatus({
      ...notificationStatus,
      [data.account]: data,
    });

    // Special handling for pending setup status
    if (data.status === 'pending_setup') {
      fetchChannelGroups();
      fetchPlaylists();

      notifications.show({
        title: `M3U Setup: ${playlist.name}`,
        message: (
          <Stack>
            {data.message ||
              'M3U groups loaded. Please select groups or refresh M3U to complete setup.'}
            <Group grow>
              <Button
                size="xs"
                variant="default"
                onClick={() => {
                  API.refreshPlaylist(data.account);
                }}
              >
                Refresh Now
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  // Store the ID we want to edit in the store first
                  usePlaylistsStore.getState().setEditPlaylistId(data.account);

                  // Then navigate to the content sources page
                  // Using the exact path that matches your app's routing structure
                  navigate('/sources');
                }}
              >
                Edit Groups
              </Button>
            </Group>
          </Stack>
        ),
        color: 'orange.5',
        autoClose: 5000, // Keep visible a bit longer
      });
      return;
    }

    // Check for error status FIRST before doing anything else
    if (data.status === 'error') {
      // Only show the error notification if we have a complete task (progress=100)
      // or if it's explicitly flagged as an error
      if (data.progress === 100) {
        notifications.show({
          title: `M3U Processing: ${playlist.name}`,
          message: `${data.action || 'Processing'} failed: ${data.error || 'Unknown error'}`,
          color: 'red',
          autoClose: 5000, // Keep error visible a bit longer
        });
      }
      return; // Exit early for any error status
    }

    // Check if we already have an error stored for this account, and if so, don't show further notifications
    const currentStatus = notificationStatus[data.account];
    if (currentStatus && currentStatus.status === 'error') {
      // Don't show any other notifications once we've hit an error
      return;
    }

    const taskProgress = data.progress;

    // Only show start and completion notifications for normal operation
    if (data.progress != 0 && data.progress != 100) {
      return;
    }

    let message = '';
    switch (data.action) {
      case 'downloading':
        message = 'Downloading';
        break;

      case 'parsing':
        message = 'Stream parsing';
        break;

      case 'processing_groups':
        message = 'Group parsing';
        break;
    }

    if (taskProgress == 0) {
      message = `${message} starting...`;
    } else if (taskProgress == 100) {
      message = `${message} complete!`;

      // Only trigger additional fetches on successful completion
      if (data.action == 'parsing') {
        fetchStreams();
      } else if (data.action == 'processing_groups') {
        fetchStreams();
        fetchChannelGroups();
        fetchEPGData();
        fetchPlaylists();
      }
    }

    notifications.show({
      title: `M3U Processing: ${playlist.name}`,
      message,
      loading: taskProgress == 0,
      autoClose: 2000,
      icon: taskProgress == 100 ? <CircleCheck /> : null,
    });
  };

  useEffect(() => {
    // Reset notificationStatus when playlists change to prevent stale data
    if (playlists.length > 0 && Object.keys(notificationStatus).length > 0) {
      const validIds = playlists.map((p) => p.id);
      const currentIds = Object.keys(notificationStatus).map(Number);

      // If we have notification statuses for playlists that no longer exist, reset the state
      if (!currentIds.every((id) => validIds.includes(id))) {
        setNotificationStatus({});
      }
    }

    // Process all refresh progress updates
    Object.values(refreshProgress).map((data) => handleM3UUpdate(data));
  }, [playlists, refreshProgress]);

  return <></>;
}
