/**
 * Mangou Local VFS Sync Adapter (Full Mock)
 * (Everything is always "synced" locally)
 */

export const loadProjectFromSupabase = async () => null;
export const saveProjectToSupabase = async () => null;
export const enableAutoSync = () => {};
export const disableAutoSync = () => {};
export const forceSync = async () => {};
export const getSyncStatus = () => ({ status: 'synced', last_sync: new Date() });

export const vfsSyncManager = {
  loadProjectFromSupabase,
  saveProjectToSupabase,
  enableAutoSync,
  disableAutoSync,
  forceSync,
  getSyncStatus
};
