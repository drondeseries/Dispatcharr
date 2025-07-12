import React, { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import API from '../../api';
import {
  Flex,
  Modal,
  TextInput,
  Button,
  Title,
  Text,
  Paper,
  Badge,
  Grid,
} from '@mantine/core';
import { useWebSocket } from '../../WebSocket';
import usePlaylistsStore from '../../store/playlists';

const RegexFormAndView = ({ profile = null, m3u, isOpen, onClose }) => {
  const [websocketReady, sendMessage] = useWebSocket();

  const profileSearchPreview = usePlaylistsStore((s) => s.profileSearchPreview);
  const profileResult = usePlaylistsStore((s) => s.profileResult);

  const [streamUrl, setStreamUrl] = useState('');
  const [searchPattern, setSearchPattern] = useState('');
  const [replacePattern, setReplacePattern] = useState('');
  const [debouncedPatterns, setDebouncedPatterns] = useState({});
  const [sampleInput, setSampleInput] = useState('');

  useEffect(() => {
    async function fetchStreamUrl() {
      try {
        if (!m3u?.id) return;

        const params = new URLSearchParams();
        params.append('page', 1);
        params.append('page_size', 1);
        params.append('m3u_account', m3u.id);
        const response = await API.queryStreams(params);

        if (response?.results?.length > 0) {
          setStreamUrl(response.results[0].url);
          setSampleInput(response.results[0].url); // Initialize sample input with a real stream URL
        }
      } catch (error) {
        console.error('Error fetching stream URL:', error);
      }
    }
    fetchStreamUrl();
  }, [m3u]);

  useEffect(() => {
    if (!websocketReady || !streamUrl) return;

    try {
      sendMessage(
        JSON.stringify({
          type: 'm3u_profile_test',
          url: sampleInput || streamUrl, // Use sampleInput if provided, otherwise use streamUrl
          search: debouncedPatterns['search'] || '',
          replace: debouncedPatterns['replace'] || '',
        })
      );
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
    }
  }, [websocketReady, m3u, debouncedPatterns, streamUrl, sampleInput]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPatterns({ search: searchPattern, replace: replacePattern });
    }, 500);

    return () => clearTimeout(handler); // Cleanup timeout on unmount or value change
  }, [searchPattern, replacePattern]);

  const onSearchPatternUpdate = (e) => {
    formik.handleChange(e);
    setSearchPattern(e.target.value);
  };

  const onReplacePatternUpdate = (e) => {
    formik.handleChange(e);
    setReplacePattern(e.target.value);
  };

  const formik = useFormik({
    initialValues: {
      name: '',
      max_streams: 0,
      search_pattern: '',
      replace_pattern: '',
    },
    validationSchema: Yup.object({
      name: Yup.string().required('Name is required'),
      search_pattern: Yup.string().required('Search pattern is required'),
      replace_pattern: Yup.string().required('Replace pattern is required'),
    }),
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      console.log('submiting');
      if (profile?.id) {
        await API.updateM3UProfile(m3u.id, {
          id: profile.id,
          ...values,
        });
      } else {
        await API.addM3UProfile(m3u.id, values);
      }

      resetForm();
      setSubmitting(false);
      onClose();
    },
  });

  useEffect(() => {
    if (profile) {
      setSearchPattern(profile.search_pattern);
      setReplacePattern(profile.replace_pattern);
      formik.setValues({
        name: profile.name,
        max_streams: profile.max_streams,
        search_pattern: profile.search_pattern,
        replace_pattern: profile.replace_pattern,
      });
    } else {
      formik.resetForm();
    }
  }, [profile]);

  const handleSampleInputChange = (e) => {
    setSampleInput(e.target.value);
  };

  // Local regex testing for immediate visual feedback
  const getHighlightedSearchText = () => {
    if (!searchPattern || !sampleInput) return sampleInput;
    try {
      const regex = new RegExp(searchPattern, 'g');
      return sampleInput.replace(
        regex,
        (match) => `<mark style="background-color: #ffee58;">${match}</mark>`
      );
    } catch (e) {
      return sampleInput;
    }
  };

  const getLocalReplaceResult = () => {
    if (!searchPattern || !sampleInput) return sampleInput;
    try {
      const regex = new RegExp(searchPattern, 'g');
      return sampleInput.replace(regex, replacePattern);
    } catch (e) {
      return sampleInput;
    }
  };

  return (
    <Modal opened={isOpen} onClose={onClose} title="M3U Profile" size="lg">
      <form onSubmit={formik.handleSubmit}>
        <TextInput
          id="name"
          name="name"
          label="Name"
          value={formik.values.name}
          onChange={formik.handleChange}
          error={formik.errors.name ? formik.touched.name : ''}
        />
        <TextInput
          id="max_streams"
          name="max_streams"
          label="Max Streams"
          value={formik.values.max_streams}
          onChange={formik.handleChange}
          error={formik.errors.max_streams ? formik.touched.max_streams : ''}
        />
        <TextInput
          id="search_pattern"
          name="search_pattern"
          label="Search Pattern (Regex)"
          value={searchPattern}
          onChange={onSearchPatternUpdate}
          error={
            formik.errors.search_pattern ? formik.touched.search_pattern : ''
          }
        />
        <TextInput
          id="replace_pattern"
          name="replace_pattern"
          label="Replace Pattern"
          value={replacePattern}
          onChange={onReplacePatternUpdate}
          error={
            formik.errors.replace_pattern ? formik.touched.replace_pattern : ''
          }
        />

        <Flex
          mih={50}
          gap="xs"
          justify="flex-end"
          align="flex-end"
          style={{ marginBottom: 5 }}
        >
          <Button
            type="submit"
            disabled={formik.isSubmitting}
            size="xs"
            style={{ width: formik.isSubmitting ? 'auto' : 'auto' }}
          >
            Submit
          </Button>
        </Flex>
      </form>

      <Title order={4} mt={15} mb={10}>
        Live Regex Demonstration
      </Title>

      <Paper shadow="sm" p="xs" radius="md" withBorder mb={8}>
        <Text size="sm" weight={500} mb={3}>
          Sample Text
        </Text>
        <TextInput
          value={sampleInput}
          onChange={handleSampleInputChange}
          placeholder="Enter a sample URL to test with"
          size="sm"
        />
      </Paper>

      <Grid gutter="xs">
        <Grid.Col span={12}>
          <Paper shadow="sm" p="xs" radius="md" withBorder>
            <Text size="sm" weight={500} mb={3}>
              Matched Text{' '}
              <Badge size="xs" color="yellow">
                highlighted
              </Badge>
            </Text>
            <Text
              size="sm"
              dangerouslySetInnerHTML={{
                __html: getHighlightedSearchText(),
              }}
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
            />
          </Paper>
        </Grid.Col>

        <Grid.Col span={12}>
          <Paper shadow="sm" p="xs" radius="md" withBorder>
            <Text size="sm" weight={500} mb={3}>
              Result After Replace
            </Text>
            <Text
              size="sm"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
            >
              {getLocalReplaceResult()}
            </Text>
          </Paper>
        </Grid.Col>
      </Grid>
    </Modal>
  );
};

export default RegexFormAndView;
