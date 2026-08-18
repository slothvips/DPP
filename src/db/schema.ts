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
}
