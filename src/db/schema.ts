import type Dexie from 'dexie';

export function registerDatabaseSchema(db: Dexie) {
  db.version(1).stores({
    links: 'id, category, name',
    jobs: 'url, name, env',
    settings: 'key',
    tags: 'id, &name',
    jobTags: '[jobUrl+tagId], jobUrl, tagId',
    linkTags: '[linkId+tagId], linkId, tagId',
    linkStats: 'id, usageCount, lastUsedAt',
    myBuilds: 'id, timestamp, env',
    othersBuilds: 'id, timestamp, env',
    hotNews: 'date',
    recordings: '&id, createdAt, url',
    blackboard: 'id, createdAt, pinned',
    operations: 'id, table, type, synced, timestamp',
    syncMetadata: 'id',
    deferred_ops: '++id, table, timestamp',
  });

  db.version(2).stores({
    aiSessions: 'id, createdAt, updatedAt',
    aiMessages: 'id, sessionId, createdAt',
  });

  db.version(3).stores({
    remoteActivityLog: 'id, clientId, table, type, timestamp, receivedAt',
  });

  db.version(4).stores({
    aiMessages: 'id, sessionId, createdAt, toolCallId',
  });

  // v5: 占位版本(与 v4 索引一致)
  // 保留此声明以兼容已升级到 v5 的用户数据库。
  // 删除会导致 Dexie 跳过该版本号,虽然不影响索引,但保留更稳妥。
  // 若未来需要在此版本做数据迁移,可添加 upgrade() 函数。
  db.version(5).stores({
    aiMessages: 'id, sessionId, createdAt, toolCallId',
  });

  // v6: 为软删除字段加索引,优化"查活跃记录"查询
  //
  // 迁移说明:本次变更仅新增索引声明,无需数据迁移。
  // Dexie 会在升级时自动为现有数据构建索引,不影响已有记录。
  //
  // 现有查询仍使用 `filter((x) => !x.deletedAt)` 全表扫描,保持向后兼容。
  // 后续可优化为 `where('deletedAt').equals(undefined)` 走索引,
  // 但需注意 Dexie 对 undefined 索引值的处理行为,建议在大量数据场景下验证后切换。
  //
  // 注意:operations 表的 synced 索引在 v1 已存在,此处保持不变。
  db.version(6).stores({
    links: 'id, category, name, deletedAt',
    tags: 'id, &name, deletedAt',
    jobTags: '[jobUrl+tagId], jobUrl, tagId, deletedAt',
    linkTags: '[linkId+tagId], linkId, tagId, deletedAt',
    operations: 'id, table, type, synced, timestamp',
  });

  // v7: 本地 TOTP 验证器账户（不同步）
  db.version(7).stores({
    totpAccounts: 'id, label, issuer, createdAt',
  });

  // v8: TOTP 手动排序
  db.version(8)
    .stores({
      totpAccounts: 'id, sortOrder, label, issuer, createdAt',
    })
    .upgrade(async (tx) => {
      const table = tx.table('totpAccounts');
      const items = await table.toArray();
      items.sort(
        (a, b) =>
          ((a.sortOrder as number | undefined) ?? (a.createdAt as number)) -
          ((b.sortOrder as number | undefined) ?? (b.createdAt as number))
      );
      await Promise.all(
        items.map((item, index) =>
          table.update(item.id as string, {
            sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : index,
          })
        )
      );
    });

  // v9: TOTP 纳入个人密钥同步，支持软删除
  db.version(9).stores({
    totpAccounts: 'id, sortOrder, label, issuer, createdAt, deletedAt',
  });

  // v10: TOTP 本地排序（仅本地，不参与同步）
  // 拖动排序只写此表，不再更新 totpAccounts.sortOrder，避免产生上传记录。
  db.version(10).stores({
    totpLocalOrder: 'key',
  });

  // v11: 持久化记录同步操作失败后的恢复队列。
  db.version(11).stores({
    syncRecoveryOps: 'id, timestamp',
  });

  // v12: multiple user-managed AI profiles for non-OpenCode providers.
  db.version(12).stores({
    aiProfiles: 'id, provider, updatedAt',
  });

  db.version(13).stores({
    testCases: '&id, createdAt, updatedAt, enabled',
    testRuns: '&id, testCaseId, startedAt, status',
  });

  db.version(14).stores({
    browserTasks: 'taskId, sessionId, updatedAt',
  });

  db.version(15).stores({
    aiPlans: 'id, [ownerType+ownerId], updatedAt',
  });

  db.version(16)
    .stores({
      browserTasks:
        'taskId, sessionId, toolCallId, ownerKey, status, idempotencyKey, createdAt, updatedAt, leaseExpiresAt',
    })
    .upgrade(async (tx) => {
      const table = tx.table('browserTasks');
      const records = await table.toArray();
      await Promise.all(
        records.map((record) => {
          const summary = record.summary as {
            sessionId?: string;
            toolCallId?: string;
            status?: string;
            createdAt?: number;
            updatedAt?: number;
          };
          const updatedAt =
            typeof record.updatedAt === 'number'
              ? record.updatedAt
              : typeof summary.updatedAt === 'number'
                ? summary.updatedAt
                : Date.now();
          const createdAt = typeof summary.createdAt === 'number' ? summary.createdAt : updatedAt;
          const status =
            summary.status === 'queued' ||
            summary.status === 'running' ||
            summary.status === 'waiting_user' ||
            summary.status === 'completed' ||
            summary.status === 'failed' ||
            summary.status === 'stopped'
              ? summary.status
              : 'stopped';
          return table.update(record.taskId as string, {
            sessionId: record.sessionId ?? summary.sessionId,
            toolCallId: summary.toolCallId,
            ownerKey: record.sessionId ?? summary.sessionId,
            status,
            idempotencyKey:
              summary.sessionId && summary.toolCallId
                ? `${summary.sessionId}:${summary.toolCallId}`
                : undefined,
            createdAt,
            updatedAt,
            summary: {
              ...record.summary,
              status,
              createdAt,
              updatedAt,
            },
          });
        })
      );
    });

  // v17: 先归档旧测试功能数据，再移除旧功能入口。
  db.version(17)
    .stores({
      testCases: '&id, createdAt, updatedAt, enabled',
      testRuns: '&id, testCaseId, startedAt, status',
      legacyTestCases: '&id, createdAt, updatedAt, enabled',
      legacyTestRuns: '&id, testCaseId, aiSessionId, startedAt, status',
    })
    .upgrade(async (tx) => {
      const legacyTestCases = await tx.table('testCases').toArray();
      const legacyTestRuns = await tx.table('testRuns').toArray();
      if (legacyTestCases.length > 0) {
        await tx.table('legacyTestCases').bulkPut(legacyTestCases);
      }
      if (legacyTestRuns.length > 0) {
        await tx.table('legacyTestRuns').bulkPut(legacyTestRuns);
      }
      await tx.table('settings').delete('feature_testing_enabled');
    });

  // v18: 加密的团队测试用例物料和执行记录。
  db.version(18)
    .stores({
      testCases: null,
      materials: '&id, type, status, updatedAt, deletedAt',
      testRuns: '&id, testCaseMaterialId, status, startedAt, updatedAt, deletedAt',
    })
    .upgrade(async (tx) => {
      // v17 已将旧记录复制到 legacy* 表；清空同名旧表，避免新代码读取旧结构。
      await tx.table('testRuns').clear();
    });

  // v19: 持久化分片，支持跨分页、重启和失败重试后的重组。
  db.version(19).stores({
    syncChunks: 'id, operationId, [operationId+chunkIndex], receivedAt',
  });

  // v20: 按 timestamp 排序后再应用跨分页同步操作，支持崩溃恢复。
  db.version(20).stores({
    syncApplyQueue: 'id, timestamp',
  });

  // v21: 保留已升级数据库的版本号；实际故障由同步事务作用域修复。
  db.version(21).stores({});

  // v22: 持久化测试执行与 AI 会话的归属，支持刷新后恢复停止操作。
  db.version(22).stores({
    testRuns: '&id, testCaseMaterialId, sessionId, status, startedAt, updatedAt, deletedAt',
  });

  // v23: indexes used by bounded list queries.
  db.version(23).stores({
    tags: 'id, &name, deletedAt, updatedAt',
    blackboard: 'id, createdAt, pinned, updatedAt, deletedAt',
  });

  // v24: local shortcuts for recently completed user actions.
  db.version(24).stores({
    recentActions: 'id, type, lastUsedAt',
  });
}
