import { useOptionsDataManagement } from './useOptionsDataManagement';
import { useOptionsSettings } from './useOptionsSettings';

export function useOptionsPage() {
  const {
    accessToken,
    autoSync,
    customConfig,
    featureToggles,
    lastSyncTime,
    saveDataSourceConfig,
    selectedCategories,
    setAccessToken,
    setAutoSync,
    setCustomConfig,
    setSelectedCategories,
    setShowExportDialog,
    showExportDialog,
    toggleFeature,
  } = useOptionsSettings();

  const { clearData, handleExport, handleSelectFile, rebuildLocalData } = useOptionsDataManagement({
    selectedCategories,
    setShowExportDialog,
  });

  return {
    accessToken,
    autoSync,
    clearData,
    customConfig,
    featureToggles,
    handleExport,
    handleSelectFile,
    lastSyncTime,
    rebuildLocalData,
    saveDataSourceConfig,
    selectedCategories,
    setAccessToken,
    setAutoSync,
    setCustomConfig,
    setSelectedCategories,
    setShowExportDialog,
    showExportDialog,
    toggleFeature,
  };
}
