export class RingBuffer<T> {
  private buf: (T | undefined)[];
  private head = 0; // next write position
  private _size = 0;
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buf = new Array(capacity);
  }

  push(item: T): void {
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this._size < this.capacity) this._size++;
  }

  get size(): number {
    return this._size;
  }

  /** Return entries oldest-first. */
  toArray(): T[] {
    if (this._size === 0) return [];
    const result: T[] = [];
    const start =
      this._size < this.capacity ? 0 : this.head;
    for (let i = 0; i < this._size; i++) {
      result.push(this.buf[(start + i) % this.capacity] as T);
    }
    return result;
  }

  /** Return the oldest entry, or undefined. */
  oldest(): T | undefined {
    if (this._size === 0) return undefined;
    const idx =
      this._size < this.capacity ? 0 : this.head;
    return this.buf[idx];
  }

  /** Return the newest entry, or undefined. */
  newest(): T | undefined {
    if (this._size === 0) return undefined;
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buf[idx];
  }
}
