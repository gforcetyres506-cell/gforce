export type AdminRole = 'owner' | 'admin' | 'viewer';
export type AdminPermission = 'read' | 'operate' | 'owner';

export function permits(role: AdminRole, permission: AdminPermission): boolean {
  if (permission === 'read') return ['owner', 'admin', 'viewer'].includes(role);
  if (permission === 'operate') return role === 'owner' || role === 'admin';
  return role === 'owner';
}
