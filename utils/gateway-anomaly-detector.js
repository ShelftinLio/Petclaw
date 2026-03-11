// Gateway 异常检测器
class GatewayAnomalyDetector {
  constructor(metricsCollector) {
    this.metrics = metricsCollector;
    this.baseline = {
      avgResponseTime: 0,
      successRate: 1.0,
      lastUpdate: 0
    };
    this.anomalies = [];
    this.maxAnomalies = 20;
    // 同类型异常冷却期（防止同一类异常刷屏）
    this._lastReportTime = {};
    this._cooldownMs = 5 * 60 * 1000; // 5 分钟内同类型不重复报
  }

  // 检查某类异常是否在冷却期内
  _isInCooldown(type) {
    const last = this._lastReportTime[type];
    if (!last) return false;
    return Date.now() - last < this._cooldownMs;
  }

  _markReported(type) {
    this._lastReportTime[type] = Date.now();
  }

  detectAnomalies() {
    const anomalies = [];
    const now = Date.now();

    // 至少要有 10 次检查数据才做异常检测，避免样本太少时误判
    if (this.metrics.metrics.requests.length < 10) {
      return anomalies;
    }

    // 1. 响应时间异常
    const currentAvg = this.metrics.getAverageResponseTime();
    if (this.baseline.avgResponseTime > 0 && currentAvg > 0) {
      const increase = (currentAvg - this.baseline.avgResponseTime) / this.baseline.avgResponseTime;
      if (increase > 2.0 && !this._isInCooldown('response_time_spike')) {
        anomalies.push({
          type: 'response_time_spike',
          severity: 'high',
          message: `响应时间激增 ${Math.round(increase * 100)}%`,
          current: currentAvg,
          baseline: this.baseline.avgResponseTime,
          timestamp: now
        });
        this._markReported('response_time_spike');
      } else if (increase > 1.0 && !this._isInCooldown('response_time_degradation')) {
        anomalies.push({
          type: 'response_time_degradation',
          severity: 'medium',
          message: `响应时间上升 ${Math.round(increase * 100)}%`,
          current: currentAvg,
          baseline: this.baseline.avgResponseTime,
          timestamp: now
        });
        this._markReported('response_time_degradation');
      }
    }

    // 2. 成功率下降（阈值降低到 70%，避免瞬时波动触发）
    const currentSuccessRate = this.metrics.getSuccessRate();
    if (currentSuccessRate < 0.70 && !this._isInCooldown('success_rate_drop')) {
      anomalies.push({
        type: 'success_rate_drop',
        severity: currentSuccessRate < 0.50 ? 'high' : 'medium',
        message: `成功率下降到 ${Math.round(currentSuccessRate * 100)}%`,
        current: currentSuccessRate,
        baseline: this.baseline.successRate,
        timestamp: now
      });
      this._markReported('success_rate_drop');
    }

    // 3. 错误率激增
    const recentErrors = this.metrics.getRecentErrors(10);
    const errorTypes = {};
    recentErrors.forEach(e => {
      errorTypes[e.error] = (errorTypes[e.error] || 0) + 1;
    });

    for (const [errorType, count] of Object.entries(errorTypes)) {
      if (count >= 5 && !this._isInCooldown('error_burst_' + errorType)) {
        anomalies.push({
          type: 'error_burst',
          severity: 'high',
          message: `${errorType} 错误频发 (${count} 次)`,
          errorType,
          count,
          timestamp: now
        });
        this._markReported('error_burst_' + errorType);
      }
    }

    // 4. P99 响应时间过高
    const p99 = this.metrics.getResponseTimePercentile(99);
    if (p99 > 10000 && !this._isInCooldown('p99_high')) {
      anomalies.push({
        type: 'p99_high',
        severity: 'medium',
        message: `P99 响应时间过高 (${p99}ms)`,
        current: p99,
        timestamp: now
      });
      this._markReported('p99_high');
    }

    // 记录异常历史
    anomalies.forEach(a => {
      this.anomalies.unshift(a);
    });

    if (this.anomalies.length > this.maxAnomalies) {
      this.anomalies = this.anomalies.slice(0, this.maxAnomalies);
    }

    return anomalies;
  }

  updateBaseline() {
    const avg = this.metrics.getAverageResponseTime();
    const rate = this.metrics.getSuccessRate();

    // 只在有足够数据时更新基线
    if (avg > 0 && this.metrics.metrics.requests.length >= 10) {
      this.baseline.avgResponseTime = avg;
      this.baseline.successRate = rate;
      this.baseline.lastUpdate = Date.now();
    }
  }

  getRecentAnomalies(limit = 10) {
    return this.anomalies.slice(0, limit);
  }

  clearAnomalies() {
    this.anomalies = [];
  }
}

module.exports = GatewayAnomalyDetector;
