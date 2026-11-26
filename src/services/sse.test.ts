import { describe, expect, it } from 'vitest';
import { readSse } from './sse';

describe('fetch SSE decoding', () => {
  it('preserves UTF-8, CRLF and multiline events across every byte boundary', async () => {
    const encoded = new TextEncoder().encode(': heartbeat\r\nevent: rationale_delta\r\ndata: {"text":"基础😀"}\r\n\r\nevent: custom\r\ndata: first\r\ndata: second\r\n\r\n');
    const response = new Response(new ReadableStream({
      start(controller) {
        for (const byte of encoded) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      },
    }));
    const events: unknown[] = [];
    await readSse(response, (event, data) => { events.push([event, data]); }, new AbortController().signal);
    expect(events).toEqual([['rationale_delta', '{"text":"基础😀"}'], ['custom', 'first\nsecond']]);
  });

  it('cancels a reader waiting for its next chunk', async () => {
    let cancelled = false;
    const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }));
    const controller = new AbortController();
    const result = readSse(response, () => undefined, controller.signal);
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelled).toBe(true);
  });

  it('does not dispatch an unfinished SSE frame', async () => {
    const received: string[] = [];
    await readSse(new Response('event: done\ndata: {"saved":true}\n'), (_, data) => { received.push(data); }, new AbortController().signal);
    expect(received).toEqual([]);
  });
});
