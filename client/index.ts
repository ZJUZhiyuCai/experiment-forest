/** Native sidebar entry for each session; records are shared by the entire Harness profile. */
import type { Context } from '@deepseek-ai/cordis';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type {} from '@deepseek-ai/dsh-api-gateway/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import contribution, { PACKAGE_NAME } from '../plugin/remote';
import { createHostApi } from './host-api';
import { ForestApp } from './ForestApp';
import css from './forest.css?inline';

export const inject = ['remote', 'slots', 'sidebarRightTabs'];
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(contribution);
  const ui = ctx.inject(['remote.experimentForest', 'slots', 'sidebarRightTabs'], child => {
    child.effect(() => {
      const style = document.createElement('style');
      style.dataset.plugin = PACKAGE_NAME; style.textContent = css; document.head.appendChild(style);
      return () => style.remove();
    });
    child.effect(() => child.sidebarRightTabs.register({ id: PACKAGE_NAME, kind: 'experiment-forest', title: () => '实验森林',
      guide: [{ id: 'open', order: 60, title: () => '实验森林', description: () => '项目、实验记录与研究资料' }] }));
    child.slots.inject('sidebar.right.pane.tab', () => child.slots.register({ name: 'sidebar.right.pane.tab', key: PACKAGE_NAME,
      inject: (sessionId: SessionId) => ({ api: createHostApi(child.remote.experimentForest), sessionId }) }, ForestApp));
  });
  try { await ui; } catch (error) { await ui.dispose(); await unmount(); throw error; }
  return async () => { await ui.dispose(); await unmount(); };
}
