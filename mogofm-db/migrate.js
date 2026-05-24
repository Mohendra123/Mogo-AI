#!/usr/bin/env node
'use strict';

/**
 * Supabase (PostgreSQL) -> PocketBase migration script
 * ---------------------------------------------------
 * CommonJS entrypoint with dynamic imports for ESM-friendly dependencies.
 * Uses a two-pass strategy:
 *  - Pass 1: insert/update records and keep FK raw values in temporary fields.
 *  - Pass 2: resolve FK raw values to PocketBase relation IDs.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ordhgyuqatgagldlsyul.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZGhneXVxYXRnYWdsZGxzeXVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjM1MTAzMywiZXhwIjoyMDg3OTI3MDMzfQ.Q4Xs_OHDkBoez9yd7rtasa-D-_iR1w798KMPk8pWnnc';
const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const POCKETBASE_ADMIN_EMAIL =
  process.env.POCKETBASE_ADMIN_EMAIL || 'officialmogofm@gmail.com';
const POCKETBASE_ADMIN_PASSWORD =
  process.env.POCKETBASE_ADMIN_PASSWORD || 'Mogofmofficial@1234';

const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || 'public';
const BATCH_SIZE = Number(process.env.MIGRATION_BATCH_SIZE || 1000);
const POCKETBASE_PAGE_SIZE = Number(process.env.POCKETBASE_PAGE_SIZE || 200);

/**
 * Keep parent tables first.
 * Add all your tables here in dependency order.
 */
const TABLES = [// 1. Core / Parent Tables (Inpar doosri tables depend karti hain)
  'User data',
  'admin_campaigns',
  'app_banners',
'app_configs',
'comments',
'episodes_MogoFM',
'promo_codes',
'series_content_MogoFm',
'series_ratings',
'store_ad_packs',
'store_coin_packs',
'store_limited_offers',
'store_subscriptions',
'transactions',
'unlocked_content',
'user_notifications',
'user_unlocked_episodes',
'watch_history',
];

// Explicit source table -> PocketBase collection mapping.
const TABLE_COLLECTION_OVERRIDES = {
  'User data': 'user_data',
  episodes_MogoFM: 'episodes_mogofm',
  comments: 'comments_data',
  store_subscriptions: 'store_subscriptions_data',
};

/**
 * Optional manual FK overrides/additions.
 * Useful if information_schema access is restricted.
 *
 * Example:
 * user_data: [
 *   { column: 'episode_id', references: { table: 'episodes_MogoFM', column: 'id' } }
 * ]
 */
const MANUAL_FOREIGN_KEYS = {
  // episodes_MogoFM: [],
  // series_content: [],
  // user_data: [],
};

/**
 * Optional manual columns fallback (used if information_schema + REST metadata are restricted).
 * Example:
 * MANUAL_TABLE_COLUMNS['some_table'] = ['id', 'user_id', 'created_at'];
 */
const MANUAL_TABLE_COLUMNS = {
  comments: [
    'id',
    'user_id',
    'episode_id',
    'series_id',
    'comment',
    'created_at',
    'updated_at',
  ],
  store_subscriptions: [
    'id',
    'user_id',
    'plan_id',
    'subscription_id',
    'status',
    'start_date',
    'end_date',
    'created_at',
    'updated_at',
  ],
  transactions: [
    'id',
    'user_id',
    'pack_id',
    'amount',
    'currency',
    'status',
    'transaction_id',
    'created_at',
    'updated_at',
  ],
  unlocked_content: [
    'id',
    'user_id',
    'content_id',
    'content_type',
    'created_at',
    'updated_at',
  ],
  user_notifications: [
    'id',
    'user_id',
    'title',
    'message',
    'type',
    'is_read',
    'created_at',
    'updated_at',
  ],
};

const FORCE_MANUAL_SCHEMA_TABLES = new Set(['comments', 'store_subscriptions']);

const RESERVED_FIELD_NAMES = new Set([
  'id',
  'created',
  'updated',
  'collectionid',
  'collectionname',
  'expand',
]);

