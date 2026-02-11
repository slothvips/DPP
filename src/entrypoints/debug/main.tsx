import 'virtual:uno.css';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { db } from '@/db';
import { useTheme } from '@/hooks/useTheme';
import { decryptData, loadKey } from '@/lib/crypto/encryption';
import '@unocss/reset/tailwind.css';

interface EncryptedOp {
  id: string;
  table: string;
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  timestamp: number;
}

function DebugApp() {
  useTheme();
  const { toast } = useToast();
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [ops, setOps] = useState<EncryptedOp[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [decryptedOps, setDecryptedOps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadKey().then(setKey);
    loadOps();
  }, []);

  const loadOps = async () => {
    const operations = await db.table('operations').toArray();
    setOps(operations);
  };

  const decryptAll = async () => {
    if (!key) {
      toast('No encryption key available', 'error');
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.all(
        ops.map(async (op) => {
          try {
            if (op.table === 'encrypted' && op.payload?.ciphertext) {
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
          } catch (e) {
            return {
              ...op,
              error: e instanceof Error ? e.message : String(e),
              status: 'error',
            };
          }
        })
      );
      setDecryptedOps(results);
      toast('Decryption complete', 'success');
    } catch {
      toast('Decryption failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredOps = decryptedOps.filter((op) =>
    JSON.stringify(op).toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Sync Data Debugger</h1>
          <div className="flex gap-4">
            <Button onClick={loadOps} variant="outline">
              Reload Ops
            </Button>
            <Button onClick={decryptAll} disabled={loading || !key}>
              {loading ? 'Decrypting...' : 'Decrypt All'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 border rounded bg-card">
            <div className="text-sm text-muted-foreground">Total Operations</div>
            <div className="text-2xl font-bold">{ops.length}</div>
          </div>
          <div className="p-4 border rounded bg-card">
            <div className="text-sm text-muted-foreground">Encryption Key</div>
            <div className="text-2xl font-bold text-green-500">{key ? 'Loaded' : 'Missing'}</div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Filter Results</Label>
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search in payload..."
          />
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Table</th>
                <th className="p-3">Type</th>
                <th className="p-3">Status</th>
                <th className="p-3">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredOps.map((op) => (
                <tr key={op.id} className="hover:bg-accent/50">
                  <td className="p-3 font-mono text-xs">{op.id.slice(0, 8)}...</td>
                  <td className="p-3">{op.table}</td>
                  <td className="p-3">{op.type}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        op.status === 'success'
                          ? 'bg-green-100 text-green-800'
                          : op.status === 'error'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {op.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <pre className="max-w-xl overflow-x-auto whitespace-pre-wrap text-xs bg-muted/50 p-2 rounded">
                      {JSON.stringify(op.decryptedPayload || op.payload, null, 2)}
                    </pre>
                    {op.error && <div className="text-red-500 text-xs mt-1">{op.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {decryptedOps.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No decrypted data yet. Click "Decrypt All" to start.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ToastProvider>
        <DebugApp />
      </ToastProvider>
    </React.StrictMode>
  );
}
