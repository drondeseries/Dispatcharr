// Modal.js
import React from 'react';
import API from '../../api';
import { Button, Modal, Flex, Select, Alert } from '@mantine/core';
import useChannelsStore from '../../store/channels';
import { DateTimePicker } from '@mantine/dates';
import { CircleAlert } from 'lucide-react';
import { isNotEmpty, useForm } from '@mantine/form';

const DVR = ({ recording = null, channel = null, isOpen, onClose }) => {
  const channels = useChannelsStore((s) => s.channels);

  let startTime = new Date();
  startTime.setMinutes(Math.ceil(startTime.getMinutes() / 30) * 30);
  startTime.setSeconds(0);
  startTime.setMilliseconds(0);

  let endTime = new Date();
  endTime.setMinutes(Math.ceil(endTime.getMinutes() / 30) * 30);
  endTime.setSeconds(0);
  endTime.setMilliseconds(0);
  endTime.setHours(endTime.getHours() + 1);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      channel_id: recording
        ? recording.channel_id
        : channel
          ? `${channel.id}`
          : '',
      start_time: recording ? recording.start_time : startTime,
      end_time: recording ? recording.end_time : endTime,
    },

    validate: {
      channel_id: isNotEmpty('Select a channel'),
      start_time: isNotEmpty('Select a start time'),
      end_time: isNotEmpty('Select an end time'),
    },
  });

  const onSubmit = async () => {
    const { channel_id, ...values } = form.getValues();

    console.log(values);

    await API.createRecording({
      ...values,
      channel: channel_id,
    });

    form.reset();
    onClose();
  };

  if (!isOpen) {
    return <></>;
  }

  return (
    <Modal opened={isOpen} onClose={onClose} title="Channel Recording">
      <Alert
        variant="light"
        color="yellow"
        title="Scheduling Conflicts"
        icon={<CircleAlert />}
        style={{ paddingBottom: 5 }}
      >
        Recordings may fail if active streams or overlapping recordings use up
        all available streams
      </Alert>

      <form onSubmit={form.onSubmit(onSubmit)}>
        <Select
          {...form.getInputProps('channel_id')}
          label="Channel"
          key={form.key('channel_id')}
          searchable
          data={Object.values(channels).map((channel) => ({
            value: `${channel.id}`,
            label: channel.name,
          }))}
        />

        <DateTimePicker
          {...form.getInputProps('start_time')}
          key={form.key('start_time')}
          id="start_time"
          label="Start Time"
          valueFormat="M/DD/YYYY hh:mm A"
        />

        <DateTimePicker
          {...form.getInputProps('end_time')}
          key={form.key('end_time')}
          id="end_time"
          label="End Time"
          valueFormat="M/DD/YYYY hh:mm A"
        />

        <Flex mih={50} gap="xs" justify="flex-end" align="flex-end">
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={form.submitting}
          >
            Submit
          </Button>
        </Flex>
      </form>
    </Modal>
  );
};

export default DVR;
