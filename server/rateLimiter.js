"use strict";

class RateLimiter {
  constructor(options) {
    this.windowMs = options.windowMs;
    this.max = options.max;
    this.hits = new Map();
  }

  allow(key) {
    const now = Date.now();
    const bucket = this.hits.get(key) || [];
    const kept = bucket.filter((time) => now - time < this.windowMs);
    if (kept.length >= this.max) {
      this.hits.set(key, kept);
      return false;
    }
    kept.push(now);
    this.hits.set(key, kept);
    return true;
  }

  clear() {
    this.hits.clear();
  }
}

module.exports = { RateLimiter };
