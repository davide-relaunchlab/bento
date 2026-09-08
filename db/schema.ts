import { sqliteTable, text, integer, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const workbooks = sqliteTable('workbooks', {
  id: text('id').primaryKey(), docId: text('doc_id').notNull(), title: text('title').notNull(),
  format: text('format', { enum: ['bento/dash', 'bento/slides', 'bento/type'] }).notNull().default('bento/dash'),
  folderId: text('folder_id').references(() => folders.id),
  ownerId: text('owner_id').notNull(), revision: integer('revision').notNull().default(0),
  aclVersion: integer('acl_version').notNull().default(0), contentKey: text('content_key').notNull(),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
});
export const members = sqliteTable('members', {
  id: text('id').primaryKey(), workbookId: text('workbook_id').notNull().references(() => workbooks.id),
  userId: text('user_id'), email: text('email').notNull(), displayName: text('display_name').notNull(),
  role: text('role', { enum: ['owner', 'editor', 'viewer'] }).notNull(), createdAt: integer('created_at').notNull(),
}, t => [uniqueIndex('members_workbook_email').on(t.workbookId,t.email),index('members_user').on(t.userId)]);
export const changes = sqliteTable('changes', {
  workbookId: text('workbook_id').notNull().references(() => workbooks.id), revision: integer('revision').notNull(),
  id: text('id').notNull(), operationId: text('operation_id').notNull(), requestHash: text('request_hash').notNull(),
  contentKey: text('content_key').notNull(), preparedKey: text('prepared_key'),
  actorId: text('actor_id').notNull(), actorName: text('actor_name').notNull(), actorKind: text('actor_kind').notNull(),
  summary: text('summary').notNull(), kind: text('kind').notNull(), relatedId: text('related_id'), createdAt: integer('created_at').notNull(),
}, t => [primaryKey({columns:[t.workbookId,t.revision]}),uniqueIndex('changes_operation').on(t.workbookId,t.operationId),uniqueIndex('changes_id').on(t.workbookId,t.id)]);
export const proposals = sqliteTable('proposals', {
  id: text('id').primaryKey(), workbookId: text('workbook_id').notNull().references(() => workbooks.id),
  operationId: text('operation_id').notNull(), requestHash: text('request_hash').notNull(), baseRevision: integer('base_revision').notNull(),
  preparedKey: text('prepared_key').notNull(), actorId: text('actor_id').notNull(), actorName: text('actor_name').notNull(), actorKind: text('actor_kind').notNull(),
  summary: text('summary').notNull(), status: text('status',{enum:['pending','accepted','rejected']}).notNull().default('pending'),
  decisionBy: text('decision_by'), changeId: text('change_id'), createdAt: integer('created_at').notNull(), decidedAt: integer('decided_at'),
}, t=>[uniqueIndex('proposals_operation').on(t.workbookId,t.operationId),index('proposals_workbook').on(t.workbookId,t.createdAt)]);
export const agentTokens = sqliteTable('agent_tokens', {
  id: text('id').primaryKey(), workbookId: text('workbook_id').notNull().references(() => workbooks.id),
  creatorId: text('creator_id').notNull(), name: text('name').notNull(), tokenHash: text('token_hash').notNull(),
  permission: text('permission',{enum:['read','propose','write']}).notNull(), expiresAt: integer('expires_at').notNull(),
  revokedAt: integer('revoked_at'), createdAt: integer('created_at').notNull(),
}, t=>[uniqueIndex('tokens_hash').on(t.tokenHash),index('tokens_workbook').on(t.workbookId)]);

export const folders=sqliteTable('folders',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),ownerName:text('owner_name').notNull(),name:text('name').notNull(),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull(),
},t=>[index('folders_owner').on(t.ownerId)]);
export const folderMembers=sqliteTable('folder_members',{
 id:text('id').primaryKey(),folderId:text('folder_id').notNull().references(()=>folders.id),userId:text('user_id'),email:text('email').notNull(),displayName:text('display_name').notNull(),role:text('role',{enum:['editor','viewer']}).notNull(),createdAt:integer('created_at').notNull(),
},t=>[uniqueIndex('folder_members_email').on(t.folderId,t.email),index('folder_members_user').on(t.userId)]);
