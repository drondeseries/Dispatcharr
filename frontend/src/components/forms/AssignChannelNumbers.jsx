import React, { useState, useEffect, useRef } from 'react';
import API from '../../api';
import {
  Button,
  Modal,
  Text,
  Group,
  Flex,
  useMantineTheme,
  NumberInput,
} from '@mantine/core';
import { ListOrdered } from 'lucide-react';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';

const AssignChannelNumbers = ({ channelIds, isOpen, onClose }) => {
  const theme = useMantineTheme();

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      starting_number: 1,
    },
  });

  const onSubmit = async () => {
    const { starting_number } = form.getValues();

    try {
      const result = await API.assignChannelNumbers(
        channelIds,
        starting_number
      );

      notifications.show({
        title: result.message || 'Channels assigned',
        color: 'green.5',
      });

      API.requeryChannels();

      onClose();
    } catch (err) {
      console.error(err);
      notifications.show({
        title: 'Failed to assign channels',
        color: 'red.5',
      });
    }
  };

  if (!isOpen) {
    return <></>;
  }

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      size="xs"
      title={
        <Group gap="5">
          <ListOrdered size="20" />
          <Text>Assign Channel #s</Text>
        </Group>
      }
      styles={{ hannontent: { '--mantine-color-body': '#27272A' } }}
    >
      <form onSubmit={form.onSubmit(onSubmit)}>
        <NumberInput
          placeholder="Starting #"
          mb="xs"
          size="xs"
          {...form.getInputProps('starting_number')}
          key={form.key('starting_number')}
        />

        <Flex mih={50} gap="xs" justify="flex-end" align="flex-end">
          <Button type="submit" variant="default" disabled={form.submitting}>
            Submit
          </Button>
        </Flex>
      </form>
    </Modal>
  );
};

export default AssignChannelNumbers;
