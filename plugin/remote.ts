/** One validated RPC definition shared by the Host and browser; no HTTP server or credentials. */
import { z } from 'zod';
import type { InvocationDescriptor, RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { ForestApi } from '../shared/model';

export const PACKAGE_NAME = 'dsh-experiment-forest';
export const SERVICE_NAME = 'experimentForest';
const kind = z.enum(['project', 'record', 'note', 'sop', 'sample', 'plan']);
const revision = z.number().int().nonnegative();
const jsonObject = z.record(z.string(), z.json());
const fields = {
  title: z.string().min(1).max(300), content: z.string().max(1_048_576), status: z.string().min(1).max(32),
  projectId: z.string().min(1).max(128), tags: z.array(z.string().min(1).max(80)).max(30), data: jsonObject,
};
const entity = z.object({ id: z.string(), kind, ...fields, projectId: fields.projectId.optional(), revision,
  createdAt: z.string(), updatedAt: z.string() });
const snapshot = z.object({ revision, entities: z.array(entity) });
const input = z.object({ kind, ...fields, content: fields.content.optional(), status: fields.status.optional(),
  projectId: fields.projectId.optional(), tags: fields.tags.optional(), data: fields.data.optional() }).strict();
const patch = z.object({ title: fields.title.optional(), content: fields.content.optional(), status: fields.status.optional(),
  projectId: fields.projectId.nullable().optional(), tags: fields.tags.optional(), data: fields.data.optional() }).strict();
const filter = z.object({ kind: kind.optional(), projectId: fields.projectId.optional(), query: z.string().max(300).optional(),
  status: fields.status.optional(), includeArchived: z.boolean().optional() }).strict().optional();
const archive = z.object({ id: z.string().min(1).max(128), expectedRevision: revision }).strict();
const exportSchema = snapshot.extend({ format: z.literal('experiment-forest'), schemaVersion: z.literal(1), exportedAt: z.string(),
  imports: z.array(z.object({ id: z.string(), importedAt: z.string(), source: z.enum(['legacy', 'forest-v1']), entityCount: revision, raw: jsonObject })) });
const preview = z.object({ fingerprint: z.string(), source: z.enum(['legacy', 'forest-v1']), total: revision, createCount: revision,
  unchangedCount: revision, byKind: z.record(kind, revision), conflicts: z.array(z.object({ id: z.string(), title: z.string(), reason: z.string() })),
  warnings: z.array(z.string()), alreadyImported: z.boolean(), revision });
const imported = z.object({ imported: revision, unchanged: revision, alreadyImported: z.boolean(), revision, warnings: z.array(z.string()) });
function descriptor(method: keyof ForestApi, parameters: [string, z.ZodType, boolean?][], result: z.ZodType): InvocationDescriptor {
  return { id: `${PACKAGE_NAME}#${SERVICE_NAME}/${method}`, service: SERVICE_NAME, namespace: SERVICE_NAME, method,
    invocation: { kind: 'direct' }, parameters: parameters.map(([name, schema, optional]) => ({ name, wire: name, source: 'json',
      codec: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#${method}.${name}`, create: () => schema }, ...(optional ? { acceptsUndefined: true as const } : {}) })),
    result: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#${method}.result`, create: () => result } };
}
export const descriptors: readonly InvocationDescriptor[] = [
  descriptor('list', [['filter', filter, true]], z.array(entity)), descriptor('get', [['id', z.string().min(1).max(128)]], entity.nullable()),
  descriptor('snapshot', [], snapshot), descriptor('create', [['input', input]], entity),
  descriptor('update', [['input', archive.extend({ patch })]], entity), descriptor('archive', [['input', archive]], entity),
  descriptor('export', [], exportSchema), descriptor('previewImport', [['input', z.object({ data: z.json() }).strict()]], preview),
  descriptor('import', [['input', z.object({ data: z.json(), expectedRevision: revision }).strict()]], imported),
];
const contribution: TypertRemoteContribution = { package: PACKAGE_NAME, descriptors };
export default contribution;
export type ForestRemote = { [K in keyof ForestApi]: (...args: Parameters<ForestApi[K]>) => Promise<RemoteResult<Awaited<ReturnType<ForestApi[K]>>>> };
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertClientRemote { experimentForest: ForestRemote }
  interface RemoteErrorDetailsMap { 'experimentForest/failure': { code: string } }
}
