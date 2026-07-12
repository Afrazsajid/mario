"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const validation = require("../shared/validation");
const { RateLimiter } = require("../server/rateLimiter");

test("invalid player names are rejected", () => {
  assert.equal(validation.validateName("A").ok, false);
  assert.equal(validation.validateName("This name is far too long").ok, false);
  assert.equal(validation.validateName("<script>").ok, false);
  assert.deepEqual(validation.validateName(" Nova-7 ").value, "Nova-7");
});

test("malformed input packets are rejected", () => {
  assert.equal(validation.sanitizeInputPacket(null).ok, false);
  assert.equal(validation.sanitizeInputPacket({ sequence: 1, x: 99 }).ok, false);
  assert.equal(validation.sanitizeInputPacket({ sequence: -1 }).ok, false);
  assert.equal(validation.sanitizeInputPacket({ sequence: 42, left: true }).value.left, true);
});

test("excessive input rate is limited", () => {
  const limiter = new RateLimiter({ windowMs: 1000, max: 2 });
  assert.equal(limiter.allow("socket"), true);
  assert.equal(limiter.allow("socket"), true);
  assert.equal(limiter.allow("socket"), false);
});
