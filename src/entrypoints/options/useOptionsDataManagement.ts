import type { Dispatch, SetStateAction } from 'react';
import { useOptionsExport } from './useOptionsExport';
import { useOptionsImportAndReset } from './useOptionsImportAndReset';

interface UseOptionsDataManagementOptions {
  selectedCategories: string[];
  setShowExportDialog: Dispatch<SetStateAction<boolean>>;
}

export function useOptionsDataManagement({
  selectedCategories,
  setShowExportDialog,
}: UseOptionsDataManagementOptions) {
  const { handleExport } = useOptionsExport({
    selectedCategories,
    setShowExportDialog,
  });
  const {
    clearData,
    handleImport,
    handleSelectFile,
    rebuildPhase,
    rebuildLocalData,
    selectedImportCategories,
    setSelectedImportCategories,
    setShowImportDialog,
    showImportDialog,
  } = useOptionsImportAndReset();

  return {
    clearData,
    handleExport,
    handleImport,
    handleSelectFile,
    rebuildPhase,
    rebuildLocalData,
    selectedImportCategories,
    setSelectedImportCategories,
    setShowImportDialog,
    showImportDialog,
  };
}
