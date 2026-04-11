import type { DecryptedDebugOperation } from './debugTypes';

interface DebugOperationsTableProps {
  operations: DecryptedDebugOperation[];
}

export function DebugOperationsTable({ operations }: DebugOperationsTableProps) {
  return (
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
          {operations.map((op) => (
            <tr key={op.id} className="hover:bg-accent/50">
              <td className="p-3 font-mono text-xs">{op.id.slice(0, 8)}...</td>
              <td className="p-3">{op.table}</td>
              <td className="p-3">{op.type}</td>
              <td className="p-3">
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    op.status === 'success'
                      ? 'bg-success/20 text-success'
                      : op.status === 'error'
                        ? 'bg-destructive/20 text-destructive'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {op.status}
                </span>
              </td>
              <td className="p-3">
                <pre className="max-w-xl overflow-x-auto whitespace-pre-wrap text-xs bg-muted/50 p-2 rounded">
                  {JSON.stringify(op.decryptedPayload || op.payload, null, 2)}
                </pre>
                {op.error && <div className="text-destructive text-xs mt-1">{op.error}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {operations.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          No decrypted data yet. Click "Decrypt All" to start.
        </div>
      )}
    </div>
  );
}
