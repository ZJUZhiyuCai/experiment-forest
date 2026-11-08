import assert from 'node:assert/strict';
import {test} from 'node:test';
import {obsidianNoteTarget} from '../client/obsidian-note';
import {createObsidianMirror} from '../shared/obsidian';
import type {ObsidianStatus} from '../shared/obsidian-contract';
import type {ForestEntity} from '../shared/model';

const at='2026-11-08T14:00:00.000Z';
const entity:ForestEntity={id:'Case:A.1',title:'材料 [A] | 吸附 <test>',kind:'record',content:'original',data:{},status:'draft',tags:[],revision:1,createdAt:at,updatedAt:at};
const status:ObsidianStatus={enabled:true,vaultId:'vault 你好&?',folder:'Experiment Forest-123456789abc',vaults:[{id:'vault 你好&?',name:'same name',path:'/tmp/fixture',open:false}],state:'synced',lastError:null,conflicts:[],stale:[],lastSyncedAt:at,lastSyncedRevision:1};

test('note links resolve to the actual mirrored file and encode vault/path separately',()=>{
  const target=obsidianNoteTarget(status,entity)!;
  const mirror=createObsidianMirror({revision:1,entities:[entity]},at,status.folder);
  assert.ok(mirror.files.some(f=>`${status.folder}/${f.path}`===target.relativePath&&f.content.includes(entity.id)));
  const uri=new URL(target.uri);assert.equal(uri.protocol,'obsidian:');assert.equal(uri.hostname,'open');
  assert.equal(uri.searchParams.get('vault'),status.vaultId);assert.equal(uri.searchParams.get('file'),target.relativePath);
  assert.equal(uri.searchParams.get('paneType'),'tab');assert.equal([...uri.searchParams].length,3);
  assert.equal(target.state,'synced');assert.equal(target.wikilink.match(/\[\[/g)?.length,1);
  assert.equal(target.wikilink.match(/\]\]/g)?.length,1);assert.equal(target.wikilink.match(/\|/g)?.length,1);
  assert.equal(obsidianNoteTarget(status,{...entity,title:'renamed'})!.relativePath,target.relativePath);
});

test('missing vaults, pending saves and this-note conflicts cannot claim a current note',()=>{
  const target=obsidianNoteTarget(status,entity)!;
  assert.equal(obsidianNoteTarget({...status,vaults:[]},entity),null);
  assert.equal(obsidianNoteTarget({...status,folder:'../unsafe'},entity),null);
  assert.equal(obsidianNoteTarget(status,{...entity,id:'../unsafe'}),null);
  assert.equal(obsidianNoteTarget({...status,lastSyncedAt:null},entity)!.state,'pending');
  assert.equal(obsidianNoteTarget(status,{...entity,updatedAt:'2026-11-08T14:01:00Z'})!.state,'pending');
  for(const state of ['error','syncing','idle'] as const) assert.equal(obsidianNoteTarget({...status,state},entity)!.state,'pending');
  assert.equal(obsidianNoteTarget({...status,state:'conflict',conflicts:[{path:target.relativePath.replace(`${status.folder}/`,''),reason:'edited'}]},entity)!.state,'conflict');
  assert.equal(obsidianNoteTarget({...status,state:'conflict',conflicts:[{path:'entities/another.md',reason:'edited'}]},entity)!.state,'synced');
});
