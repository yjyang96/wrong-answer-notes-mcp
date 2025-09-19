/**
 * GitHub API 레이트 리미팅 처리 클래스
 */
export class RateLimiter {
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private resetTime: number = 0;
  private readonly minInterval: number = 100; // 최소 요청 간격 (ms)

  /**
   * 레이트 리미팅을 고려하여 대기
   */
  async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    
    // 리셋 시간이 지났으면 카운터 초기화
    if (now > this.resetTime) {
      this.requestCount = 0;
      this.resetTime = now + 3600000; // 1시간 후 리셋
    }

    // 최소 요청 간격 확인
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minInterval) {
      await this.sleep(this.minInterval - timeSinceLastRequest);
    }

    // 시간당 요청 수 제한 확인 (GitHub API: 5000 requests/hour)
    if (this.requestCount >= 5000) {
      const waitTime = this.resetTime - now;
      if (waitTime > 0) {
        console.log(`레이트 리미트 도달. ${waitTime}ms 대기 중...`);
        await this.sleep(waitTime);
        this.requestCount = 0;
        this.resetTime = Date.now() + 3600000;
      }
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * 지정된 시간만큼 대기
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 현재 레이트 리미트 상태 조회
   */
  getRateLimitStatus(): {
    remaining: number;
    resetTime: number;
    used: number;
  } {
    const now = Date.now();
    const remaining = Math.max(0, 5000 - this.requestCount);
    const resetTime = this.resetTime;
    const used = this.requestCount;

    return {
      remaining,
      resetTime,
      used,
    };
  }

  /**
   * 레이트 리미트 정보 업데이트 (GitHub API 응답 헤더에서)
   */
  updateRateLimitInfo(
    remaining: number,
    resetTime: number,
    used: number
  ): void {
    this.requestCount = used;
    this.resetTime = resetTime * 1000; // 초를 밀리초로 변환
  }
}

