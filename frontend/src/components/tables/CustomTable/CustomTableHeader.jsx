import { Box, Center, Checkbox, Flex } from '@mantine/core';
import { flexRender } from '@tanstack/react-table';
import { useCallback } from 'react';

const CustomTableHeader = ({
  getHeaderGroups,
  allRowIds,
  selectedTableIds,
  headerCellRenderFns,
  onSelectAllChange,
  tableCellProps,
}) => {
  const renderHeaderCell = (header) => {
    if (headerCellRenderFns[header.id]) {
      return headerCellRenderFns[header.id](header);
    }

    switch (header.id) {
      case 'select':
        return (
          <Center style={{ width: '100%' }}>
            <Checkbox
              size="xs"
              checked={
                allRowIds.length == 0
                  ? false
                  : selectedTableIds.length == allRowIds.length
              }
              indeterminate={
                selectedTableIds.length > 0 &&
                selectedTableIds.length !== allRowIds.length
              }
              onChange={onSelectAllChange}
            />
          </Center>
        );

      default:
        return flexRender(header.column.columnDef.header, header.getContext());
    }
  };

  return (
    <Box
      className="thead"
      style={{
        position: 'sticky',
        top: 0,
        backgroundColor: '#3E3E45',
        zIndex: 10,
      }}
    >
      {getHeaderGroups().map((headerGroup) => (
        <Box
          className="tr"
          key={headerGroup.id}
          style={{ display: 'flex', width: '100%' }}
        >
          {headerGroup.headers.map((header) => {
            return (
              <Box
                className="th"
                key={header.id}
                style={{
                  flex: header.column.columnDef.size ? '0 0 auto' : '1 1 0',
                  width: header.column.columnDef.size
                    ? header.getSize()
                    : undefined,
                  minWidth: 0,
                  // ...(tableCellProps && tableCellProps({ cell: header })),
                }}
              >
                <Flex
                  align="center"
                  style={{
                    ...(header.column.columnDef.style &&
                      header.column.columnDef.style),
                    height: '100%',
                  }}
                >
                  {renderHeaderCell(header)}
                </Flex>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
};

export default CustomTableHeader;
