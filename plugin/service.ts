/** Host-owned persistence and typed RPC over the Harness's authenticated gateway. */
import type { Context } from '@deepseek-ai/cordis';
import { createHash } from 'node:crypto';
import type {} from '@deepseek-ai/dsh-app-boot';
import { defineDomain } from '@deepseek-ai/dsh-storage-domain';
import { TypertRemoteService, RemoteError } from '@deepseek-ai/dsh-typert-protocol';
import type {} from '@deepseek-ai/dsh-typert-registry';
import type { CreateEntity, EntityFilter, ForestApi, UpdateEntity } from '../shared/model';
import { ForestRepository, ForestError, stateSchema, createInitialState } from './domain';
import { descriptors, PACKAGE_NAME, SERVICE_NAME } from './remote';
import { registerForestTools } from './tools';

export function forestDomain(profileName: string) {
  const suffix = createHash('sha256').update(profileName).digest('hex').slice(0, 32);
  return defineDomain({ name: `experiment_forest_${suffix}`, version: 1,
    global: { schema: stateSchema, initial: createInitialState() }, tables: {} });
}

/** Expose only domain operations; no filesystem path, provider secret, or arbitrary command entry. */
export class ExperimentForestService extends TypertRemoteService implements ForestApi {
  constructor(ctx: Context, private readonly repository: ForestRepository) { super(ctx, SERVICE_NAME); }
  private async call<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); } catch (error) {
      if (error instanceof ForestError) throw new RemoteError('experimentForest/failure', error.message, { code: error.code });
      throw error;
    }
  }
  list(filter?: EntityFilter) { return this.call(() => this.repository.list(filter)); }
  get(id: string) { return this.call(() => this.repository.get(id)); }
  snapshot() { return this.call(() => this.repository.snapshot()); }
  create(input: CreateEntity) { return this.call(() => this.repository.create(input)); }
  update(input: UpdateEntity) { return this.call(() => this.repository.update(input)); }
  archive(input: { id: string; expectedRevision: number }) { return this.call(() => this.repository.archive(input)); }
  export() { return this.call(() => this.repository.export()); }
  previewImport(input: { data: unknown }) { return this.call(() => this.repository.previewImport(input)); }
  import(input: { data: unknown; expectedRevision: number }) { return this.call(() => this.repository.import(input)); }
}
declare module '@deepseek-ai/cordis' { interface Context { experimentForest: ExperimentForestService } }
export const name = 'experiment-forest';
export const inject = ['profileContext', 'storageDomain', 'typert', 'tools'];
export async function apply(ctx: Context): Promise<void> {
  const domain = await ctx.storageDomain.open(forestDomain(ctx.profileContext.name));
  const repository = new ForestRepository({ read: async () => structuredClone(domain.global.get()), write: state => domain.global.set(state) });
  ctx.effect(() => async () => { await repository.close(); await domain.close(); });
  // Fail plugin activation if authoritative persisted data is invalid.
  await repository.snapshot();
  new ExperimentForestService(ctx, repository);
  ctx.effect(() => ctx.typert.register({ package: PACKAGE_NAME, face: 'host', schemas: [],
    model: { services: [], events: [], objects: [] }, invocations: descriptors }));
  registerForestTools(ctx, repository);
}
