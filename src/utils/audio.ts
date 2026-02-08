/**
 * 音频序列播放器
 * 用于管理一组音频的顺序播放，支持中断和资源清理
 */
export class AudioSequencePlayer {
  private audios: HTMLAudioElement[] = [];
  private isCanceled = false;
  private readonly CDN_HOST = 'https://7n.bczcdn.com';

  /**
   * 顺序播放一组音频 URL
   * @param urls 音频地址列表
   * @param interval 两个音频之间的间隔(ms)，默认为0
   */
  async playSequence(urls: (string | undefined | null)[], interval: number = 0): Promise<void> {
    this.isCanceled = false;
    this.audios = [];

    const validUrls = urls.filter((url): url is string => !!url);

    for (const rawUrl of validUrls) {
      if (this.isCanceled) break;

      try {
        const url = rawUrl.startsWith('http') ? rawUrl : this.CDN_HOST + rawUrl;
        await this.playOne(url);
        
        if (this.isCanceled) break;
        
        if (interval > 0) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      } catch (e) {
        console.error(`Failed to play ${rawUrl}`, e);
        // 继续播放下一个
      }
    }
  }

  private playOne(url: string): Promise<void> {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      this.audios.push(audio);

      audio.onended = () => resolve();
      
      audio.onerror = (e) => {
        console.warn(`Audio error: ${url}`, e);
        resolve(); // 出错也视为结束，以便继续播放
      };

      // 处理播放被阻断的情况（如自动播放策略）
      audio.play().catch((e) => {
        console.warn(`Play failed: ${url}`, e);
        resolve();
      });
    });
  }

  /**
   * 停止当前播放并清理
   */
  stop(): void {
    this.isCanceled = true;
    this.audios.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
      audio.src = ''; // 释放资源
    });
    this.audios = [];
  }
}
