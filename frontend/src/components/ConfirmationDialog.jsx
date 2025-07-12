import { Modal, Group, Text, Button, Checkbox, Box } from '@mantine/core';
import React, { useState } from 'react';
import useWarningsStore from '../store/warnings';

/**
 * A reusable confirmation dialog with option to suppress future warnings
 *
 * @param {Object} props - Component props
 * @param {boolean} props.opened - Whether the dialog is visible
 * @param {Function} props.onClose - Function to call when closing without confirming
 * @param {Function} props.onConfirm - Function to call when confirming the action
 * @param {string} props.title - Dialog title
 * @param {string} props.message - Dialog message
 * @param {string} props.confirmLabel - Text for the confirm button
 * @param {string} props.cancelLabel - Text for the cancel button
 * @param {string} props.actionKey - Unique key for this type of action (used for suppression)
 * @param {Function} props.onSuppressChange - Called when "don't show again" option changes
 * @param {string} [props.size='md'] - Size of the modal
 */
const ConfirmationDialog = ({
  opened,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  actionKey,
  onSuppressChange,
  size = 'md', // Add default size parameter - md is a medium width
}) => {
  const suppressWarning = useWarningsStore((s) => s.suppressWarning);
  const isWarningSuppressed = useWarningsStore((s) => s.isWarningSuppressed);
  const [suppressChecked, setSuppressChecked] = useState(
    isWarningSuppressed(actionKey)
  );

  const handleToggleSuppress = (e) => {
    setSuppressChecked(e.currentTarget.checked);
    if (onSuppressChange) {
      onSuppressChange(e.currentTarget.checked);
    }
  };

  const handleConfirm = () => {
    if (suppressChecked) {
      suppressWarning(actionKey);
    }
    onConfirm();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={title} size={size} centered>
      <Box mb={20}>{message}</Box>

      {actionKey && (
        <Checkbox
          label="Don't ask me again"
          checked={suppressChecked}
          onChange={handleToggleSuppress}
          mb={20}
        />
      )}

      <Group justify="flex-end">
        <Button variant="outline" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button color="red" onClick={handleConfirm}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
};

export default ConfirmationDialog;
