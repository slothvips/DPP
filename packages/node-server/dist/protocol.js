import { z } from 'zod';

export const SyncChunkPayloadSchema = z.object({
  kind: z.literal('chunk-v1'),
  operationId: z.string().min(1),
  chunkIndex: z.number().int().nonnegative(),
  chunkTotal: z.number().int().positive(),
  iv: z.string().min(1),
  ciphertext: z.string().min(1),
  ciphertextHash: z.string().min(1),
  clientId: z.string().min(1),
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
    if (operation.table !== '__sync_chunk__') return;
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
  });
