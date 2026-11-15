/** Words of the account menu (Vietnamese and English). The HUD button's own names live in hud-messages.ts. */
import { createFeatureText } from '../features/feature-text';

const vi = {
  you: 'Bạn',
  syncedAt: 'Đã đồng bộ lúc {time}',
  syncing: 'Đang đồng bộ…',
  notSynced: 'Chưa đồng bộ lần nào',
  offline: 'Chưa kết nối được, sẽ tự thử lại. Dữ liệu vẫn lưu trên máy.',
  error: 'Đồng bộ chưa được, sẽ tự thử lại. Dữ liệu vẫn lưu trên máy.',
  journalFull: 'Sổ trên server đã đầy: mục mới chỉ lưu trên máy này.',
  deleteStart: 'Xóa toàn bộ dữ liệu trên server',
  deleteAsk: 'Xóa hết công đức và sổ đã lưu trên server? Không lấy lại được.',
  deleteServerOnly: 'Chỉ xóa trên server',
  deleteServerOnlyNote: 'Dữ liệu trên máy này giữ nguyên, bạn sẽ được đăng xuất để nó không tự gửi lại.',
  deleteEverywhere: 'Xóa cả trên máy này',
  keep: 'Thôi, giữ lại',
  deleting: 'Đang xóa…',
  deleted: 'Đã xóa dữ liệu trên server.',
  deleteFailed: 'Chưa xóa được, thử lại sau nhé.',
  signOut: 'Đăng xuất',
  signingOut: 'Đang đăng xuất…',
  signOutFailed: 'Chưa đăng xuất được, thử lại sau nhé.',
} as const;

export type AccountTextKey = keyof typeof vi;

const en: Record<AccountTextKey, string> = {
  you: 'You',
  syncedAt: 'Synced at {time}',
  syncing: 'Syncing…',
  notSynced: 'Not synced yet',
  offline: 'Cannot connect, will retry. Your data stays on this device.',
  error: 'Sync did not work, will retry. Your data stays on this device.',
  journalFull: 'The journal on the server is full: new entries stay on this device only.',
  deleteStart: 'Delete all my data on the server',
  deleteAsk: 'Delete all merit and journal entries saved on the server? This cannot be undone.',
  deleteServerOnly: 'Only on the server',
  deleteServerOnlyNote: 'Data on this device stays; you will be signed out so it is not sent again.',
  deleteEverywhere: 'Also on this device',
  keep: 'Keep it',
  deleting: 'Deleting…',
  deleted: 'Your data on the server is deleted.',
  deleteFailed: 'Could not delete, please try again later.',
  signOut: 'Sign out',
  signingOut: 'Signing out…',
  signOutFailed: 'Could not sign out, please try again later.',
};

export const useAccountText = createFeatureText(vi, en);