async function main() {
  validateConfig();

  const [{ createClient }, { default: PocketBase }] = await Promise.all([
    import('@supabase/supabase-js'),
    import('pocketbase'),
  ]);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const pocketbase = new PocketBase(POCKETBASE_URL);
  await authenticatePocketBase(pocketbase);

  console.log('Building schema plan...');
  const plansByTable = {};
  const tableToCollectionName = buildTableToCollectionNameMap(TABLES);
  for (const table of TABLES) {
    try {
      plansByTable[table] = await buildTablePlan(
        supabase,
        table,
        SUPABASE_SCHEMA,
        tableToCollectionName,
      );
    } catch (error) {
      console.error(`[PLAN] Failed for table "${table}": ${error.message}`);
    }
  }

  const plannedTables = TABLES.filter((table) => Boolean(plansByTable[table]));
  if (plannedTables.length === 0) {
    throw new Error('No valid table plans were generated; stopping migration.');
  }

  const orderedTables = topologicalSortTables(plannedTables, plansByTable);
  console.log(`Table migration order: ${orderedTables.join(' -> ')}`);

  console.log('\n[STEP] Ensuring PocketBase collections...');
  const collectionsByName = await getCollectionsByName(pocketbase);
  for (const table of orderedTables) {
    const plan = plansByTable[table];
    try {
      const collection = await ensureCollection(pocketbase, plan, collectionsByName);
      collectionsByName.set(collection.name, collection);
    } catch (error) {
      console.error(`[COLLECTION] Failed for "${table}": ${error.message}`);
    }
  }

  console.log('\n[STEP] PASS 1 - Migrating rows...');
  for (const table of orderedTables) {
    const plan = plansByTable[table];
    try {
      await migrateTablePass1(supabase, pocketbase, plan);
    } catch (error) {
      console.error(`[PASS1] Table "${table}" failed: ${error.message}`);
    }
  }

  console.log('\n[STEP] PASS 2 - Resolving relations...');
  for (const table of orderedTables) {
    const plan = plansByTable[table];
    try {
      await resolveRelationsPass2(pocketbase, plan, plansByTable);
    } catch (error) {
      console.error(`[PASS2] Table "${table}" failed: ${error.message}`);
    }
  }

  console.log('\nMigration completed.');
}

function validateConfig() {
  const placeholderValues = [
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    POCKETBASE_ADMIN_EMAIL,
    POCKETBASE_ADMIN_PASSWORD,
  ].filter((value) => value.startsWith('YOUR_'));

  if (placeholderValues.length > 0) {
    throw new Error(
      'Please set credentials at the top of migrate.js or via env vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD).',
    );
  }

  if (!Number.isFinite(BATCH_SIZE) || BATCH_SIZE <= 0) {
    throw new Error('MIGRATION_BATCH_SIZE must be a positive number.');
  }
}

async function authenticatePocketBase(pb) {
  try {
    if (pb.admins && typeof pb.admins.authWithPassword === 'function') {
      await pb.admins.authWithPassword(POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD);
      console.log('PocketBase admin authenticated via pb.admins.');
      return;
    }

    await pb
      .collection('_superusers')
      .authWithPassword(POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD);
    console.log('PocketBase admin authenticated via _superusers collection.');
  } catch (error) {
    throw new Error(`PocketBase authentication failed: ${error.message}`);
  }
}

async function buildTablePlan(supabase, table, schema, tableToCollectionName) {
  const columns = await discoverColumns(supabase, table, schema);
  if (!columns.length) {
    throw new Error(`No columns found for table "${table}".`);
  }

  const primaryKey = await discoverPrimaryKey(supabase, table, schema, columns);
  const autoForeignKeys = await discoverForeignKeys(supabase, table, schema);
  const inferredForeignKeys = inferForeignKeysFromColumnNames(columns, table, TABLES, primaryKey);
  const manualForeignKeys = MANUAL_FOREIGN_KEYS[table] || [];
  const foreignKeys = mergeForeignKeys(
    mergeForeignKeys(autoForeignKeys, inferredForeignKeys),
    manualForeignKeys,
  ).map((fk) => ({
    ...fk,
    references: {
      ...fk.references,
      pbCollection:
        tableToCollectionName.get(fk.references.table) ||
        normalizePocketBaseCollectionName(fk.references.table),
    },
  }));
  const foreignKeyByColumn = new Map(foreignKeys.map((fk) => [fk.column, fk]));

  const usedNames = new Set(['old_id']);
  const columnPlans = [];
  for (const column of columns) {
    if (column.column_name === primaryKey) continue;

    const pbField = toPocketBaseFieldName(column.column_name, usedNames);
    usedNames.add(pbField);

    const fk = foreignKeyByColumn.get(column.column_name);
    const tempOldField = fk ? toPocketBaseFieldName(`${pbField}_old`, usedNames) : null;
    if (tempOldField) usedNames.add(tempOldField);

    columnPlans.push({
      sourceColumn: column.column_name,
      sourceType: column.data_type || inferSqlTypeFromUdt(column.udt_name),
      pbField,
      pbType: mapPostgresTypeToPocketBaseType(column.data_type, column.udt_name),
      isForeignKey: Boolean(fk),
      fk: fk || null,
      fkTempField: tempOldField,
    });
  }

  const pbCollection =
    tableToCollectionName.get(table) || normalizePocketBaseCollectionName(table);

  return {
    table, // Supabase source table name (exact, case-sensitive, can include spaces)
    schema,
    pbCollection, // PocketBase-safe collection name
    primaryKey,
    columnPlans,
    foreignKeys,
  };
}

