export class Queue {
  private queue: (() => Promise<any>)[] = [];
  private running = 0;

  constructor(private concurrency: number) {}

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.dequeue();
        }
      });
      this.dequeue();
    });
  }

  private dequeue() {
    if (this.running >= this.concurrency || this.queue.length === 0) return;
    const task = this.queue.shift();
    if (task) {
      this.running++;
      task();
    }
  }
}
