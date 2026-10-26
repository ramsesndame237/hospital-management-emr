import { RefreshSession, RefreshSessionStore } from '../../domain/ports';

/** Sessions en mémoire du processus : développement et tests uniquement (perdues au redémarrage, non partagées entre instances). */
export class MemoryRefreshSessionStore implements RefreshSessionStore {
  private readonly sessions = new Map<string, { session: RefreshSession; used: boolean }>();

  async create(session: RefreshSession): Promise<void> {
    this.sessions.set(session.id, { session, used: false });
  }

  async find(id: string): Promise<{ session: RefreshSession; used: boolean } | null> {
    return this.sessions.get(id) ?? null;
  }

  async markUsed(id: string): Promise<boolean> {
    const e = this.sessions.get(id);
    if (!e || e.used) return false;
    e.used = true;
    return true;
  }

  async revokeFamily(familyId: string): Promise<void> {
    for (const [id, e] of this.sessions) if (e.session.familyId === familyId) this.sessions.delete(id);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    for (const [id, e] of this.sessions) if (e.session.userId === userId) this.sessions.delete(id);
  }
}