async function discoverColumns(supabase, table, schema) {
  if (FORCE_MANUAL_SCHEMA_TABLES.has(table) && Array.isArray(MANUAL_TABLE_COLUMNS[table])) {
    return MANUAL_TABLE_COLUMNS[table].map((columnName, index) => ({
      column_name: columnName,
      data_type: 'text',
      udt_name: null,
      is_nullable: 'YES',
      ordinal_position: index + 1,
    }));
  }

  const { data, error } = await supabase
    .schema('information_schema')
    .from('columns')
    .select('column_name,data_type,udt_name,is_nullable,ordinal_position')
    .eq('table_schema', schema)
    .eq('table_name', table)
    .order('ordinal_position', { ascending: true });

  if (!error && Array.isArray(data) && data.length) {
    return data;
  }

  if (error) {
    console.warn(
      `[DISCOVERY] information_schema unavailable for "${table}" (${error.message}). Falling back to REST metadata inference.`,
    );
  } else {
    console.warn(
      `[DISCOVERY] No information_schema rows for "${table}". Falling back to REST metadata inference.`,
    );
  }

  const columnOrder = [];
  const seenColumns = new Set();
  const sampleRows = [];

  const pushColumns = (columns) => {
    for (const col of columns || []) {
      const name = String(col || '').trim();
      if (!name || seenColumns.has(name)) continue;
      seenColumns.add(name);
      columnOrder.push(name);
    }
  };

  const csvRes = await supabase.from(table).select('*').limit(0).csv();
  if (csvRes.error) {
    console.warn(
      `[DISCOVERY] CSV header fallback failed for "${table}" (${csvRes.error.message}). Trying row-key union fallback.`,
    );
  } else {
    const headerLine = String(csvRes.data || '').split('\n')[0] || '';
    pushColumns(parseCsvHeaderLine(headerLine));
  }

  // Union keys from initial rows in case CSV header is incomplete/blocked by permissions.
  const sampleRes = await supabase.from(table).select('*').limit(Math.max(BATCH_SIZE, 200));
  if (!sampleRes.error && Array.isArray(sampleRes.data)) {
    sampleRows.push(...sampleRes.data);
    for (const row of sampleRows) {
      pushColumns(Object.keys(row || {}));
    }
  } else if (sampleRes.error) {
    console.warn(`[DISCOVERY] Sample row fallback failed for "${table}" (${sampleRes.error.message}).`);
  }

  if (!columnOrder.length && Array.isArray(MANUAL_TABLE_COLUMNS[table])) {
    pushColumns(MANUAL_TABLE_COLUMNS[table]);
  }

  if (!columnOrder.length) {
    throw new Error(
      `No columns found for "${table}" via information_schema/CSV/row fallback. Add MANUAL_TABLE_COLUMNS["${table}"].`,
    );
  }

  const firstRow = sampleRows[0] || null;
  return columnOrder.map((columnName, index) => ({
    column_name: columnName,
    data_type: firstRow ? inferSqlTypeFromValue(firstRow[columnName]) : 'text',
    udt_name: null,
    is_nullable: 'YES',
    ordinal_position: index + 1,
  }));
}

