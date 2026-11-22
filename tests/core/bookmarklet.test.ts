import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBookmarkletUrl } from '../../src/utils/bookmarklet.ts';

test('buildBookmarkletUrl returns a valid single-line javascript: URL with zero raw % characters', () => {
  const url = buildBookmarkletUrl();
  assert.ok(url.startsWith('javascript:('), 'Must start with javascript:(');
  assert.ok(url.endsWith(')();'), 'Must end with )();');
  assert.equal(url.includes('\n'), false, 'Must not contain newlines');
  assert.equal(url.includes('\r'), false, 'Must not contain carriage returns');
  assert.equal(url.includes('%'), false, 'Must not contain raw % characters (prevents mobile browser URIError)');

  const jsBody = url.slice('javascript:'.length);
  const decodedJsBody = decodeURIComponent(jsBody);
  assert.doesNotThrow(() => new Function(jsBody), 'Raw JS body must compile cleanly');
  assert.doesNotThrow(() => new Function(decodedJsBody), 'Decoded JS body must compile cleanly');
});

test('Bookmarklet extracts village buildings, troops (home + away), market rates, and sends Firestore commit', async () => {
  const url = buildBookmarkletUrl();
  const jsBody = decodeURIComponent(url.slice('javascript:'.length));

  let firestoreBody: any = null;
  let copiedString = '';

  const mockDoc: any = {
    body: {
      appendChild() {}
    },
    documentElement: {
      innerHTML: '<span>+18% إنتاج الموارد</span>'
    },
    getElementById(id: string) {
      if (id === 'premium_exchange_rate_wood') return { textContent: '320' };
      if (id === 'premium_exchange_rate_stone') return { textContent: '280' };
      if (id === 'premium_exchange_rate_iron') return { textContent: '300' };
      return null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    createElement() {
      return {
        style: {},
        setAttribute() {},
        focus() {},
        select() {},
        setSelectionRange() {},
        remove() {}
      };
    },
    execCommand(cmd: string) {
      if (cmd === 'copy') return true;
      return false;
    }
  };

  const mockWin: any = {
    location: {
      pathname: '/game.php',
      search: '?village=551&screen=overview'
    },
    navigator: {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36',
      maxTouchPoints: 5,
      clipboard: {
        writeText(txt: string) {
          copiedString = txt;
          return Promise.resolve();
        }
      }
    },
    isSecureContext: true,
    screen: { width: 412, height: 915 },
    localStorage: {
      _data: {} as Record<string, string>,
      getItem(k: string) {
        return this._data[k] || null;
      },
      setItem(k: string, v: string) {
        this._data[k] = v;
      }
    },
    game_data: {
      world: 'ae95',
      player: {
        name: 'أبو سلطان',
        id: '9911',
        pp: 450,
        premium: true
      },
      village: {
        id: 551,
        name: 'قرية الأسود',
        coord: '495|502',
        points: 1250,
        wood: 4200,
        stone: 5100,
        iron: 3800,
        storage_max: 12291,
        pop: 890,
        pop_max: 1174,
        buildings: {
          main: '15',
          barracks: '10',
          wood: '21',
          stone: '22',
          iron: '19',
          storage: '14',
          farm: '11',
          market: '8',
          smith: '5',
          wall: '12',
          place: '1',
          statue: '1'
        },
        bonus: {
          wood: 1.1,
          stone: 1.0,
          iron: 1.0
        }
      }
    },
    ScavengeScreen: {
      village: {
        unit_counts_home: { spear: 120, sword: 30, axe: 45, spy: 10, light: 25, heavy: 5 },
        options: {
          '1': {
            is_locked: false,
            scavenging_squad: {
              return_time: Math.floor(Date.now() / 1000) + 1800,
              loot_res: { wood: 300, stone: 300, iron: 300 },
              unit_counts: { spear: 80, sword: 20, axe: 15, spy: 2, light: 15, heavy: 5 }
            }
          },
          '2': {
            is_locked: false,
            scavenging_squad: null
          }
        }
      }
    }
  };

  const mockFetch = async (input: string, init?: any) => {
    if (input.includes(':commit')) {
      firestoreBody = JSON.parse(init.body);
      return { ok: true, json: async () => ({}) };
    }
    if (input.includes('api4.ipify.org')) {
      return { ok: true, json: async () => ({ ip: '156.210.44.12' }) };
    }
    return { ok: true, text: async () => '' };
  };

  const prevWin = (globalThis as any).window;
  const prevDoc = (globalThis as any).document;
  const prevFetch = (globalThis as any).fetch;

  try {
    (globalThis as any).window = mockWin;
    (globalThis as any).document = mockDoc;
    (globalThis as any).fetch = mockFetch;

    const fn = new Function(jsBody);
    fn();

    await new Promise((r) => setTimeout(r, 30));

    assert.ok(copiedString, 'Must copy village sync JSON to clipboard');
    const parsed = JSON.parse(copiedString);
    assert.equal(parsed.playerName, 'أبو سلطان');
    assert.equal(parsed.name, 'قرية الأسود');
    assert.equal(parsed.coord, '495|502');
    assert.equal(parsed.continent, '54');
    assert.equal(parsed.buildings['المبنى الرئيسي'], 15);
    assert.equal(parsed.buildings['الخشاب'], 21);
    assert.equal(parsed.buildings['حفرة الطمي'], 22);
    assert.equal(parsed.buildings['منجم الحديد'], 19);
    assert.equal(parsed.spearsHome, 120);
    assert.equal(parsed.spearsAway, 80);
    assert.equal(parsed.spearsTotal, 200);
    assert.equal(parsed.swordsHome, 30);
    assert.equal(parsed.swordsAway, 20);
    assert.equal(parsed.swordsTotal, 50);
    assert.equal(parsed.axesHome, 45);
    assert.equal(parsed.axesAway, 15);
    assert.equal(parsed.axesTotal, 60);
    assert.equal(parsed.spiesHome, 10);
    assert.equal(parsed.spiesAway, 2);
    assert.equal(parsed.spiesTotal, 12);
    assert.equal(parsed.lightsHome, 25);
    assert.equal(parsed.lightsAway, 15);
    assert.equal(parsed.lightsTotal, 40);
    assert.equal(parsed.heaviesHome, 5);
    assert.equal(parsed.heaviesAway, 5);
    assert.equal(parsed.heaviesTotal, 10);
    assert.equal(parsed.unitsTotal.light, 40);
    assert.equal(parsed.unitsTotal.heavy, 10);
    assert.equal(parsed.unlockedScavTiers, 2);
    assert.equal(parsed.marketSellRate, 300);
    assert.equal(parsed.ip, '156.210.44.12');

    assert.ok(firestoreBody, 'Must send Firestore :commit request');
    const fields = firestoreBody.writes[0].update.fields;
    assert.equal(fields.syncId.stringValue, 'sync_ae95_551');
    assert.equal(fields.villageName.stringValue, 'قرية الأسود');
    assert.equal(fields.playerName.stringValue, 'أبو سلطان');
    assert.equal(fields.payloadJson.stringValue, copiedString);
  } finally {
    (globalThis as any).window = prevWin;
    (globalThis as any).document = prevDoc;
    (globalThis as any).fetch = prevFetch;
  }
});
