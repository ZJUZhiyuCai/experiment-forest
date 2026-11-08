import type { PageApi } from '../shared/page';
import { MAX_MATERIAL_BYTES } from '../shared/page';
function base64(data: Uint8Array): string {
  let text = ''; for (let i=0;i<data.length;i+=8192) text += String.fromCharCode(...data.subarray(i,i+8192));
  return btoa(text);
}
/** Upload only; caller serializes finishMaterial with editor saves. */
export async function stageMaterial(api: PageApi, id: string, file: File, progress: (n: number) => void, signal?: AbortSignal): Promise<string> {
  if (!file.size || file.size > MAX_MATERIAL_BYTES) throw new Error('每份材料须大于 0 且不超过 64 MiB');
  const upload = await api.beginMaterial({ id, requestId: crypto.randomUUID(), name: file.name, mime: file.type || 'application/octet-stream', bytes: file.size });
  try {
    for (let offset = upload.received; offset < file.size;) {
      signal?.throwIfAborted();
      const bytes = new Uint8Array(await file.slice(offset, offset+upload.chunkBytes).arrayBuffer());
      const result = await api.appendMaterial({uploadId:upload.uploadId,offset,data:base64(bytes)});
      offset = result.received; progress(offset/file.size);
    }
    signal?.throwIfAborted(); return upload.uploadId;
  } catch (error) { await api.cancelMaterial({uploadId:upload.uploadId}).catch(()=>undefined); throw error; }
}
export async function loadMaterialBlob(api: PageApi, id: string, materialId: string, signal?: AbortSignal): Promise<Blob> {
  const parts: Uint8Array<ArrayBuffer>[] = []; let offset=0, total=1, mime='application/octet-stream';
  while (offset<total) {
    signal?.throwIfAborted(); const chunk=await api.readMaterial({id,materialId,offset});
    const value=atob(chunk.data); parts.push(Uint8Array.from(value,c=>c.charCodeAt(0)));
    if(chunk.nextOffset<=offset)throw new Error('材料读取没有取得进展');
    offset=chunk.nextOffset; total=chunk.total; mime=chunk.mime;
  }
  return new Blob(parts,{type:mime});
}
export type OrganizePage = (id: string, instruction: string) => Promise<'sent'|'copied'>;
