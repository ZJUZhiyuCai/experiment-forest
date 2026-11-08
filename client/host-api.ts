/** Adapt Harness's explicit RemoteResult to the UI's ordinary async API. */
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { ForestRemote } from '../plugin/remote';
import type { ForestApi } from '../shared/model';
export class ForestApiError extends Error {
  readonly name = 'ForestApiError';
  constructor(readonly code: string, message: string, options?: ErrorOptions) { super(message, options); }
}
async function value<T>(result: Promise<RemoteResult<T>>): Promise<T> {
  const response = await result;
  if (!response.ok) {
    if (response.error.code === 'experimentForest/failure') {
      throw new ForestApiError(response.error.details.code, response.error.message, { cause: response.error });
    }
    throw response.error;
  }
  return response.value;
}
export function createHostApi(remote: ForestRemote): ForestApi {
  return {
    createPage: input => value(remote.createPage(input)), getPage:id=>value(remote.getPage(id)), savePage:input=>value(remote.savePage(input)),
    decideProposal:input=>value(remote.decideProposal(input)),confirmPageBlock:input=>value(remote.confirmPageBlock(input)),
    beginMaterial:input=>value(remote.beginMaterial(input)),appendMaterial:input=>value(remote.appendMaterial(input)),finishMaterial:input=>value(remote.finishMaterial(input)),
    cancelMaterial:input=>value(remote.cancelMaterial(input)),readMaterial:input=>value(remote.readMaterial(input)),
    list: filter => value(remote.list(filter)), get: id => value(remote.get(id)), snapshot: () => value(remote.snapshot()),
    create: input => value(remote.create(input)), update: input => value(remote.update(input)), archive: input => value(remote.archive(input)),
    createRun: input => value(remote.createRun(input)), updateRunStep: input => value(remote.updateRunStep(input)), context: input => value(remote.context(input)),
    obsidianStatus: () => value(remote.obsidianStatus()), configureObsidian: input => value(remote.configureObsidian(input)), syncObsidian: () => value(remote.syncObsidian()),
    export: () => value(remote.export()), previewImport: input => value(remote.previewImport(input)), import: input => value(remote.import(input)) };
}
