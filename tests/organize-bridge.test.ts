import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {Context} from '@deepseek-ai/cordis';
import type {SessionId} from '@deepseek-ai/dsh-session/types';
import {createOrganizeBridge,organizationPrompt} from '../client/organize-bridge';

test('AI organization uses the actual retained conversation scope and sends explicit page identity',async()=>{
  const sent:string[]=[];const conversation={send:async(text:string)=>{sent.push(text);}};
  const scoped={get:(key:string)=>key==='conversation'?conversation:undefined,get conversation():never{throw new Error('session scope requires get');}};
  const seen:string[]=[];const ctx={get:()=>({scope:(id:string)=>{seen.push(id);return scoped;}})} as unknown as Context;
  const organize=createOrganizeBridge(ctx,'chat-1' as SessionId);
  assert.equal(await organize('record-42','保留原始数值并整理表格'),'sent');assert.deepEqual(seen,['chat-1']);
  assert.equal(sent[0],organizationPrompt('record-42','保留原始数值并整理表格'));assert.match(sent[0]!,/forest_page_propose/);
});
test('uncertain native sends surface the failure without automatically duplicating or copying',async()=>{
  const ctx={get:()=>({scope:()=>({get:()=>({send:async()=>{throw new Error('lost acknowledgement');}})})})} as unknown as Context;
  await assert.rejects(createOrganizeBridge(ctx,'chat-1' as SessionId)('record-42','整理'),/lost acknowledgement/);
});
