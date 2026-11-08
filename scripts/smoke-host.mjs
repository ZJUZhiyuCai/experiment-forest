/** Keyless integration against published Cordis, Storage, Tool registry, and authenticated Gateway. */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as JsonStorage from '@deepseek-ai/dsh-storage-json';
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain';
import TypertRegistry from '@deepseek-ai/dsh-typert-registry';
import RemoteAccess from '@deepseek-ai/dsh-api-remote-access';
import Gateway from '@deepseek-ai/dsh-api-gateway';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import Tools from '@deepseek-ai/dsh-tools';
import LocalAttachments from '@deepseek-ai/dsh-attachment-local';
import { Peer } from '@deepseek-ai/dsh-client-connection';
import * as forest from '../lib/index.js';

const root = await mkdtemp(join(tmpdir(), 'forest-host-smoke-'));
const contexts = [];
async function boot(profileName = 'forest-smoke') {
  const ctx = new Context(); contexts.push(ctx);
  ctx.provide('profileContext', { name: profileName, dir: join(root, 'profiles', profileName) });
  await ctx.plugin(LocalAttachments,{dshHome:join(root,'harness')});
  await ctx.plugin(Storage);
  await ctx.plugin(JsonStorage, { root });
  await ctx.plugin(StorageDomain, { backend: 'json' });
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(Tools);
  await ctx.plugin(TypertRegistry);
  await ctx.plugin(RemoteAccess);
  await ctx.plugin(Gateway, {});
  const fiber = ctx.plugin(forest); await fiber;
  assert.ok(ctx.get('experimentForest'), 'plugin must activate');
  const peer = new Peer(ctx, { principal: { kind: 'owner' } });
  const rpc = (method, args = {}) => ctx.typertGateway.invoke({ namespace: 'experimentForest', method, args, peer });
  return { ctx, fiber, rpc };
}
try {
  const first = await boot();
  assert.deepEqual(await first.rpc('snapshot'), { revision: 0, entities: [] });
  const guest = new Peer(first.ctx, { principal: { kind: 'test-guest', guest: 'forest-smoke' } });
  const guestCalls = {
    createPage:{input:{requestId:'denied'}},getPage:{id:'denied'},
    savePage:{input:{id:'denied',expectedRevision:0,requestId:'denied',title:'denied',experimentDate:null,blocks:[]}},
    decideProposal:{input:{id:'denied',proposalId:'denied',requestId:'denied',operationIds:['denied'],decision:'accept'}},
    confirmPageBlock:{input:{id:'denied',expectedRevision:0,blockId:'denied'}},beginMaterial:{input:{id:'denied',requestId:'denied',name:'denied',mime:'text/plain',bytes:1}},
    appendMaterial:{input:{uploadId:'denied',offset:0,data:'YQ=='}},finishMaterial:{input:{uploadId:'denied'}},cancelMaterial:{input:{uploadId:'denied'}},readMaterial:{input:{id:'denied',materialId:'denied',offset:0}},
    list: { filter: {} }, get: { id: 'denied' }, snapshot: {}, create: { input: { kind: 'note', title: 'denied' } },
    update: { input: { id: 'denied', expectedRevision: 0, patch: { title: 'denied' } } }, archive: { input: { id: 'denied', expectedRevision: 0 } },
    export: {}, previewImport: { input: { data: {} } }, import: { input: { data: {}, expectedRevision: 0 } },
    createRun: { input: { sopId: 'denied', expectedSopRevision: 1, title: 'denied', requestId: 'denied' } },
    updateRunStep: { input: { id: 'denied', expectedRevision: 1, stepId: 'denied', status: 'done', observation: '' } },
    context: { input: { id: 'denied' } }, obsidianStatus: {}, configureObsidian: { input: { vaultId: null } }, syncObsidian: {},
  };
  for (const [method, args] of Object.entries(guestCalls)) {
    await assert.rejects(first.ctx.typertGateway.invoke({ namespace: 'experimentForest', method, args, peer: guest }), /access|denied|permitted|authorized/i);
  }
  const project = await first.rpc('create', { input: { kind: 'project', title: '可复现的研究' } });
  const record = await first.rpc('create', { input: { kind: 'record', title: '长'.repeat(280), projectId: project.id } });
  await assert.rejects(first.rpc('update', { input: { id: record.id, expectedRevision: record.revision + 1, patch: { title: '过期修改' } } }), /版本|刷新|修改/);
  await assert.rejects(first.rpc('create', { input: { kind: 'record', title: 'invalid', arbitrary: true } }));
  assert.equal((await first.rpc('snapshot')).entities.length, 2);
  assert.equal((await first.rpc('export')).entities[1].title.length, 280);
  const sop = await first.rpc('create', { input: { kind: 'sop', title: 'Host 工作流', data: { forestWorkflow: {
    format: 'experiment-forest/workflow', version: 1, type: 'sop', steps: [{ id: 'check', title: '检查', instruction: '', required: true }],
  } } } });
  const request = { sopId: sop.id, expectedSopRevision: sop.revision, title: 'Host 运行', requestId: 'host-run-1', plannedDate: '2026-11-08' };
  const run = await first.rpc('createRun', { input: request });
  assert.equal((await first.rpc('createRun', { input: request })).id, run.id);
  const checked = await first.rpc('updateRunStep', { input: { id: run.id, expectedRevision: 1, stepId: 'check', status: 'done', observation: '软件测试步骤，不是科学结论' } });
  assert.equal(checked.data.forestWorkflow.steps[0].status, 'done');
  const context = await first.rpc('context', { input: { id: run.id, maxChars: 1000 } });
  assert.equal(context.entries[0].workflowSource.id, sop.id);
  assert.equal(context.omittedTotal, 0);
  const obsidian = await first.rpc('obsidianStatus');
  assert.equal(obsidian.enabled, false);
  await assert.rejects(first.rpc('configureObsidian', { input: { vaultId: 'unregistered-forest-smoke-vault' } }), /登记列表/);
  assert.equal((await first.rpc('syncObsidian')).state, 'disabled');
  const page=await first.rpc('createPage',{input:{requestId:'smoke-page',title:'混合实验页'}});
  const savedPage=await first.rpc('savePage',{input:{id:page.entity.id,expectedRevision:page.entity.revision,requestId:'smoke-save',title:'混合实验页',experimentDate:null,blocks:[{id:'body',type:'text',text:'软件合成测试正文'}]}});
  const bytes=Buffer.alloc(300000,97);
  const upload=await first.rpc('beginMaterial',{input:{id:page.entity.id,requestId:'smoke-upload',name:'raw.txt',mime:'text/plain',bytes:bytes.length}});
  for(let offset=0;offset<bytes.length;offset+=upload.chunkBytes)await first.rpc('appendMaterial',{input:{uploadId:upload.uploadId,offset,data:bytes.subarray(offset,offset+upload.chunkBytes).toString('base64')}});
  const withMaterial=await first.rpc('finishMaterial',{input:{uploadId:upload.uploadId}});
  const materialId=withMaterial.page.materials[0].id;
  const firstChunk=await first.rpc('readMaterial',{input:{id:page.entity.id,materialId,offset:0}});
  assert.equal(Buffer.from(firstChunk.data,'base64').length,upload.chunkBytes);
  assert.equal(withMaterial.entity.content.includes('软件合成测试正文'),true);
  const committedRevision = (await first.rpc('snapshot')).revision;
  assert.deepEqual(first.ctx.tools.schemas().map(tool => tool.name).sort(), ['forest_context', 'forest_create_draft', 'forest_page_material_image', 'forest_page_material_text', 'forest_page_propose', 'forest_page_read', 'forest_read', 'forest_search']);
  await first.fiber.dispose();
  assert.equal(first.ctx.get('experimentForest'), undefined);
  assert.equal(first.ctx.tools.schemas().length, 0);
  await first.ctx.fiber.dispose(); contexts.splice(contexts.indexOf(first.ctx), 1);
  const second = await boot();
  assert.equal((await second.rpc('obsidianStatus')).folder, obsidian.folder);
  assert.equal((await second.rpc('get', { id: record.id })).title.length, 280);
  assert.equal((await second.rpc('snapshot')).revision, committedRevision);
  assert.equal((await second.rpc('get', { id: run.id })).data.forestWorkflow.steps[0].status, 'done');
  const restored=await second.rpc('finishMaterial',{input:{uploadId:upload.uploadId}});assert.equal(restored.page.materials.length,1);
  assert.equal((await second.rpc('readMaterial',{input:{id:page.entity.id,materialId,offset:upload.chunkBytes}})).total,bytes.length);
  await second.fiber.dispose();
  const separate = await boot('forest-other-profile');
  assert.notEqual((await separate.rpc('obsidianStatus')).folder, obsidian.folder);
  assert.deepEqual(await separate.rpc('snapshot'), { revision: 0, entities: [] });
  await separate.fiber.dispose();
  console.log('PASS: official Host activation, owner-only RPCs, workflow source/steps/idempotency/context, Obsidian ID-only configuration, conflict handling, durable restart, tool registration and unload. No model request; no real vault was modified.');
} finally {
  await Promise.all(contexts.map(ctx => ctx.fiber.dispose()));
  await rm(root, { recursive: true, force: true });
}