async function discoverPrimaryKey(supabase, table, schema, columns) {
  const constraintsRes = await supabase
    .schema('information_schema')
    .from('table_constraints')
    .select('constraint_name')
    .eq('table_schema', schema)
    .eq('table_name', table)
    .eq('constraint_type', 'PRIMARY KEY');

  if (!constraintsRes.error && constraintsRes.data && constraintsRes.data.length) {
    const constraintNames = constraintsRes.data.map((c) => c.constraint_name);
    const keyColumnsRes = await supabase
      .schema('information_schema')
      .from('key_column_usage')
      .select('constraint_name,column_name,ordinal_position')
      .eq('table_schema', schema)
      .eq('table_name', table)
      .in('constraint_name', constraintNames)
      .order('ordinal_position', { ascending: true });

    if (!keyColumnsRes.error && keyColumnsRes.data && keyColumnsRes.data.length) {
      const pk = keyColumnsRes.data[0].column_name;
      if (keyColumnsRes.data.length > 1) {
        console.warn(
          `[DISCOVERY] Table "${table}" has composite PK. Using first PK column "${pk}" as old_id.`,
        );
      }
      return pk;
    }
  }

  if (columns.some((c) => c.column_name === 'id')) return 'id';
  return columns[0].column_name;
}

async function discoverForeignKeys(supabase, table, schema) {
  const tcRes = await supabase
    .schema('information_schema')
    .from('table_constraints')
    .select('constraint_name')
    .eq('table_schema', schema)
    .eq('table_name', table)
    .eq('constraint_type', 'FOREIGN KEY');

  if (tcRes.error || !tcRes.data || !tcRes.data.length) {
    return [];
  }

  const names = tcRes.data.map((row) => row.constraint_name);

  const [kcuRes, ccuRes] = await Promise.all([
    supabase
      .schema('information_schema')
      .from('key_column_usage')
      .select('constraint_name,column_name,ordinal_position')
      .eq('table_schema', schema)
      .eq('table_name', table)
      .in('constraint_name', names)
      .order('ordinal_position', { ascending: true }),
    supabase
      .schema('information_schema')
      .from('constraint_column_usage')
      .select('constraint_name,table_name,column_name,table_schema')
      .in('constraint_name', names),
  ]);

  if (kcuRes.error || ccuRes.error) {
    return [];
  }

  const refsByConstraint = new Map();
  for (const row of ccuRes.data || []) {
    refsByConstraint.set(row.constraint_name, row);
  }

  const fks = [];
  for (const row of kcuRes.data || []) {
    const target = refsByConstraint.get(row.constraint_name);
    if (!target) continue;

    fks.push({
      column: row.column_name,
      references: { table: target.table_name, column: target.column_name },
    });
  }

  return fks;
}

function mergeForeignKeys(autoFKs, manualFKs) {
  const byColumn = new Map();
  for (const fk of autoFKs || []) byColumn.set(fk.column, fk);
  for (const fk of manualFKs || []) byColumn.set(fk.column, fk);
  return Array.from(byColumn.values());
}

function toPocketBaseFieldName(rawName, usedNames) {
  let name = String(rawName || '')
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  if (!name) name = 'field';
  if (/^\d/.test(name)) name = `f_${name}`;
  if (RESERVED_FIELD_NAMES.has(name)) name = `src_${name}`;

  let unique = name;
  let suffix = 1;
  while (usedNames.has(unique)) {
    unique = `${name}_${suffix}`;
    suffix += 1;
  }

  return unique;
}

function normalizePocketBaseCollectionName(rawName) {
  let name = String(rawName || '')
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  if (!name) name = 'collection';
  if (!/^[a-z]/.test(name)) name = `c_${name}`;
  return name;
}

function toPocketBaseCollectionName(rawName, usedNames) {
  const name = normalizePocketBaseCollectionName(rawName);

  let unique = name;
  let suffix = 1;
  while (usedNames.has(unique)) {
    unique = `${name}_${suffix}`;
    suffix += 1;
  }
  usedNames.add(unique);
  return unique;
}

function buildTableToCollectionNameMap(tables) {
  const usedNames = new Set();
  const map = new Map();
  for (const table of tables) {
    const override = TABLE_COLLECTION_OVERRIDES[table];
    if (override) {
      map.set(table, toPocketBaseCollectionName(override, usedNames));
      continue;
    }
    map.set(table, toPocketBaseCollectionName(table, usedNames));
  }
  return map;
}

