/**
 * Objet-valeur : immuable, défini par sa valeur, validé à la construction.
 * Les sous-classes ont un constructeur privé et une fabrique `create` qui renvoie un `Result` :
 * une instance existante est donc toujours valide.
 */
export abstract class ValueObject<T> {
  protected constructor(readonly value: T) {
    Object.freeze(this);
  }

  equals(other: ValueObject<T> | null | undefined): boolean {
    return !!other && other.constructor === this.constructor && other.value === this.value;
  }

  toString(): string {
    return String(this.value);
  }
}
