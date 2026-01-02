export const yieldToEventLoop = () => new Promise(resolve => setImmediate(resolve));
