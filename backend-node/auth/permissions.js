import { ROLES, SHARE_ROLES, SUPER_ADMIN_ID } from './constants.js';

function normalizeShares(meta) {
  return Array.isArray(meta?.shares) ? meta.shares : [];
}

function findShare(meta, userId) {
  return normalizeShares(meta).find((s) => s.user_id === userId) || null;
}

export function isSuperAdmin(user) {
  return user?.role === ROLES.SUPER_ADMIN || user?.id === SUPER_ADMIN_ID;
}

export function isAdmin(user) {
  return isSuperAdmin(user);
}

export function getProjectOwnerId(meta) {
  return meta?.owner_id || null;
}

export function canReadProject(user, meta) {
  if (!user || !meta) return false;
  if (isSuperAdmin(user)) return true;
  const ownerId = getProjectOwnerId(meta);
  if (ownerId && ownerId === user.id) return true;
  const share = findShare(meta, user.id);
  return Boolean(share);
}

export function canWriteProject(user, meta) {
  if (!user || !meta) return false;
  if (isSuperAdmin(user)) return true;
  const ownerId = getProjectOwnerId(meta);
  if (ownerId && ownerId === user.id) return true;
  const share = findShare(meta, user.id);
  return share?.role === SHARE_ROLES.WRITE;
}

export function canManageProject(user, meta) {
  if (!user || !meta) return false;
  if (isSuperAdmin(user)) return true;
  const ownerId = getProjectOwnerId(meta);
  return ownerId && ownerId === user.id;
}

export function getProjectAccess(user, meta) {
  return {
    read: canReadProject(user, meta),
    write: canWriteProject(user, meta),
    manage: canManageProject(user, meta),
    is_owner: getProjectOwnerId(meta) === user?.id,
    share_role: findShare(meta, user?.id)?.role || null,
  };
}

export function filterProjectsForUser(user, projects) {
  if (!user) return [];
  if (isSuperAdmin(user)) return projects;
  return projects.filter((meta) => canReadProject(user, meta));
}

export function enrichProjectMetaForUser(user, meta) {
  const access = getProjectAccess(user, meta);
  return {
    ...meta,
    owner_id: getProjectOwnerId(meta),
    shares: normalizeShares(meta),
    access,
  };
}
