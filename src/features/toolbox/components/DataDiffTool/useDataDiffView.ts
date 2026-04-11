import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DiffItem, ParsedFields, TreeNode, UpdateDetail } from './dataDiffTypes';
import {
  INITIAL_DATA_A,
  INITIAL_DATA_B,
  buildUpdateDetails,
  compareDataSources,
  getDiffCounts,
} from './dataDiffViewShared';

export function useDataDiffView() {
  const [dataA, setDataA] = useState(INITIAL_DATA_A);
  const [dataB, setDataB] = useState(INITIAL_DATA_B);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [diffResult, setDiffResult] = useState<DiffItem[]>([]);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [currentFields, setCurrentFields] = useState<ParsedFields | null>(null);
  const [originalDataA, setOriginalDataA] = useState<Record<string, unknown>[]>([]);
  const [originalDataB, setOriginalDataB] = useState<Record<string, unknown>[]>([]);
  const [updateDetails, setUpdateDetails] = useState<UpdateDetail[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!showModal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  const handleCompare = useCallback(() => {
    setError(null);

    try {
      const result = compareDataSources(dataA, dataB);
      setOriginalDataA(result.originalDataA);
      setOriginalDataB(result.originalDataB);
      setCurrentFields(result.fields);
      setDiffResult(result.diffResult);
      setTreeData(result.treeData);
      setShowResult(true);
    } catch (err) {
      setError('处理失败: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [dataA, dataB]);

  const handleClear = useCallback(() => {
    setDataA('');
    setDataB('');
    setError(null);
  }, []);

  const handleBackToInput = useCallback(() => {
    setShowResult(false);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleUpdateClick = useCallback(
    (id: string) => {
      const details = buildUpdateDetails({
        currentFields,
        id,
        originalDataA,
        originalDataB,
      });

      if (!details) {
        return;
      }

      setUpdateDetails(details);
      setShowModal(true);
    },
    [currentFields, originalDataA, originalDataB]
  );

  const counts = useMemo(() => getDiffCounts(diffResult), [diffResult]);

  return {
    closeModal,
    counts,
    currentFields,
    dataA,
    dataB,
    error,
    handleBackToInput,
    handleClear,
    handleCompare,
    handleUpdateClick,
    setDataA,
    setDataB,
    setShowDiffOnly,
    showDiffOnly,
    showModal,
    showResult,
    treeData,
    updateDetails,
  };
}
