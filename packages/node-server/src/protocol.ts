import { z } from 'zod';

export const SyncChunkPayloadSchema = z.object({
  kind: z.literal('chunk-v1'),
  operationId: z.string().min(1).max(256),
  chunkIndex: z.number().int().nonnegative(),
  chunkTotal: z.number().int().positive().max(10_000),
  iv: z.string().min(1).max(3000),
  ciphertext: z.string().min(1).max(3000),
  ciphertextHash: z.string().min(1).max(3000),
  clientId: z.string().min(1).max(256),
});

const EncryptedPayloadSchema = z.object({
  iv: z.string().min(1).max(3000),
  ciphertext: z.string().min(1).max(3000),
});

export const OperationSchema = z
  .object({
    id: z.string().min(1),
    clientId: z.string().optional(),
    table: z.string().min(1),
    type: z.enum(['create', 'update', 'delete']),
    key: z.unknown(),
    keyHash: z.string().optional(),
    payload: z.unknown().optional(),
    timestamp: z.number(),
    serverTimestamp: z.number().optional(),
  })
  .superRefine((operation, context) => {
    if (operation.table !== 'encrypted' && operation.table !== '__sync_chunk__') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Unencrypted sync operation rejected',
      });
      return;
    }
    if (operation.table === 'encrypted') {
      if (
        operation.type !== 'create' ||
        !EncryptedPayloadSchema.safeParse(operation.payload).success
      ) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid encrypted operation' });
      }
      return;
    }
    const result = SyncChunkPayloadSchema.safeParse(operation.payload);
    if (!result.success) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid sync chunk payload' });
      return;
    }
    if (
      operation.type !== 'create' ||
      result.data.operationId !== operation.key ||
      result.data.chunkIndex >= result.data.chunkTotal ||
      !operation.keyHash ||
      JSON.stringify(result.data).length > 3000
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid sync chunk metadata' });
    }
    if (operation.clientId && operation.clientId !== result.data.clientId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Sync chunk clientId mismatch' });
    }
    if (JSON.stringify(result.data).length > 3000) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Sync chunk payload is too large' });
    }
  });

export type SyncOperation = z.infer<typeof OperationSchema>;
