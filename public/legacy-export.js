/* Run only on the old app's own origin. Read-only; no network requests. */
(() => {
  const businessKeys = new Set(['projects', 'experiment_records', 'experiment_notes', 'sops',
    'samples', 'experiment_plans', 'sample_history', 'todoItems', 'scheduleEvents',
    'calendarEvents', 'dailyMood']);
  function downloadLegacyBackup() {
    const data = {};
    const invalid = [];
    for (const key of Object.keys(localStorage)) {
      if (!businessKeys.has(key) && !/^dailyMood_\d{4}-\d{2}-\d{2}$/.test(key)) continue;
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      // Keep exact source strings; malformed entries remain recoverable in the backup.
      data[key] = raw;
      try { JSON.parse(raw); } catch { invalid.push(key); }
    }
    if (!Object.keys(data).length) throw new Error('当前地址没有旧版业务数据。请检查浏览器和地址，不要清除原站数据。');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `experiment-forest-legacy-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return `已导出 ${Object.keys(data).length} 个业务集合；原数据未改动。` +
      (invalid.length ? `\n以下集合包含无法解析的原文，已保留备份；导入前需修复：${invalid.join('、')}` : '\n可在新版“数据迁移”中预览后导入。');
  }
  const button = document.getElementById('export');
  if (button) button.addEventListener('click', () => {
    try { document.getElementById('result').textContent = downloadLegacyBackup(); }
    catch (error) { document.getElementById('result').textContent = error.message; }
  });
  else console.info(downloadLegacyBackup());
})();
