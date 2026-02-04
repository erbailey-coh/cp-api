import { config } from '../utils/config';

interface QueueItem<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeoutId?: NodeJS.Timeout;
}

/**
 * Request queue to serialize Copilot interactions
 * Only one request can interact with the browser at a time
 */
class RequestQueue {
  private queue: QueueItem<unknown>[] = [];
  private processing = false;

  /**
   * Add a task to the queue and return a promise for its result
   */
  async enqueue<T>(execute: () => Promise<T>): Promise<T> {
    // Check queue size limit
    if (this.queue.length >= config.maxQueueSize) {
      throw new Error(`Queue is full (max ${config.maxQueueSize} requests)`);
    }

    return new Promise<T>((resolve, reject) => {
      const item: QueueItem<T> = {
        execute,
        resolve,
        reject,
      };

      // Set timeout for the request
      item.timeoutId = setTimeout(() => {
        const index = this.queue.indexOf(item as QueueItem<unknown>);
        if (index !== -1) {
          this.queue.splice(index, 1);
          reject(new Error('Request timeout while waiting in queue'));
        }
      }, config.requestTimeout);

      this.queue.push(item as QueueItem<unknown>);
      console.log(`[Queue] Request enqueued. Queue size: ${this.queue.length}`);

      // Start processing if not already
      this.processNext();
    });
  }

  /**
   * Process the next item in the queue
   */
  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    const item = this.queue.shift();
    if (!item) {
      this.processing = false;
      return;
    }

    // Clear the timeout since we're now processing
    if (item.timeoutId) {
      clearTimeout(item.timeoutId);
    }

    console.log(`[Queue] Processing request. Remaining: ${this.queue.length}`);

    try {
      const result = await item.execute();
      item.resolve(result);
    } catch (error) {
      item.reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.processing = false;
      // Process next item if any
      this.processNext();
    }
  }

  /**
   * Get the number of pending requests
   */
  getPendingCount(): number {
    return this.queue.length;
  }

  /**
   * Check if currently processing a request
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Clear all pending requests (for shutdown)
   */
  clear(): void {
    for (const item of this.queue) {
      if (item.timeoutId) {
        clearTimeout(item.timeoutId);
      }
      item.reject(new Error('Queue cleared - server shutting down'));
    }
    this.queue = [];
  }
}

// Export singleton instance
export const requestQueue = new RequestQueue();
