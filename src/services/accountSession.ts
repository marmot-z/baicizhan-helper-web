// 与 store 解耦，供请求层和异步学习任务判断所属会话。
let version = 0;
let switching = false;
const requests = new Set<Promise<void>>();

export class AccountSessionChangedError extends Error {
  constructor() {
    super('账号会话已变化或正在切换');
    this.name = 'AccountSessionChangedError';
  }
}

export const accountSession = {
  getVersion: () => version,
  isSwitching: () => switching,
  setSwitching(value: boolean) { switching = value; },
  invalidate() { version += 1; },
  assertCurrent(expected: number) {
    if (expected !== version) {
      throw new AccountSessionChangedError();
    }
  },
  trackRequest(): () => void {
    let finish!: () => void;
    const request = new Promise<void>((resolve) => { finish = resolve; });
    requests.add(request);
    return () => {
      requests.delete(request);
      finish();
    };
  },
  async waitForRequests(): Promise<void> {
    while (requests.size > 0) {
      await Promise.all([...requests]);
    }
  },
};
