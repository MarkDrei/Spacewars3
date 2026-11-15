/**
 * Developer/admin access: admin pages, admin APIs and build cheat mode.
 * Shared by server routes (authoritative check) and client UI (only shows/hides controls).
 */
export const ADMIN_USERNAMES: readonly string[] = ['a', 'q'];

export function isAdminUsername(username: string | null | undefined): boolean {
  return !!username && ADMIN_USERNAMES.includes(username);
}