function inferSqlTypeFromUdt(udtName) {
  if (!udtName) return 'text';
  if (['int2', 'int4', 'int8', 'float4', 'float8', 'numeric'].includes(udtName)) return 'numeric';
  if (udtName === 'bool') return 'boolean';
  if (udtName === 'json' || udtName === 'jsonb') return 'jsonb';
  return 'text';
}

function inferSqlTypeFromValue(value) {
  if (value === null || value === undefined) return 'text';
  if (typeof value === 'number') return 'numeric';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'object') return 'jsonb';
  return 'text';
}

function parseCsvHeaderLine(headerLine) {
  const line = String(headerLine || '').trim();
  if (!line) return [];

  const cols = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      cols.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }
  cols.push(current.trim());
  return cols.filter(Boolean);
}

function normalizeOldId(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toLowerCase();
  return normalized || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inferForeignKeysFromColumnNames(columns, table, allTables, primaryKey) {
  const tableSet = new Set(allTables || []);
  const aliases = {
    user: 'User data',
    users: 'User data',
    userdata: 'User data',
    user_data: 'User data',
  };

  const normalizeToken = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  const normalizedTables = (allTables || []).map((t) => ({
    table: t,
    normalized: normalizeToken(t),
  }));

  const fks = [];
  for (const col of columns || []) {
    const column = col.column_name;
    if (!column || column === primaryKey || !column.toLowerCase().endsWith('_id')) continue;

    const base = column.slice(0, -3);
    const baseNorm = normalizeToken(base);
    if (!baseNorm) continue;

    let target = aliases[baseNorm] || null;
    if (!target || !tableSet.has(target)) {
      const exact = normalizedTables.find((entry) => entry.normalized === baseNorm);
      if (exact) {
        target = exact.table;
      } else {
        const prefix = normalizedTables.find((entry) => entry.normalized.startsWith(baseNorm));
        if (prefix) target = prefix.table;
      }
    }

    if (!target || !tableSet.has(target) || target === table) continue;
    fks.push({
      column,
      references: { table: target, column: 'id' },
    });
  }
  return fks;
}

function mapPostgresTypeToPocketBaseType(dataType, udtName) {
  const normalized = String(dataType || inferSqlTypeFromUdt(udtName)).toLowerCase();

  if (
    normalized.includes('int') ||
    normalized === 'numeric' ||
    normalized === 'decimal' ||
    normalized === 'real' ||
    normalized === 'double precision'
  ) {
    return 'number';
  }
  if (normalized === 'boolean') return 'bool';
  if (normalized === 'json' || normalized === 'jsonb' || normalized.endsWith('[]')) return 'json';
  return 'text';
}

function topologicalSortTables(tables, plansByTable) {
  const deps = new Map();
  const indegree = new Map();

  for (const table of tables) {
    deps.set(table, new Set());
    indegree.set(table, 0);
  }

  for (const table of tables) {
    const plan = plansByTable[table];
    for (const fk of plan.foreignKeys || []) {
      const dep = fk.references.table;
      if (!deps.has(dep) || dep === table) continue;
      if (!deps.get(dep).has(table)) {
        deps.get(dep).add(table);
        indegree.set(table, indegree.get(table) + 1);
      }
    }
  }

  const queue = tables.filter((table) => indegree.get(table) === 0);
  const result = [];

  while (queue.length) {
    const current = queue.shift();
    result.push(current);
    for (const child of deps.get(current) || []) {
      indegree.set(child, indegree.get(child) - 1);
      if (indegree.get(child) === 0) queue.push(child);
    }
  }

  if (result.length !== tables.length) {
    console.warn('[DISCOVERY] FK cycle or unresolved dependency found; using configured TABLES order.');
    return tables.slice();
  }

  return result;
}

async function getCollectionsByName(pb) {
  const byName = new Map();
  const collections = await safeListCollections(pb);
  for (const collection of collections) byName.set(collection.name, collection);
  return byName;
}

async function safeListCollections(pb) {
  try {
    return await pb.collections.getFullList({ requestKey: null });
  } catch (_error) {
    const all = [];
    let page = 1;
    while (true) {
      const list = await pb.collections.getList(page, 200, { requestKey: null });
      all.push(...list.items);
      if (page >= list.totalPages) break;
      page += 1;
    }
    return all;
  }
}

async function ensureCollection(pb, plan, collectionsByName) {
  const existing = collectionsByName.get(plan.pbCollection);
  const desiredFields = buildDesiredFields(plan, collectionsByName);

  if (!existing) {
    const created = await createCollection(pb, plan.pbCollection, desiredFields);
    await syncMissingFields(pb, created, desiredFields);
    const createdFresh = await pb.collections.getOne(created.id, { requestKey: null });
    await ensureOldIdIndex(pb, createdFresh);
    console.log(
      `[COLLECTION] Created "${plan.pbCollection}" (source "${plan.table}") with ${desiredFields.length} fields.`,
    );
    return createdFresh;
  }

  await syncMissingFields(pb, existing, desiredFields);
  await ensureOldIdIndex(pb, existing);
  console.log(
    `[COLLECTION] Exists "${plan.pbCollection}" (source "${plan.table}", synced fields if needed).`,
  );
  return await pb.collections.getOne(existing.id, { requestKey: null });
}

function buildDesiredFields(plan, collectionsByName) {
  const fields = [
    {
      name: 'old_id',
      type: 'text',
      required: true,
      options: {},
    },
  ];

  for (const col of plan.columnPlans) {
    if (!col.isForeignKey) {
      fields.push({
        name: col.pbField,
        type: col.pbType,
        required: false,
        options: {},
      });
      continue;
    }

    const targetCollection = collectionsByName.get(col.fk.references.pbCollection);
    if (targetCollection) {
      fields.push({
        name: col.pbField,
        type: 'relation',
        required: false,
        options: {
          collectionId: targetCollection.id,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
        },
      });

      fields.push({
        name: col.fkTempField,
        type: 'text',
        required: false,
        options: {},
      });
    } else {
      // Fallback if dependency collection was not yet created.
      fields.push({
        name: col.pbField,
        type: 'text',
        required: false,
        options: {},
      });
    }
  }

  return fields;
}

async function createCollection(pb, name, fields) {
  const basePayload = {
    name,
    type: 'base',
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  };

  try {
    return await pb.collections.create({ ...basePayload, fields }, { requestKey: null });
  } catch (fieldsError) {
    try {
      return await pb.collections.create({ ...basePayload, schema: fields }, { requestKey: null });
    } catch (schemaError) {
      try {
        const bare = await pb.collections.create({ ...basePayload }, { requestKey: null });
        console.warn(
          `[COLLECTION] Created "${name}" without schema fallback (fields mode failed: ${fieldsError.message}; schema mode failed: ${schemaError.message}).`,
        );
        return bare;
      } catch (bareError) {
        throw new Error(
          `Create failed for collection "${name}" (fields mode: ${fieldsError.message}; schema mode: ${schemaError.message}; bare mode: ${bareError.message})`,
        );
      }
    }
  }
}

function buildOldIdIndexSql(collectionName) {
  return `CREATE INDEX IF NOT EXISTS idx_${collectionName}_old_id ON ${collectionName} (old_id)`;
}

async function ensureOldIdIndex(pb, collection) {
  const collectionName = collection.name;
  const sql = buildOldIdIndexSql(collectionName);
  const currentIndexes = Array.isArray(collection.indexes) ? collection.indexes : [];
  if (currentIndexes.includes(sql)) return;

  try {
    await pb.collections.update(
      collection.id,
      { indexes: [...currentIndexes, sql] },
      { requestKey: null },
    );
    console.log(`[COLLECTION] Ensured old_id index on "${collectionName}".`);
  } catch (error) {
    console.warn(
      `[COLLECTION] Unable to ensure old_id index on "${collectionName}" via API: ${error.message}`,
    );
  }
}

async function syncMissingFields(pb, collection, desiredFields) {
  const currentFields = Array.isArray(collection.fields)
    ? collection.fields
    : Array.isArray(collection.schema)
      ? collection.schema
      : [];

  const existingNames = new Set(currentFields.map((field) => field.name));
  const missing = desiredFields.filter((field) => !existingNames.has(field.name));
  if (!missing.length) return;

  try {
    if (Array.isArray(collection.fields)) {
      await pb.collections.update(
        collection.id,
        { fields: [...currentFields, ...missing] },
        { requestKey: null },
      );
    } else {
      await pb.collections.update(
        collection.id,
        { schema: [...currentFields, ...missing] },
        { requestKey: null },
      );
    }
    console.log(`[COLLECTION] Added missing fields via collection update (${missing.length}).`);
    return;
  } catch (error) {
    console.warn(
      `[COLLECTION] Bulk field update failed for "${collection.name}". Falling back to per-field API.`,
    );
  }

  for (const field of missing) {
    try {
      await pb.send(`/api/collections/${collection.id}/fields`, {
        method: 'POST',
        body: field,
      });
      console.log(`[COLLECTION] Added field "${field.name}" to "${collection.name}".`);
    } catch (error) {
      console.error(
        `[COLLECTION] Failed to add field "${field.name}" to "${collection.name}": ${error.message}`,
      );
    }
  }
}

async function migrateTablePass1(supabase, pb, plan) {
  const table = plan.table;
  const collection = pb.collection(plan.pbCollection);
  const existingMap = await buildOldIdToPocketIdMap(collection, `PASS1/${plan.pbCollection}`);

  let offset = 0;
  let processed = 0;
  let failedRows = 0;

  while (true) {
    const from = offset;
    const to = offset + BATCH_SIZE - 1;
    const { rows, error } = await fetchSupabaseBatch(supabase, table, plan.primaryKey, from, to);

    if (error) {
      console.error(
        `[PASS1][${table} -> ${plan.pbCollection}] Batch fetch error (${from}-${to}): ${error.message}`,
      );
      break;
    }
    if (!rows.length) break;

    for (const row of rows) {
      try {
        const oldIdRaw = row[plan.primaryKey];
        if (oldIdRaw === null || oldIdRaw === undefined) {
          console.warn(
            `[PASS1][${table} -> ${plan.pbCollection}] Skipping row without PK "${plan.primaryKey}".`,
          );
          continue;
        }

        const oldId = normalizeOldId(oldIdRaw);
        if (!oldId) {
          console.warn(
            `[PASS1][${table} -> ${plan.pbCollection}] Skipping row with empty normalized PK "${plan.primaryKey}".`,
          );
          continue;
        }
        const payload = buildPass1RecordPayload(row, plan);
        payload.old_id = oldId;

        const existingId = existingMap.get(oldId);
        if (existingId) {
          await collection.update(existingId, payload, { requestKey: null });
        } else {
          const created = await collection.create(payload, { requestKey: null });
          existingMap.set(oldId, created.id);
        }
        processed += 1;
      } catch (error) {
        failedRows += 1;
        console.error(`[PASS1][${table} -> ${plan.pbCollection}] Row failed: ${error.message}`);
      }
    }

    offset += BATCH_SIZE;
    if (rows.length < BATCH_SIZE) break;
  }

  console.log(
    `[PASS1][${table} -> ${plan.pbCollection}] Done. Processed=${processed}, FailedRows=${failedRows}`,
  );
}

async function fetchSupabaseBatch(supabase, table, primaryKey, from, to) {
  let query = supabase.from(table).select('*').range(from, to);

  if (primaryKey) {
    query = query.order(primaryKey, { ascending: true });
  }

  let res = await query;
  if (!res.error) return { rows: res.data || [], error: null };

  // Fallback query without order (for edge cases like unsupported order type/view behavior)
  res = await supabase.from(table).select('*').range(from, to);
  return { rows: res.data || [], error: res.error || null };
}

function buildPass1RecordPayload(row, plan) {
  const payload = {};

  for (const col of plan.columnPlans) {
    const rawValue = row[col.sourceColumn];

    if (!col.isForeignKey) {
      payload[col.pbField] = normalizeValueForPocketBase(rawValue, col.pbType);
      continue;
    }

    if (col.fkTempField) {
      payload[col.pbField] = null;
      payload[col.fkTempField] = normalizeOldId(rawValue);
    } else {
      // Fallback when no relation field is available yet.
      payload[col.pbField] = normalizeOldId(rawValue);
    }
  }

  return payload;
}

function normalizeValueForPocketBase(value, pbType) {
  if (value === null || value === undefined) return null;

  switch (pbType) {
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case 'bool':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') {
        const lower = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y'].includes(lower)) return true;
        if (['false', '0', 'no', 'n'].includes(lower)) return false;
      }
      return null;
    case 'json':
      if (typeof value === 'object') return value;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (_error) {
          return { value };
        }
      }
      return value;
    case 'text':
    default:
      return String(value);
  }
}

