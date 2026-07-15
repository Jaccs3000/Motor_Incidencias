export function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function retryWithBackoff(operation, { retries = 3, delayMs = 1000, shouldRetry = () => true } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error, attempt)) {
        throw error;
      }
      attempt += 1;
      await delay(delayMs * attempt);
    }
  }
}
