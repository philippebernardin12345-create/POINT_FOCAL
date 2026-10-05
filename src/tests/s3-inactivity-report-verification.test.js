const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const service = require('../core/opportunity-inactivity.service');

const { RESULT, classifyHttp, getAssignedReceiver } = service;

test('404 et 410 confirment une disparition claire', () => {
  assert.equal(classifyHttp({ status: 404, body: '' }), RESULT.CONFIRMED);
  assert.equal(classifyHttp({ status: 410, body: '' }), RESULT.CONFIRMED);
});

test('5xx, timeout HTTP et rate-limit restent indéterminés', () => {
  assert.equal(classifyHttp({ status: 500, body: '' }), RESULT.INDETERMINATE);
  assert.equal(classifyHttp({ status: 503, body: '' }), RESULT.INDETERMINATE);
  assert.equal(classifyHttp({ status: 408, body: '' }), RESULT.INDETERMINATE);
  assert.equal(classifyHttp({ status: 429, body: '' }), RESULT.INDETERMINATE);
});

test('une page normale reste active', () => {
  assert.equal(classifyHttp({ status: 200, body: '<html>profil actif</html>' }), RESULT.ACTIVE);
});

test('un marqueur explicite de compte supprimé peut confirmer malgré HTTP 200', () => {
  assert.equal(classifyHttp({ status: 200, body: '<p>Compte supprimé</p>' }), RESULT.CONFIRMED);
});

test('le signaleur X conduit au compte destinataire Y et au lien de Y', async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (calls.length === 1) return { rows: [{ sponsor_user_id: 'Y' }] };
      if (calls.length === 2) return { rows: [{ user_id: 'Y', referral_link: 'https://business.example/y' }] };
      throw new Error('unexpected query');
    }
  };

  const result = await getAssignedReceiver(client, 'X', 'BUSINESS-A');
  assert.deepEqual(result, {
    unavailableUserId: 'Y',
    assignedReferralLink: 'https://business.example/y'
  });
  assert.deepEqual(calls[0].params, ['X', 'BUSINESS-A']);
  assert.deepEqual(calls[1].params, ['Y', 'BUSINESS-A']);
});

test('invariant source: reporter et compte indisponible restent distincts', () => {
  const source = fs.readFileSync(path.join(__dirname, '../core/opportunity-inactivity.service.js'), 'utf8');
  assert.match(source, /reporterUserId/);
  assert.match(source, /unavailableUserId/);
  assert.match(source, /sponsor_user_id/);
  assert.doesNotMatch(source, /getOwnedReferralLink/);
});

test('migration 013 est additive et ne touche ni sponsor global ni racine', () => {
  const migration = fs.readFileSync(path.join(__dirname, '../db/migrations/013_s1_inactivity_reporter_assignment.sql'), 'utf8');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS reporter_user_id/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS assigned_referral_link/);
  assert.doesNotMatch(migration, /UPDATE\s+users/i);
  assert.doesNotMatch(migration, /root_user_id\s*=/i);
});
