import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Import pure utility function directly from pushNotificationService
import {
  urlBase64ToUint8Array,
  isPushSupported,
  getVapidPublicKey,
} from '../src/modules/notifications/services/pushNotificationService.ts';

describe('Web Push Notifications Infrastructure [SP2-10]', () => {
  const rootDir = process.cwd();

  describe('pushNotificationService - VAPID & Utilities', () => {
    it('urlBase64ToUint8Array correctly decodes standard base64 and url-safe base64', () => {
      // "hello world" in url-safe base64 is "aGVsbG8td29ybGQ" or standard "aGVsbG8td29ybGQ="
      const sample = 'BNc9v8pL_42-testKey';
      const result = urlBase64ToUint8Array(sample);

      assert.ok(result instanceof Uint8Array);
      assert.ok(result.length > 0);
    });

    it('urlBase64ToUint8Array handles padding correctly', () => {
      // 1 char remainder, 2 char remainder, 3 char remainder
      const str1 = 'YW5nZWw'; // length 7 -> needs 1 '='
      const str2 = 'YnJ1bm8'; // length 7
      const arr1 = urlBase64ToUint8Array(str1);
      const arr2 = urlBase64ToUint8Array(str2);

      assert.ok(arr1.length > 0);
      assert.ok(arr2.length > 0);
      assert.equal(String.fromCharCode(...arr1), 'angel');
      assert.equal(String.fromCharCode(...arr2), 'bruno');
    });

    it('isPushSupported safely returns false in Node environment without crashing', () => {
      const supported = isPushSupported();
      assert.equal(typeof supported, 'boolean');
      assert.equal(supported, false); // Node doesn't have ServiceWorker/PushManager
    });

    it('getVapidPublicKey returns string without throwing', () => {
      const key = getVapidPublicKey();
      assert.equal(typeof key, 'string');
    });
  });

  describe('Supabase Migration: push_subscriptions table & RLS', () => {
    const migrationPath = resolve(rootDir, 'supabase/migrations/20261006000000_push_subscriptions.sql');

    it('migration file exists in supabase/migrations/', () => {
      assert.ok(existsSync(migrationPath), 'Migration file must exist');
    });

    it('migration enforces table structure, foreign keys and constraints', () => {
      const content = readFileSync(migrationPath, 'utf-8');

      assert.match(content, /CREATE TABLE IF NOT EXISTS public\.push_subscriptions/, 'Must create push_subscriptions table');
      assert.match(content, /id uuid NOT NULL DEFAULT gen_random_uuid\(\) PRIMARY KEY/, 'Must have id uuid PK');
      assert.match(content, /user_id uuid NOT NULL REFERENCES public\.profiles\(id\) ON DELETE CASCADE/, 'Must reference profiles(id) with CASCADE');
      assert.match(content, /endpoint text NOT NULL UNIQUE/, 'Must have unique endpoint');
      assert.match(content, /p256dh text NOT NULL/, 'Must have p256dh key');
      assert.match(content, /auth text NOT NULL/, 'Must have auth secret');
      assert.match(content, /created_at timestamptz/, 'Must have created_at timestamp');
    });

    it('migration enables and enforces strict RLS policies on user_id', () => {
      const content = readFileSync(migrationPath, 'utf-8');

      assert.match(content, /ALTER TABLE public\.push_subscriptions ENABLE ROW LEVEL SECURITY;/, 'Must enable RLS');
      assert.match(content, /CREATE POLICY push_subscriptions_select_own[\s\S]*?auth\.uid\(\)\s*=\s*user_id/, 'SELECT must enforce auth.uid() = user_id');
      assert.match(content, /CREATE POLICY push_subscriptions_insert_own[\s\S]*?auth\.uid\(\)\s*=\s*user_id/, 'INSERT must enforce auth.uid() = user_id');
      assert.match(content, /CREATE POLICY push_subscriptions_update_own[\s\S]*?auth\.uid\(\)\s*=\s*user_id/, 'UPDATE must enforce auth.uid() = user_id');
      assert.match(content, /CREATE POLICY push_subscriptions_delete_own[\s\S]*?auth\.uid\(\)\s*=\s*user_id/, 'DELETE must enforce auth.uid() = user_id');
      assert.match(content, /CREATE POLICY push_subscriptions_service_role/, 'Must have service_role policy for backend dispatch');
    });
  });

  describe('UI & Module Integration', () => {
    it('SettingsScreen incorporates PushNotificationSettingsRow', () => {
      const settingsScreenPath = resolve(rootDir, 'src/features/settings/screens/SettingsScreen.tsx');
      const content = readFileSync(settingsScreenPath, 'utf-8');

      assert.match(content, /PushNotificationSettingsRow/, 'SettingsScreen must include PushNotificationSettingsRow');
      assert.match(content, /Notificaciones y Alertas/, 'SettingsScreen must have Notificaciones y Alertas section');
    });

    it('AgendaView incorporates AgendaPushNotificationBanner', () => {
      const agendaViewPath = resolve(rootDir, 'src/views/agenda/AgendaView.tsx');
      const content = readFileSync(agendaViewPath, 'utf-8');

      assert.match(content, /AgendaPushNotificationBanner/, 'AgendaView must include AgendaPushNotificationBanner');
    });

    it('usePushNotifications hook exports expected contract', () => {
      const hookPath = resolve(rootDir, 'src/modules/notifications/hooks/usePushNotifications.ts');
      const content = readFileSync(hookPath, 'utf-8');

      assert.match(content, /export interface UsePushNotificationsReturn/, 'Must export return type');
      assert.match(content, /export function usePushNotifications/, 'Must export usePushNotifications hook');
      assert.match(content, /isSupported/, 'Must return isSupported');
      assert.match(content, /isSubscribed/, 'Must return isSubscribed');
      assert.match(content, /permissionState/, 'Must return permissionState');
      assert.match(content, /subscribe/, 'Must return subscribe function');
      assert.match(content, /unsubscribe/, 'Must return unsubscribe function');
    });
  });
});
