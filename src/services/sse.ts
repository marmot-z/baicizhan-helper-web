// fetch-based SSE keeps the normal access_token header and supports cancellation.
export async function readSse(
  response: Response,
  onEvent: (event: string, data: string) => boolean | void,
  signal: AbortSignal,
): Promise<void> {
  if (!response.body) throw new Error('服务器未返回流式响应，请重试');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = 'message';
  let data: string[] = [];
  let frameSize = 0;
  let stopped = false;
  const onAbort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', onAbort, { once: true });
  function line(value: string) {
    if (value.endsWith('\r')) value = value.slice(0, -1);
    if (value === '') {
      if (data.length) stopped = onEvent(event, data.join('\n')) === false;
      event = 'message';
      data = [];
      frameSize = 0;
    } else if (!value.startsWith(':')) {
      frameSize += value.length;
      if (frameSize > 1_000_000) throw new Error('流式响应过大，请重试');
      const colon = value.indexOf(':');
      const field = colon < 0 ? value : value.slice(0, colon);
      const content = colon < 0 ? '' : value.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') event = content;
      else if (field === 'data') data.push(content);
    }
  }
  try {
    while (!stopped) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline: number;
      while (!stopped && (newline = buffer.indexOf('\n')) !== -1) {
        line(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
      if (buffer.length > 1_000_000) throw new Error('流式响应过大，请重试');
      if (done) break;
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
