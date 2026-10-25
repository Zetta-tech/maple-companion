import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { readLegacySnapshot } from './legacy-migration.js';
import { MigrationError, validateLegacyMigration } from './migration-validation.js';

function inside(parent: string, child: string) {
  const rel = relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}
export function resolveMigrationSource(workspaceRoot: string, sourcePath: string) {
  const workspace = realpathSync(workspaceRoot);
  const local = realpathSync(resolve(workspace, '.local'));
  const source = realpathSync(resolve(workspace, sourcePath));
  if (!inside(workspace, local) || !inside(local, source) || !source.endsWith('.sqlite')) throw new MigrationError('SOURCE_PATH_REQUIRES_REVIEW');
  return { workspace, local, source };
}

/** No file copying shortcut: SQLite backup includes the consistent WAL state. */
export async function createVerifiedLegacyBackup(options: {
  workspaceRoot: string; sourcePath: string; approvedOwners: readonly string[]; expectedDigest: string;
}) {
  const paths = resolveMigrationSource(options.workspaceRoot, options.sourcePath);
  const before = validateLegacyMigration(readLegacySnapshot(paths.source), options.approvedOwners);
  if (before.manifest.sha256 !== options.expectedDigest) throw new MigrationError('SOURCE_CHANGED');
  const directory = join(paths.local, 'migration-backups');
  if (!existsSync(directory)) mkdirSync(directory);
  const resolvedDirectory = realpathSync(directory);
  if (!inside(paths.local, resolvedDirectory)) throw new MigrationError('BACKUP_PATH_REQUIRES_REVIEW');
  // New directory prevents overwriting any existing backup. Failed backups are retained.
  const ownedDirectory = mkdtempSync(join(resolvedDirectory, 'journal-'));
  const backupPath = join(ownedDirectory, 'operations.sqlite');
  const source = new DatabaseSync(paths.source, { readOnly: true });
  try { await backup(source, backupPath); } finally { source.close(); }
  const saved = validateLegacyMigration(readLegacySnapshot(backupPath), options.approvedOwners);
  const after = validateLegacyMigration(readLegacySnapshot(paths.source), options.approvedOwners);
  if (saved.manifest.sha256 !== options.expectedDigest || after.manifest.sha256 !== options.expectedDigest) throw new MigrationError('BACKUP_OR_SOURCE_CHANGED');
  return { backupPath, manifest: saved.manifest };
}

/** Prepared from real files; no backup/digest assertion can be supplied in place of reading them. */
export function prepareVerifiedMigration(options: {
  workspaceRoot: string; sourcePath: string; backupPath: string; approvedOwners: readonly string[]; expectedDigest: string;
}) {
  const paths = resolveMigrationSource(options.workspaceRoot, options.sourcePath);
  const backupPath = realpathSync(options.backupPath);
  const backups = realpathSync(join(paths.local, 'migration-backups'));
  if (!inside(paths.local, backups) || !inside(backups, backupPath) || backupPath === paths.source) throw new MigrationError('BACKUP_PATH_REQUIRES_REVIEW');
  const owners = [...options.approvedOwners];
  const snapshot = readLegacySnapshot(backupPath);
  const plan = validateLegacyMigration(snapshot, owners);
  if (!plan.recordCount || plan.manifest.sha256 !== options.expectedDigest) throw new MigrationError('BACKUP_OR_SOURCE_CHANGED');
  const assertSourceUnchanged = () => {
    if (validateLegacyMigration(readLegacySnapshot(paths.source), owners).manifest.sha256 !== plan.manifest.sha256) throw new MigrationError('SOURCE_CHANGED');
  };
  assertSourceUnchanged();
  return { snapshot, plan, approvedOwners: owners, assertSourceUnchanged };
}
export type PreparedMigration = ReturnType<typeof prepareVerifiedMigration>;
