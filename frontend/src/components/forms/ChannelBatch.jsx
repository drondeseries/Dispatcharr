import React, { useState, useEffect, useRef } from 'react';
import useChannelsStore from '../../store/channels';
import API from '../../api';
import useStreamProfilesStore from '../../store/streamProfiles';
import ChannelGroupForm from './ChannelGroup';
import {
  Box,
  Button,
  Modal,
  TextInput,
  Text,
  Group,
  ActionIcon,
  Flex,
  Select,
  Stack,
  useMantineTheme,
  Popover,
  ScrollArea,
  Tooltip,
  UnstyledButton,
  Center,
} from '@mantine/core';
import { ListOrdered, SquarePlus, SquareX, X } from 'lucide-react';
import { FixedSizeList as List } from 'react-window';
import { useForm } from '@mantine/form';
import { USER_LEVELS, USER_LEVEL_LABELS } from '../../constants';

const ChannelBatchForm = ({ channelIds, isOpen, onClose }) => {
  const theme = useMantineTheme();

  const groupListRef = useRef(null);

  const channelGroups = useChannelsStore((s) => s.channelGroups);
  const streamProfiles = useStreamProfilesStore((s) => s.profiles);

  const [channelGroupModelOpen, setChannelGroupModalOpen] = useState(false);
  const [selectedChannelGroup, setSelectedChannelGroup] = useState('-1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [groupPopoverOpened, setGroupPopoverOpened] = useState(false);
  const [groupFilter, setGroupFilter] = useState('');
  const groupOptions = Object.values(channelGroups);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      channel_group: '(no change)',
      stream_profile_id: '-1',
      user_level: '-1',
    },
  });

  const onSubmit = async () => {
    setIsSubmitting(true);

    const values = {
      ...form.getValues(),
    };    // Handle channel group ID - convert to integer if it exists
    if (selectedChannelGroup && selectedChannelGroup !== '-1') {
      values.channel_group_id = parseInt(selectedChannelGroup);
    } else {
      delete values.channel_group_id;
    }

    // Handle stream profile ID - convert special values
    if (!values.stream_profile_id || values.stream_profile_id === '-1') {
      delete values.stream_profile_id;
    } else if (values.stream_profile_id === '0' || values.stream_profile_id === 0) {
      values.stream_profile_id = null; // Convert "use default" to null
    }

    if (values.user_level == '-1') {
      delete values.user_level;
    }

    // Remove the channel_group field from form values as we use channel_group_id
    delete values.channel_group;

    try {
      await API.updateChannels(channelIds, values);
      // Refresh both the channels table data and the main channels store
      await Promise.all([
        API.requeryChannels(),
        useChannelsStore.getState().fetchChannels()
      ]);
      onClose();
    } catch (error) {
      console.error('Failed to update channels:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // useEffect(() => {
  //   // const sameStreamProfile = channels.every(
  //   //   (channel) => channel.stream_profile_id == channels[0].stream_profile_id
  //   // );
  //   // const sameChannelGroup = channels.every(
  //   //   (channel) => channel.channel_group_id == channels[0].channel_group_id
  //   // );
  //   // const sameUserLevel = channels.every(
  //   //   (channel) => channel.user_level == channels[0].user_level
  //   // );
  //   // form.setValues({
  //   //   ...(sameStreamProfile && {
  //   //     stream_profile_id: `${channels[0].stream_profile_id}`,
  //   //   }),
  //   //   ...(sameChannelGroup && {
  //   //     channel_group_id: `${channels[0].channel_group_id}`,
  //   //   }),
  //   //   ...(sameUserLevel && {
  //   //     user_level: `${channels[0].user_level}`,
  //   //   }),
  //   // });
  // }, [channelIds, streamProfiles, channelGroups]);

  const handleChannelGroupModalClose = (newGroup) => {
    setChannelGroupModalOpen(false);

    if (newGroup && newGroup.id) {
      setSelectedChannelGroup(newGroup.id);
      form.setValues({
        channel_group: `${newGroup.name}`,
      });
    }
  };
  const filteredGroups = [
    { id: '-1', name: '(no change)' },
    ...groupOptions.filter((group) =>
      group.name.toLowerCase().includes(groupFilter.toLowerCase())
    )
  ];

  if (!isOpen) {
    return <></>;
  }

  return (
    <>
      <Modal
        opened={isOpen}
        onClose={onClose}
        size="xs"
        title={
          <Group gap="5">
            <ListOrdered size="20" />
            <Text>Channels</Text>
          </Group>
        }
        styles={{ hannontent: { '--mantine-color-body': '#27272A' } }}
      >
        <form onSubmit={form.onSubmit(onSubmit)}>
          <Group justify="space-between" align="top">
            <Stack gap="5" style={{ flex: 1 }}>
              <Popover
                opened={groupPopoverOpened}
                onChange={setGroupPopoverOpened}
                // position="bottom-start"
                withArrow
              >
                <Popover.Target>
                  <Group style={{ width: '100%' }} align="flex-end">
                    <TextInput
                      id="channel_group"
                      name="channel_group"
                      label="Channel Group"
                      readOnly
                      {...form.getInputProps('channel_group')}
                      key={form.key('channel_group')}
                      onClick={() => setGroupPopoverOpened(true)}
                      size="xs"
                      style={{ flex: 1 }} rightSection={
                        form.getValues().channel_group && form.getValues().channel_group !== '(no change)' && (
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedChannelGroup('-1');
                              form.setValues({ channel_group: '(no change)' });
                            }}
                          >
                            <X size={12} />
                          </ActionIcon>
                        )
                      }
                    />

                    <ActionIcon
                      color={theme.tailwind.green[5]}
                      onClick={() => setChannelGroupModalOpen(true)}
                      title="Create new group"
                      size="small"
                      variant="transparent"
                      style={{ marginBottom: 5 }}
                    >
                      <SquarePlus size="20" />
                    </ActionIcon>
                  </Group>
                </Popover.Target>

                <Popover.Dropdown onMouseDown={(e) => e.stopPropagation()}>
                  <Group style={{ width: '100%' }} spacing="xs">
                    <TextInput
                      placeholder="Filter"
                      value={groupFilter}
                      onChange={(event) =>
                        setGroupFilter(event.currentTarget.value)
                      }
                      mb="xs"
                      size="xs"
                      style={{ flex: 1 }}
                    />

                    <ActionIcon
                      color={theme.tailwind.green[5]}
                      onClick={() => setChannelGroupModalOpen(true)}
                      title="Create new group"
                      size="small"
                      variant="transparent"
                      style={{ marginBottom: 5 }}
                    >
                      <SquarePlus size="20" />
                    </ActionIcon>
                  </Group>

                  <ScrollArea style={{ height: 200 }}>
                    <List
                      height={200} // Set max height for visible items
                      itemCount={filteredGroups.length}
                      itemSize={20} // Adjust row height for each item
                      width={200}
                      ref={groupListRef}
                    >
                      {({ index, style }) => (
                        <Box
                          style={{ ...style, height: 20, overflow: 'hidden' }}
                        >
                          <Tooltip
                            openDelay={500}
                            label={filteredGroups[index].name}
                            size="xs"
                          >
                            <UnstyledButton
                              onClick={() => {
                                setSelectedChannelGroup(
                                  filteredGroups[index].id
                                );
                                form.setValues({
                                  channel_group: filteredGroups[index].name,
                                });
                                setGroupPopoverOpened(false);
                              }}
                            >
                              <Text
                                size="xs"
                                style={{
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {filteredGroups[index].name}
                              </Text>
                            </UnstyledButton>
                          </Tooltip>
                        </Box>
                      )}
                    </List>
                  </ScrollArea>
                </Popover.Dropdown>
              </Popover>

              <Select
                id="stream_profile_id"
                label="Stream Profile"
                name="stream_profile_id"
                {...form.getInputProps('stream_profile_id')}
                key={form.key('stream_profile_id')}
                data={[
                  { value: '-1', label: '(no change)' },
                  { value: '0', label: '(use default)' }
                ].concat(
                  streamProfiles.map((option) => ({
                    value: `${option.id}`,
                    label: option.name,
                  }))
                )}
                size="xs"
              />

              <Select
                size="xs"
                label="User Level Access"
                {...form.getInputProps('user_level')}
                key={form.key('user_level')}
                data={[
                  {
                    value: '-1',
                    label: '(no change)',
                  },
                ].concat(
                  Object.entries(USER_LEVELS).map(([, value]) => {
                    return {
                      label: USER_LEVEL_LABELS[value],
                      value: `${value}`,
                    };
                  })
                )}
              />
            </Stack>
          </Group>
          <Flex mih={50} gap="xs" justify="flex-end" align="flex-end">
            <Button type="submit" variant="default" disabled={isSubmitting}>
              Submit
            </Button>
          </Flex>
        </form>
      </Modal>

      <ChannelGroupForm
        isOpen={channelGroupModelOpen}
        onClose={handleChannelGroupModalClose}
      />
    </>
  );
};

export default ChannelBatchForm;