async function resolveRelationsPass2(pb, plan, plansByTable) {
  const fkColumns = plan.columnPlans.filter((col) => col.isForeignKey && col.fkTempField);
  if (!fkColumns.length) {
    console.log(`[PASS2][${plan.table} -> ${plan.pbCollection}] No relation fields to resolve.`);
    return;
  }

  const relationMaps = new Map();
  const getRelationMap = async (referencedTable) => {
    if (!relationMaps.has(referencedTable)) {
      const referencedPlan = plansByTable[referencedTable];
      if (!referencedPlan) return null;
      relationMaps.set(
        referencedTable,
        await buildOldIdToPocketIdMap(
          pb.collection(referencedPlan.pbCollection),
          `PASS2/${referencedPlan.pbCollection}`,
        ),
      );
    }
    return relationMaps.get(referencedTable);
  };

  let page = 1;
  let updated = 0;
  let unresolved = 0;
  let failed = 0;

  const fieldList = ['id', ...fkColumns.map((c) => c.fkTempField), ...fkColumns.map((c) => c.pbField)];

  while (true) {
    let list;
    try {
      list = await pb.collection(plan.pbCollection).getList(page, POCKETBASE_PAGE_SIZE, {
        fields: fieldList.join(','),
        requestKey: null,
      });
    } catch (error) {
      console.error(
        `[PASS2][${plan.table} -> ${plan.pbCollection}] Failed to read records page ${page}: ${error.message}`,
      );
      break;
    }

    for (const record of list.items) {
      const patch = {};

      for (const col of fkColumns) {
        const oldRef = record[col.fkTempField];
        if (oldRef === null || oldRef === undefined || oldRef === '') continue;

        const targetPlan = plansByTable[col.fk.references.table];
        if (!targetPlan) {
          unresolved += 1;
          console.warn(
            `[PASS2][${plan.table} -> ${plan.pbCollection}] Missing plan for referenced table "${col.fk.references.table}".`,
          );
          continue;
        }

        const targetMap = await getRelationMap(col.fk.references.table);
        if (!targetMap) {
          unresolved += 1;
          console.warn(
            `[PASS2][${plan.table} -> ${plan.pbCollection}] Missing relation map for "${col.fk.references.table}".`,
          );
          continue;
        }
        const normalizedRef = normalizeOldId(oldRef);
        if (!normalizedRef) {
          continue;
        }
        const resolvedId = targetMap.get(normalizedRef);
        if (!resolvedId) {
          unresolved += 1;
          console.warn(
            `[PASS2][${plan.table} -> ${plan.pbCollection}] Could not resolve ${col.fk.references.table}.old_id=${normalizedRef}`,
          );
          continue;
        }

        patch[col.pbField] = resolvedId;
        patch[col.fkTempField] = null;
      }

      if (!Object.keys(patch).length) continue;

      try {
        await pb.collection(plan.pbCollection).update(record.id, patch, { requestKey: null });
        updated += 1;
      } catch (error) {
        failed += 1;
        console.error(
          `[PASS2][${plan.table} -> ${plan.pbCollection}] Update failed for record ${record.id}: ${error.message}`,
        );
      }
    }

    if (page >= list.totalPages) break;
    await sleep(100);
    page += 1;
  }

  console.log(
    `[PASS2][${plan.table} -> ${plan.pbCollection}] Done. Updated=${updated}, Unresolved=${unresolved}, Failed=${failed}`,
  );
}

async function buildOldIdToPocketIdMap(collectionApi, label) {
  const map = new Map();
  let page = 1;

  while (true) {
    let list;
    try {
      list = await collectionApi.getList(page, POCKETBASE_PAGE_SIZE, {
        fields: 'id,old_id',
        requestKey: null,
      });
    } catch (error) {
      console.error(`[${label}] Failed to build old_id map on page ${page}: ${error.message}`);
      break;
    }

    for (const record of list.items) {
      if (record.old_id === null || record.old_id === undefined) continue;
      const normalized = normalizeOldId(record.old_id);
      if (!normalized) continue;
      map.set(normalized, record.id);
    }

    if (page >= list.totalPages) break;
    page += 1;
  }

  return map;
}

main().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
});