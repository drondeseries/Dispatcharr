// frontend/src/components/FloatingVideo.js
import React, { useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';
import useVideoStore from '../store/useVideoStore';
import mpegts from 'mpegts.js';
import { CloseButton, Flex, Loader, Text, Box } from '@mantine/core';

export default function FloatingVideo() {
  const isVisible = useVideoStore((s) => s.isVisible);
  const streamUrl = useVideoStore((s) => s.streamUrl);
  const hideVideo = useVideoStore((s) => s.hideVideo);
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const videoContainerRef = useRef(null);
  // Convert ref to state so we can use it for rendering
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Safely destroy the player to prevent errors
  const safeDestroyPlayer = () => {
    try {
      if (playerRef.current) {
        // Set loading to false when destroying player
        setIsLoading(false);
        setLoadError(null);

        // First unload the source to stop any in-progress fetches
        if (videoRef.current) {
          // Remove src attribute and force a load to clear any pending requests
          videoRef.current.removeAttribute('src');
          videoRef.current.load();
        }

        // Pause the player first
        try {
          playerRef.current.pause();
        } catch (e) {
          // Ignore pause errors
        }

        // Use a try-catch block specifically for the destroy call
        try {
          playerRef.current.destroy();
        } catch (error) {
          // Ignore expected abort errors
          if (error.name !== 'AbortError' && !error.message?.includes('aborted')) {
            console.log("Error during player destruction:", error.message);
          }
        } finally {
          playerRef.current = null;
        }
      }
    } catch (error) {
      console.log("Error during player cleanup:", error);
      playerRef.current = null;
    }
  };

  useEffect(() => {
    if (!isVisible || !streamUrl) {
      safeDestroyPlayer();
      return;
    }

    // Check if we have an existing player and clean it up
    safeDestroyPlayer();

    // Set loading state to true when starting a new stream
    setIsLoading(true);
    setLoadError(null);

    // Debug log to help diagnose stream issues
    console.log("Attempting to play stream:", streamUrl);

    try {
      // Check for MSE support first
      if (!mpegts.getFeatureList().mseLivePlayback) {
        setIsLoading(false);
        setLoadError("Your browser doesn't support live video streaming. Please try Chrome or Edge.");
        return;
      }

      // Check for basic codec support
      const video = document.createElement('video');
      const h264Support = video.canPlayType('video/mp4; codecs="avc1.42E01E"');
      const aacSupport = video.canPlayType('audio/mp4; codecs="mp4a.40.2"');

      console.log("Browser codec support - H264:", h264Support, "AAC:", aacSupport);

      // If the browser supports MSE for live playback, initialize mpegts.js
      setIsLoading(true);

      const player = mpegts.createPlayer({
        type: 'mpegts',
        url: streamUrl,
        isLive: true,
        enableWorker: true,
        enableStashBuffer: false,
        liveBufferLatencyChasing: true,
        liveSync: true,
        cors: true,
        autoCleanupSourceBuffer: true,
        autoCleanupMaxBackwardDuration: 10,
        autoCleanupMinBackwardDuration: 5,
        reuseRedirectedURL: true,
      });

      player.attachMediaElement(videoRef.current);

      // Add events to track loading state
      player.on(mpegts.Events.LOADING_COMPLETE, () => {
        setIsLoading(false);
      });

      player.on(mpegts.Events.METADATA_ARRIVED, () => {
        setIsLoading(false);
      });

      // Enhanced error event handler with codec-specific messages
      player.on(mpegts.Events.ERROR, (errorType, errorDetail) => {
        setIsLoading(false);

        // Filter out aborted errors
        if (errorType !== 'NetworkError' || !errorDetail?.includes('aborted')) {
          console.error('Player error:', errorType, errorDetail);

          // Provide specific error messages based on error type
          let errorMessage = `Error: ${errorType}`;

          if (errorType === 'MediaError') {
            // Try to determine if it's an audio or video codec issue
            const errorString = errorDetail?.toLowerCase() || '';

            if (errorString.includes('audio') || errorString.includes('ac3') || errorString.includes('ac-3')) {
              errorMessage = "Audio codec not supported by your browser. Try Chrome or Edge for better audio codec support.";
            } else if (errorString.includes('video') || errorString.includes('h264') || errorString.includes('h.264')) {
              errorMessage = "Video codec not supported by your browser. Try Chrome or Edge for better video codec support.";
            } else if (errorString.includes('mse')) {
              errorMessage = "Your browser doesn't support the codecs used in this stream. Try Chrome or Edge for better compatibility.";
            } else {
              errorMessage = "Media codec not supported by your browser. This may be due to unsupported audio (AC3) or video codecs. Try Chrome or Edge.";
            }
          } else if (errorDetail) {
            errorMessage += ` - ${errorDetail}`;
          }

          setLoadError(errorMessage);
        }
      });

      player.load();

      // Don't auto-play until we've loaded properly
      player.on(mpegts.Events.MEDIA_INFO, () => {
        setIsLoading(false);
        try {
          player.play().catch(e => {
            console.log("Auto-play prevented:", e);
            setLoadError("Auto-play was prevented. Click play to start.");
          });
        } catch (e) {
          console.log("Error during play:", e);
          setLoadError(`Playback error: ${e.message}`);
        }
      });

      // Store player instance so we can clean up later
      playerRef.current = player;
    } catch (error) {
      setIsLoading(false);
      console.error("Error initializing player:", error);

      // Provide helpful error message based on the error
      if (error.message?.includes('codec') || error.message?.includes('format')) {
        setLoadError("Codec not supported by your browser. Please try a different browser (Chrome/Edge recommended).");
      } else {
        setLoadError(`Initialization error: ${error.message}`);
      }
    }

    // Cleanup when component unmounts or streamUrl changes
    return () => {
      safeDestroyPlayer();
    };
  }, [isVisible, streamUrl]);

  // Modified hideVideo handler to clean up player first
  const handleClose = (e) => {
    // Prevent event propagation to avoid triggering drag events
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    safeDestroyPlayer();
    // Small delay before hiding the video component to ensure cleanup is complete
    setTimeout(() => {
      hideVideo();
    }, 50);
  };

  // If the floating video is hidden or no URL is selected, do not render
  if (!isVisible || !streamUrl) {
    return null;
  }

  return (
    <Draggable nodeRef={videoContainerRef}>
      <div
        ref={videoContainerRef}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '320px',
          zIndex: 9999,
          backgroundColor: '#333',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 2px 10px rgba(0,0,0,0.7)',
        }}
      >
        {/* Simple header row with a close button */}
        <Flex
          justify="flex-end"
          style={{
            padding: 3
          }}
        >
          <CloseButton
            onClick={handleClose}
            onTouchEnd={handleClose}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{
              minHeight: '32px',
              minWidth: '32px',
              cursor: 'pointer',
              touchAction: 'manipulation'
            }}
          />
        </Flex>

        {/* Video container with relative positioning for the overlay */}
        <Box style={{ position: 'relative' }}>
          {/* The <video> element used by mpegts.js */}
          <video
            ref={videoRef}
            controls
            style={{ width: '100%', height: '180px', backgroundColor: '#000' }}
          />

          {/* Loading overlay - only show when loading */}
          {isLoading && (
            <Box
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 5,
              }}
            >
              <Loader color="cyan" size="md" />
              <Text color="white" size="sm" mt={10}>
                Loading stream...
              </Text>
            </Box>
          )}
        </Box>

        {/* Error message below video - doesn't block controls */}
        {!isLoading && loadError && (
          <Box
            style={{
              padding: '10px',
              backgroundColor: '#2d1b2e',
              borderTop: '1px solid #444',
            }}
          >
            <Text color="red" size="xs" style={{ textAlign: 'center' }}>
              {loadError}
            </Text>
          </Box>
        )}
      </div>
    </Draggable>
  );
}
