import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { db } from '@/db';
import { decryptData, loadKey } from '@/lib/crypto/encryption';
import { logger } from '@/utils/logger';
import type { DebugOperation, DecryptedDebugOperation } from './debugTypes';

export function useDebugOperations() {
  const { toast } = useToast();
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [ops, setOps] = useState<DebugOperation[]>([]);
  const [decryptedOps, setDecryptedOps] = useState<DecryptedDebugOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const loadOps = async () => {
    const operations = (await db.table('operations').toArray()) as DebugOperation[];
    setOps(operations);
  };

  useEffect(() => {
    void loadKey().then(setKey);
    void loadOps();
  }, []);

  const decryptAll = async () => {
    if (!key) {
      toast('No encryption key available', 'error');
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.all(
        ops.map(async (op): Promise<DecryptedDebugOperation> => {
          try {
            if (op.table === 'encrypted' && isEncryptedPayload(op.payload)) {
              const decrypted = await decryptData(op.payload, key);
              return {
                ...op,
                decryptedPayload: decrypted,
                status: 'success',
              };
            }

            return {
              ...op,
              decryptedPayload: op.payload,
              status: 'plain',
            };
          } catch (error) {
            return {
              ...op,
              error: error instanceof Error ? error.message : String(error),
              status: 'error',
            };
          }
        })
      );

      setDecryptedOps(results);
      toast('Decryption complete', 'success');
    } catch (error) {
      logger.error('Decryption failed:', error);
      toast('Decryption failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredOps = useMemo(
    () =>
      decryptedOps.filter((op) => JSON.stringify(op).toLowerCase().includes(filter.toLowerCase())),
    [decryptedOps, filter]
  );

  return {
    key,
    ops,
    decryptedOps,
    filteredOps,
    loading,
    filter,
    setFilter,
    loadOps,
    decryptAll,
  };
}

function isEncryptedPayload(payload: unknown): payload is { ciphertext: string; iv: string } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'ciphertext' in payload &&
    'iv' in payload &&
    typeof payload.ciphertext === 'string' &&
    typeof payload.iv === 'string'
  );
}
