import React, { useState, useEffect } from 'react';
import API from '../../api';
import M3UProfile from './M3UProfile';
import usePlaylistsStore from '../../store/playlists';
import ConfirmationDialog from '../ConfirmationDialog';
import useWarningsStore from '../../store/warnings';
import {
  Card,
  Checkbox,
  Flex,
  Modal,
  Button,
  Box,
  ActionIcon,
  Text,
  NumberInput,
  useMantineTheme,
  Center,
  Group,
  Switch,
} from '@mantine/core';
import { SquareMinus, SquarePen } from 'lucide-react';

const M3UProfiles = ({ playlist = null, isOpen, onClose }) => {
  const theme = useMantineTheme();

  const allProfiles = usePlaylistsStore((s) => s.profiles);
  const isWarningSuppressed = useWarningsStore((s) => s.isWarningSuppressed);
  const suppressWarning = useWarningsStore((s) => s.suppressWarning);

  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [profileToDelete, setProfileToDelete] = useState(null);

  useEffect(() => {
    try {
      // Make sure playlist exists, has an id, and profiles exist for this playlist
      if (playlist && playlist.id && allProfiles && allProfiles[playlist.id]) {
        setProfiles(allProfiles[playlist.id]);
      } else {
        // Reset profiles if none are available
        setProfiles([]);
      }
    } catch (error) {
      console.error('Error setting profiles:', error);
      setProfiles([]);
    }
  }, [allProfiles, playlist]);

  const editProfile = (profile = null) => {
    if (profile) {
      setProfile(profile);
    }

    setProfileEditorOpen(true);
  };
  const deleteProfile = async (id) => {
    if (!playlist || !playlist.id) return;

    // Get profile details for the confirmation dialog
    const profileObj = profiles.find(p => p.id === id);
    setProfileToDelete(profileObj);
    setDeleteTarget(id);

    // Skip warning if it's been suppressed
    if (isWarningSuppressed('delete-profile')) {
      return executeDeleteProfile(id);
    }

    setConfirmDeleteOpen(true);
  };

  const executeDeleteProfile = async (id) => {
    if (!playlist || !playlist.id) return;
    try {
      await API.deleteM3UProfile(playlist.id, id);
      setConfirmDeleteOpen(false);
    } catch (error) {
      console.error('Error deleting profile:', error);
      setConfirmDeleteOpen(false);
    }
  };

  const toggleActive = async (values) => {
    if (!playlist || !playlist.id) return;
    try {
      await API.updateM3UProfile(playlist.id, {
        ...values,
        is_active: !values.is_active,
      });
    } catch (error) {
      console.error('Error toggling profile active state:', error);
    }
  };

  const modifyMaxStreams = async (value, item) => {
    if (!playlist || !playlist.id) return;
    try {
      await API.updateM3UProfile(playlist.id, {
        ...item,
        max_streams: value,
      });
    } catch (error) {
      console.error('Error updating max streams:', error);
    }
  };

  const closeEditor = () => {
    setProfile(null);
    setProfileEditorOpen(false);
  };

  // Don't render if modal is not open, or if playlist data is invalid
  if (!isOpen || !playlist || !playlist.id) {
    return <></>;
  }

  // Make sure profiles is always an array even if we have no data
  const profilesArray = Array.isArray(profiles) ? profiles : [];

  return (
    <>
      <Modal opened={isOpen} onClose={onClose} title="Profiles">
        {profilesArray
          .sort((a, b) => {
            // Always put default profile first
            if (a.is_default) return -1;
            if (b.is_default) return 1;
            // Sort remaining profiles alphabetically by name
            return a.name.localeCompare(b.name);
          })
          .map((item) => (
            <Card key={item.id}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Group justify="space-between">
                  <Text fw={600}>{item.name}</Text>
                  <Switch
                    checked={item.is_active}
                    onChange={() => toggleActive(item)}
                    disabled={item.is_default}
                    style={{ paddingTop: 6 }}
                  />
                </Group>

                <Flex gap="sm">
                  <NumberInput
                    label="Max Streams"
                    value={item.max_streams}
                    disabled={item.is_default}
                    onChange={(value) => modifyMaxStreams(value, item)}
                    style={{ flex: 1 }}
                  />

                  {!item.is_default && (
                    <Group
                      align="flex-end"
                      gap="xs"
                      style={{ paddingBottom: 8 }}
                    >
                      <ActionIcon
                        size="sm"
                        variant="transparent"
                        color={theme.tailwind.yellow[3]}
                        onClick={() => editProfile(item)}
                      >
                        <SquarePen size="20" />
                      </ActionIcon>

                      <ActionIcon
                        color={theme.tailwind.red[6]}
                        onClick={() => deleteProfile(item.id)}
                        size="small"
                        variant="transparent"
                      >
                        <SquareMinus size="20" />
                      </ActionIcon>
                    </Group>
                  )}
                </Flex>
              </Box>
            </Card>
          ))}

        <Flex mih={50} gap="xs" justify="flex-end" align="flex-end">
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={() => editProfile()}
            style={{ width: '100%' }}
          >
            New
          </Button>
        </Flex>
      </Modal>      <M3UProfile
        m3u={playlist}
        profile={profile}
        isOpen={profileEditorOpen}
        onClose={closeEditor}
      />

      <ConfirmationDialog
        opened={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => executeDeleteProfile(deleteTarget)}
        title="Confirm Profile Deletion"
        message={
          profileToDelete ? (
            <div style={{ whiteSpace: 'pre-line' }}>
              {`Are you sure you want to delete the following profile?

Name: ${profileToDelete.name}
Max Streams: ${profileToDelete.max_streams}

This action cannot be undone.`}
            </div>
          ) : (
            'Are you sure you want to delete this profile? This action cannot be undone.'
          )
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        actionKey="delete-profile"
        onSuppressChange={suppressWarning}
        size="md"
      />
    </>
  );
};

export default M3UProfiles;
