import { Box, Flex } from '@mantine/core';
import CustomTableHeader from './CustomTableHeader';
import { useCallback, useState, useRef } from 'react';
import { flexRender } from '@tanstack/react-table';
import table from '../../../helpers/table';
import CustomTableBody from './CustomTableBody';
import useLocalStorage from '../../../hooks/useLocalStorage';

const CustomTable = ({ table }) => {
  const [tableSize, _] = useLocalStorage('table-size', 'default');

  return (
    <Box
      className={`divTable table-striped table-size-${tableSize}`}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CustomTableHeader
        filters={table.filters}
        getHeaderGroups={table.getHeaderGroups}
        allRowIds={table.allRowIds}
        headerCellRenderFns={table.headerCellRenderFns}
        onSelectAllChange={
          table.onSelectAllChange ? table.onSelectAllChange : null
        }
        selectedTableIds={table.selectedTableIds}
        tableCellProps={table.tableCellProps}
      />
      <CustomTableBody
        getRowModel={table.getRowModel}
        bodyCellRenderFns={table.bodyCellRenderFns}
        expandedRowIds={table.expandedRowIds}
        expandedRowRenderer={table.expandedRowRenderer}
        renderBodyCell={table.renderBodyCell}
        getExpandedRowHeight={table.getExpandedRowHeight}
        getRowStyles={table.getRowStyles} // Pass the getRowStyles function
        tableBodyProps={table.tableBodyProps}
        tableCellProps={table.tableCellProps}
      />
    </Box>
  );
};

export default CustomTable;
