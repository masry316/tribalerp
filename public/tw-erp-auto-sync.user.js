// ==UserScript==
// @name         TW Smart ERP — Unified Auto-Sync & Safe Advisor v6.0
// @namespace    https://tribalwars-erp.local/
// @version      6.0.0
// @description  الإضافة الموحدة الآمنة: مزامنة فورية للقرية والجيوش الـ 12 والـ IP (بدون جهاز/متصفح) + عرض التوصية والخطوة التالية من خطتك داخل اللعبة بأمان تام بدون أي نقر آلي
// @author       TW Command Center
// @match        *://*.tribalwars.ae/game.php*
// @match        *://*.tribalwars.net/game.php*
// @match        *://*.tribalwars.co.uk/game.php*
// @match        *://*.tribalwars.us/game.php*
// @match        *://*.die-staemme.de/game.php*
// @match        *://*.plemiona.pl/game.php*
// @match        *://*.klanlar.org/game.php*
// @match        *://*.guerrastribales.es/game.php*
// @match        *://*.tribals.it/game.php*
// @match        *://*.fyletikesmaxes.gr/game.php*
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      api.ipify.org
// @connect      api64.ipify.org
// @connect      firestore.googleapis.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  const ERP_FIRESTORE_PROJECT_ID = 'linear-freedom-9gxqk';
  const ERP_FIRESTORE_DB_ID = 'ai-studio-erp-58272684-00ec-4692-acb8-6a7218e50c08';
  const ERP_SYNC_COLLECTION_URL =
    `https://firestore.googleapis.com/v1/projects/${ERP_FIRESTORE_PROJECT_ID}/databases/${ERP_FIRESTORE_DB_ID}/documents/incomingVillageSyncs`;

  // All 12 Tribal Wars Units + Scavenging Haul Capacity
  const TW_ALL_UNITS = [
    'spear', 'sword', 'axe', 'archer',
    'spy', 'light', 'marcher', 'heavy',
    'ram', 'catapult', 'knight', 'snob'
  ];

  const TW_UNIT_HAUL = {
    spear: 25,
    sword: 15,
    axe: 10,
    archer: 10,
    spy: 0,
    light: 80,
    marcher: 50,
    heavy: 50,
    ram: 0,
    catapult: 0,
    knight: 100,
    snob: 0
  };

  const TW_UNIT_AR = {
    spear: 'رمح',
    sword: 'سيف',
    axe: 'فأس',
    archer: 'قوس',
    spy: 'كشافة',
    light: 'خفيف',
    marcher: 'فارس قوس',
    heavy: 'ثقيل',
    ram: 'محطمة',
    catapult: 'مقلاع',
    knight: 'قائد فرسان',
    snob: 'نبيل'
  };

  const BLDG_MAP = {
    main: 'المبنى الرئيسي',
    barracks: 'الثكنات',
    stable: 'الإسطبل',
    garage: 'الورشة',
    snob: 'الأكاديمية',
    smith: 'الحداد',
    place: 'نقطة التجمع',
    statue: 'النصب التذكاري',
    market: 'السوق',
    wood: 'الخشاب',
    stone: 'حفرة الطمي',
    iron: 'منجم الحديد',
    farm: 'المزارع',
    storage: 'المخازن',
    hide: 'المخابئ',
    wall: 'الحائط'
  };

  function emptyUnitsMap() {
    const m = {};
    TW_ALL_UNITS.forEach(u => { m[u] = 0; });
    return m;
  }

  function calcTotalHaul(uMap) {
    if (!uMap) return 0;
    let total = 0;
    TW_ALL_UNITS.forEach(u => {
      total += Math.max(0, parseInt(uMap[u], 10) || 0) * (TW_UNIT_HAUL[u] || 0);
    });
    return total;
  }

  function formatUnitsSummaryAr(uMap) {
    if (!uMap) return 'بدون جيش';
    const parts = [];
    TW_ALL_UNITS.forEach(u => {
      const cnt = Math.max(0, parseInt(uMap[u], 10) || 0);
      if (cnt > 0) parts.push(`${cnt} ${TW_UNIT_AR[u] || u}`);
    });
    return parts.length ? parts.join(' • ') : 'بدون جيش';
  }

  function storeGet(key, fallback) {
    try {
      const v = localStorage.getItem('tw_erp_' + key + '_v1') || localStorage.getItem(key);
      return v !== null && v !== undefined && v !== '' ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }

  // Minimal auto-dismissing toast banner (NO menus, NO buttons required)
  function showSyncStatusToast(msg, state = 'loading') {
    try {
      let el = document.getElementById('tw-erp-pure-sync-toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'tw-erp-pure-sync-toast';
        document.body.appendChild(el);
      }
      const bg =
        state === 'loading'
          ? 'linear-gradient(135deg, #0f172a, #1e293b)'
          : state === 'error'
          ? 'linear-gradient(135deg, #7f1d1d, #450a0a)'
          : 'linear-gradient(135deg, #065f46, #064e3b)';
      const border =
        state === 'loading' ? '#38bdf8' : state === 'error' ? '#f87171' : '#34d399';

      el.style.cssText =
        `position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;` +
        `background:${bg};color:#fff;padding:10px 16px;border-radius:12px;` +
        `border:1.5px solid ${border};font:800 12.5px/1.5 Tahoma,Cairo,sans-serif;` +
        `direction:rtl;text-align:center;box-shadow:0 10px 28px rgba(0,0,0,0.65);` +
        `max-width:94vw;width:max-content;pointer-events:none;transition:opacity 0.3s ease;opacity:1;`;
      el.innerHTML = msg;

      if (el.__hideTimer) clearTimeout(el.__hideTimer);
      if (state !== 'loading') {
        el.__hideTimer = setTimeout(() => {
          if (el) el.style.opacity = '0';
          setTimeout(() => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
          }, 350);
        }, 4200);
      }
    } catch (e) {}
  }

  async function fetchText(url, timeoutMs = 6500) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, { credentials: 'include', signal: ctrl.signal });
      clearTimeout(t);
      return await res.text();
    } catch (e) {
      return '';
    }
  }

  async function detectPublicIP() {
    const urls = ['https://api.ipify.org?format=json', 'https://api64.ipify.org?format=json'];
    for (const u of urls) {
      try {
        const c = new AbortController();
        const timer = setTimeout(() => c.abort(), 3000);
        const r = await fetch(u, { signal: c.signal });
        clearTimeout(timer);
        const j = await r.json();
        if (j && j.ip) return String(j.ip).trim();
      } catch (e) {}
    }
    return '';
  }

  // Extract balanced JSON object starting after a key like `"unit_counts_home":`
  function extractJsonObjectsAfterKey(html, keyName) {
    const results = [];
    if (!html || !keyName) return results;
    let searchIdx = 0;
    const pattern = new RegExp(`["']?${keyName}["']?\\s*:\\s*\\{`, 'g');
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const braceStart = html.indexOf('{', match.index + match[0].length - 1);
      if (braceStart === -1) continue;
      let depth = 0;
      let inStr = false;
      let esc = false;
      let endIdx = -1;
      for (let i = braceStart; i < Math.min(html.length, braceStart + 5000); i++) {
        const ch = html[i];
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"' || ch === "'") { inStr = !inStr; continue; }
        if (!inStr) {
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) {
              endIdx = i;
              break;
            }
          }
        }
      }
      if (endIdx !== -1) {
        const rawJson = html.slice(braceStart, endIdx + 1);
        try {
          results.push(JSON.parse(rawJson));
        } catch (e) {
          // Fallback regex extraction of unit counts inside rawJson
          const obj = {};
          TW_ALL_UNITS.forEach(u => {
            const um = rawJson.match(new RegExp(`["']?${u}["']?\\s*:\\s*(\\d+)`, 'i'));
            if (um) obj[u] = parseInt(um[1], 10) || 0;
          });
          if (Object.keys(obj).length > 0) results.push(obj);
        }
      }
      searchIdx = endIdx !== -1 ? endIdx + 1 : match.index + 1;
      pattern.lastIndex = searchIdx;
    }
    return results;
  }

  function parseBuildingsFromHtml(doc, html) {
    const res = {};
    let gotFromGameData = false;
    // 1. From live W.game_data.village.buildings (authoritative for current village)
    try {
      const b = W.game_data && W.game_data.village && W.game_data.village.buildings;
      if (b && typeof b === 'object') {
        Object.keys(BLDG_MAP).forEach(k => {
          if (b[k] !== undefined) {
            res[BLDG_MAP[k]] = parseInt(b[k], 10) || 0;
            gotFromGameData = true;
          }
        });
      }
    } catch (e) {}

    // 2. Fallback from fetched HTML game_data JSON only if live game_data didn't have buildings
    if (!gotFromGameData && html) {
      const m = html.match(/"buildings"\s*:\s*(\{[^}]+\})/);
      if (m) {
        try {
          const b = JSON.parse(m[1]);
          Object.keys(BLDG_MAP).forEach(k => {
            if (b[k] !== undefined) res[BLDG_MAP[k]] = parseInt(b[k], 10) || 0;
          });
        } catch (e) {}
      }
    }

    // 3. Fallback from #buildings_table rows in main HQ
    if (!gotFromGameData && doc) {
      Object.keys(BLDG_MAP).forEach(k => {
        const row = doc.querySelector(`#main_buildrow_${k}, tr[id*="buildrow_${k}"]`);
        if (row) {
          const txt = row.textContent || '';
          const lvMatch = txt.match(/(?:المستوى|مستوى|Level)\s*(\d+)/i);
          if (lvMatch) res[BLDG_MAP[k]] = parseInt(lvMatch[1], 10) || 0;
        }
      });
    }
    return res;
  }

  function parseBuildQueueFromDoc(doc, nowSec) {
    const queue = [];
    if (!doc) return { queue, finishAt: 0 };
    const rows = doc.querySelectorAll('#buildqueue tr.buildorder_storage, #buildqueue tr[class*="buildorder_"], #buildqueue tr.lit');
    let maxFinish = 0;
    rows.forEach(r => {
      const bCell = r.querySelector('td:first-child');
      const timerSpan = r.querySelector('span.timer, span[data-endtime]');
      if (!bCell) return;
      const rawTxt = (bCell.textContent || '').replace(/\s+/g, ' ').trim();
      const endSec = timerSpan && timerSpan.getAttribute('data-endtime')
        ? parseInt(timerSpan.getAttribute('data-endtime'), 10) * 1000
        : 0;
      if (endSec > maxFinish) maxFinish = endSec;
      queue.push({ title: rawTxt, finishAt: endSec || 0 });
    });
    return { queue, finishAt: maxFinish };
  }

  // Parse all 12 units from `screen=place&mode=units` HTML using colSpan-aware column positions
  function parsePlaceUnitsScreen(html) {
    const home = emptyUnitsMap();
    const away = emptyUnitsMap();
    const total = emptyUnitsMap();
    let foundAny = false;
    if (!html) return { foundAny, home, away, total };

    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const table = doc.querySelector('#units_home') || doc.querySelector('table.vis');
      if (!table) return { foundAny, home, away, total };

      // Identify logical column positions (accounting for colspan) from header row icons or data-unit attributes
      const colPosToUnit = {};
      const headerRow = table.querySelector('tr');
      if (headerRow) {
        const cells = headerRow.querySelectorAll('th, td');
        let colPos = 0;
        cells.forEach((cell) => {
          const span = Math.max(1, parseInt(cell.getAttribute('colspan'), 10) || cell.colSpan || 1);
          const du = cell.getAttribute('data-unit');
          if (du && TW_ALL_UNITS.includes(du)) {
            colPosToUnit[colPos] = du;
          } else {
            const img = cell.querySelector('img[src*="unit_"], a[data-unit]');
            if (img) {
              const uAttr = img.getAttribute('data-unit');
              if (uAttr && TW_ALL_UNITS.includes(uAttr)) {
                colPosToUnit[colPos] = uAttr;
              } else {
                const src = img.getAttribute('src') || '';
                TW_ALL_UNITS.forEach(u => {
                  if (src.includes(`unit_${u}.`) || src.includes(`unit_${u}_`)) colPosToUnit[colPos] = u;
                });
              }
            }
          }
          colPos += span;
        });
      }

      const rows = Array.from(table.querySelectorAll('tr')).slice(1);
      rows.forEach((tr, rIdx) => {
        const rowTxt = (tr.textContent || '').trim();
        const cells = tr.querySelectorAll('td, th');
        if (cells.length < 5) return;

        const isTotalRow = /المجموع|الإجمالي|Total|Insgesamt/i.test(rowTxt) || tr.classList.contains('row_marker');
        const isOwnHomeRow = !isTotalRow && (rIdx === 0 || /من هذه القرية|في القرية|own|In dieser|W wiosce/i.test(rowTxt));
        const isAwayRow = !isTotalRow && !isOwnHomeRow && /خارج|في القرى الأخرى|في الطريق|طريق|الدعم|outwards|transit|other/i.test(rowTxt);

        let colPos = 0;
        cells.forEach((cell) => {
          const span = Math.max(1, parseInt(cell.getAttribute('colspan'), 10) || cell.colSpan || 1);
          let u = colPosToUnit[colPos];
          // Also check if cell itself has unit-item-<unit> class or data-unit attribute
          if (!u) {
            const du = cell.getAttribute('data-unit');
            if (du && TW_ALL_UNITS.includes(du)) u = du;
            else {
              const cls = cell.className || '';
              TW_ALL_UNITS.forEach(unitKey => {
                if (cls.includes(`unit-item-${unitKey}`)) u = unitKey;
              });
            }
          }
          if (u) {
            const val = parseInt((cell.textContent || '').replace(/[^\d]/g, ''), 10) || 0;
            if (val > 0) foundAny = true;
            if (isTotalRow) {
              total[u] = Math.max(total[u], val);
            } else if (isOwnHomeRow && rIdx === 0) {
              home[u] = Math.max(home[u], val);
            } else if (isAwayRow) {
              away[u] += val;
            }
          }
          colPos += span;
        });
      });
    } catch (e) {}

    return { foundAny, home, away, total };
  }

  // Parse all 12 units from `screen=train` (Recruitment screen shows `home/total` for every unlocked unit!)
  function parseTrainScreenUnits(html) {
    const home = emptyUnitsMap();
    const total = emptyUnitsMap();
    let foundAny = false;
    if (!html) return { foundAny, home, total };

    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const rows = doc.querySelectorAll('#train_form tr.row_a, #train_form tr.row_b, table.vis tr');
      rows.forEach(tr => {
        let unitKey = '';
        const input = tr.querySelector('input[name]');
        if (input && TW_ALL_UNITS.includes(input.getAttribute('name'))) {
          unitKey = input.getAttribute('name');
        } else {
          const link = tr.querySelector('a[data-unit], img[src*="unit_"]');
          if (link) {
            const du = link.getAttribute('data-unit');
            if (du && TW_ALL_UNITS.includes(du)) unitKey = du;
            else {
              const src = link.getAttribute('src') || '';
              TW_ALL_UNITS.forEach(u => {
                if (src.includes(`unit_${u}.`) || src.includes(`unit_${u}_`)) unitKey = u;
              });
            }
          }
        }
        if (!unitKey) return;

        // Look for cell with pattern `home/total` like `35/120`
        const cells = tr.querySelectorAll('td');
        cells.forEach(td => {
          const txt = (td.textContent || '').trim();
          const m = txt.match(/^(\d+)\s*\/\s*(\d+)$/);
          if (m) {
            const hVal = parseInt(m[1], 10) || 0;
            const tVal = parseInt(m[2], 10) || 0;
            home[unitKey] = Math.max(home[unitKey], hVal);
            total[unitKey] = Math.max(total[unitKey], tVal);
            if (hVal > 0 || tVal > 0) foundAny = true;
          }
        });
      });
    } catch (e) {}

    return { foundAny, home, total };
  }

  // Parse Overview screen units (`#show_units` widget shows village total; `.units-entry-all` shows rally/scav home)
  function parseOverviewUnits(html, liveDoc) {
    const home = emptyUnitsMap();
    const total = emptyUnitsMap();
    let foundAny = false;

    const scanDoc = (doc) => {
      if (!doc) return;
      // `#show_units` table in village overview shows TOTAL units (including scavenging) unless distinguished
      const unitRows = doc.querySelectorAll('#show_units tr, #unit_overview_table tr');
      unitRows.forEach(tr => {
        const htmlStr = tr.innerHTML || '';
        const txt = (tr.textContent || '').trim();
        TW_ALL_UNITS.forEach(u => {
          if (htmlStr.includes(`unit_${u}.`) || htmlStr.includes(`unit_${u}_`) || htmlStr.includes(`data-unit="${u}"`)) {
            const b = tr.querySelector('strong, b');
            const numMatch = b ? (b.textContent || '').match(/(\d+)/) : txt.match(/(\d+)/);
            if (numMatch) {
              const v = parseInt(numMatch[1], 10) || 0;
              if (v > 0) {
                total[u] = Math.max(total[u], v);
                foundAny = true;
              }
            }
          }
        });
      });

      // `a.units-entry-all[data-unit]` on Rally Point / Scavenge is strictly units currently at home
      const entryLinks = doc.querySelectorAll('[data-unit].units-entry-all, a.units-entry-all[data-unit]');
      entryLinks.forEach(el => {
        const u = el.getAttribute('data-unit');
        if (u && TW_ALL_UNITS.includes(u)) {
          const m = (el.textContent || '').replace(/[.,]/g, '').match(/(\d+)/);
          if (m) {
            const v = parseInt(m[1], 10) || 0;
            home[u] = Math.max(home[u], v);
            if (v > 0) foundAny = true;
          }
        }
      });
    };

    if (liveDoc) scanDoc(liveDoc);
    if (html) {
      try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        scanDoc(doc);
      } catch (e) {}
    }

    return { foundAny, home, total };
  }

  // Parse Scavenge Screen (live `W.ScavengeScreen` + fetched `place&mode=scavenge` HTML)
  function parseScavengeData(scavHtml) {
    const unitsHome = emptyUnitsMap();
    const unitsAwayScav = emptyUnitsMap();
    let unlockedTiers = 0;
    let activeMissions = 0;
    let finishAt = 0;
    const loot = { wood: 0, clay: 0, iron: 0 };
    let gotHomeFromScav = false;
    let gotSquadsFromLive = false;

    // 1. Check live `W.ScavengeScreen` if user is currently on Scavenge page
    try {
      const sc = W.ScavengeScreen;
      if (sc && sc.village) {
        const uh = sc.village.unit_counts_home || sc.village.units;
        if (uh && typeof uh === 'object') {
          TW_ALL_UNITS.forEach(u => {
            if (uh[u] !== undefined) {
              const cnt = typeof uh[u] === 'object' ? (parseInt(uh[u].count ?? uh[u], 10) || 0) : (parseInt(uh[u], 10) || 0);
              unitsHome[u] = Math.max(unitsHome[u], cnt);
              gotHomeFromScav = true;
            }
          });
        }
        const opts = sc.village.options || {};
        Object.keys(opts).forEach(k => {
          const o = opts[k];
          if (!o) return;
          if (!o.is_locked && !o.is_locked_by_other) unlockedTiers++;
          const sq = o.scavenging_squad;
          if (sq) {
            activeMissions++;
            const rt = (parseInt(sq.return_time, 10) || 0) * 1000;
            if (rt > finishAt) finishAt = rt;
            const uc = sq.unit_counts || {};
            TW_ALL_UNITS.forEach(u => {
              unitsAwayScav[u] += parseInt(uc[u], 10) || 0;
            });
            gotSquadsFromLive = true;
            if (sq.loot_res) {
              loot.wood += parseInt(sq.loot_res.wood, 10) || 0;
              loot.clay += parseInt(sq.loot_res.stone || sq.loot_res.clay, 10) || 0;
              loot.iron += parseInt(sq.loot_res.iron, 10) || 0;
            }
          }
        });
      }
    } catch (e) {}

    // 2. Parse fetched `scavHtml`
    if (scavHtml) {
      // 2a. Extract `unit_counts_home` JSON blocks
      const homeObjs = extractJsonObjectsAfterKey(scavHtml, 'unit_counts_home');
      homeObjs.forEach(obj => {
        TW_ALL_UNITS.forEach(u => {
          if (obj[u] !== undefined) {
            unitsHome[u] = Math.max(unitsHome[u], parseInt(obj[u], 10) || 0);
            gotHomeFromScav = true;
          }
        });
      });

      // 2b. Extract `a.units-entry-all[data-unit]` from scavHtml DOM
      try {
        const doc = new DOMParser().parseFromString(scavHtml, 'text/html');
        doc.querySelectorAll('[data-unit].units-entry-all, a.units-entry-all[data-unit]').forEach(el => {
          const u = el.getAttribute('data-unit');
          if (u && TW_ALL_UNITS.includes(u)) {
            const m = (el.textContent || '').replace(/[.,]/g, '').match(/(\d+)/);
            if (m) {
              unitsHome[u] = Math.max(unitsHome[u], parseInt(m[1], 10) || 0);
              gotHomeFromScav = true;
            }
          }
        });
      } catch (e) {}

      // 2c. Extract active scavenging squads if not already read from live W.ScavengeScreen
      if (!gotSquadsFromLive) {
        const squadObjs = extractJsonObjectsAfterKey(scavHtml, 'scavenging_squad');
        squadObjs.forEach(sq => {
          if (!sq || typeof sq !== 'object') return;
          const rt = (parseInt(sq.return_time, 10) || 0) * 1000;
          if (rt > 0) {
            activeMissions++;
            if (rt > finishAt) finishAt = rt;
          }
          const uc = sq.unit_counts || {};
          TW_ALL_UNITS.forEach(u => {
            unitsAwayScav[u] += parseInt(uc[u], 10) || 0;
          });
        });

        // Fallback if `scavenging_squad` couldn't be JSON.parsed directly: extract `"unit_counts":{...}` after `"scavenging_squad"`
        if (squadObjs.length === 0) {
          const parts = scavHtml.split('"scavenging_squad"').slice(1);
          parts.forEach(seg => {
            if (/^\s*:\s*null/.test(seg)) return;
            const chunk = seg.slice(0, 1200);
            const rtMatch = chunk.match(/"return_time"\s*:\s*(\d+)/);
            if (rtMatch) {
              const rt = parseInt(rtMatch[1], 10) * 1000;
              if (rt > 0) {
                activeMissions++;
                if (rt > finishAt) finishAt = rt;
              }
            }
            const ucObjs = extractJsonObjectsAfterKey(chunk, 'unit_counts');
            if (ucObjs.length > 0) {
              TW_ALL_UNITS.forEach(u => {
                unitsAwayScav[u] += parseInt(ucObjs[0][u], 10) || 0;
              });
            }
          });
        }
      }

      if (unlockedTiers === 0) {
        const lockedMatches = scavHtml.match(/"is_locked"\s*:\s*false/g);
        if (lockedMatches) unlockedTiers = Math.min(4, lockedMatches.length);
      }
    }

    return {
      gotHomeFromScav,
      unitsHome,
      unitsAwayScav,
      unlockedTiers,
      activeMissions,
      finishAt,
      loot
    };
  }

  function parseMarketExchangeFromHtml(html) {
    const out = {
      sellRates: {},
      buyRates: {},
      merchantsAvail: 0,
      merchantsTotal: 0,
      marketStock: {},
      marketCap: {}
    };
    if (!html) return out;
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      ['wood', 'stone', 'iron'].forEach(resKey => {
        const targetKey = resKey === 'stone' ? 'clay' : resKey;
        const rateEl = doc.querySelector(`#premium_exchange_rate_${resKey}`);
        if (rateEl) {
          const firstSep = rateEl.querySelector('.premium-exchange-sep');
          const rawTxt = firstSep ? (firstSep.textContent || '') : (rateEl.textContent || '');
          const firstMatch = rawTxt.replace(/[.,]/g, '').match(/(\d+)/);
          const num = firstMatch ? parseInt(firstMatch[1], 10) : 0;
          if (num > 0 && num < 5000) {
            out.sellRates[targetKey] = num;
          }
        }

        const stockEl = doc.querySelector(`#premium_exchange_stock_${resKey}`);
        if (stockEl) {
          const sNum = parseInt(stockEl.textContent.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(sNum)) out.marketStock[targetKey] = sNum;
        }

        const capEl = doc.querySelector(`#premium_exchange_capacity_${resKey}`);
        if (capEl) {
          const cNum = parseInt(capEl.textContent.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(cNum)) out.marketCap[targetKey] = cNum;
        }
      });
      const merchTxt = html.match(/(\d+)\s*\/\s*(\d+)/);
      if (merchTxt) {
        out.merchantsAvail = parseInt(merchTxt[1], 10) || 0;
        out.merchantsTotal = parseInt(merchTxt[2], 10) || 0;
      }
    } catch (e) {}
    return out;
  }

  async function pushSyncPayloadToFirestore(payload) {
    const cleanVilId = String(payload.villageId || payload.villageGameId || 'v1').replace(/[^a-zA-Z0-9_-]/g, '_');
    const syncId = 'sync_' + cleanVilId + '_' + Date.now();
    const commitUrl = `https://firestore.googleapis.com/v1/projects/${ERP_FIRESTORE_PROJECT_ID}/databases/${ERP_FIRESTORE_DB_ID}/documents:commit`;
    const docName = `projects/${ERP_FIRESTORE_PROJECT_ID}/databases/${ERP_FIRESTORE_DB_ID}/documents/incomingVillageSyncs/${syncId}`;
    const body = JSON.stringify({
      writes: [
        {
          update: {
            name: docName,
            fields: {
              syncId: { stringValue: syncId },
              villageId: { stringValue: String(payload.villageId || payload.villageGameId || '1').slice(0, 60) },
              worldCode: { stringValue: String(payload.worldCode || payload.world || 'ae').slice(0, 60) },
              playerName: { stringValue: String(payload.playerName || 'player').slice(0, 110) },
              villageName: { stringValue: String(payload.villageName || payload.name || 'قرية').slice(0, 150) },
              payloadJson: { stringValue: JSON.stringify(payload) },
              clientTimestamp: { integerValue: String(payload.timestamp || Date.now()) }
            }
          },
          updateTransforms: [
            {
              fieldPath: 'updatedAt',
              setToServerValue: 'REQUEST_TIME'
            }
          ]
        }
      ]
    });

    try {
      const r = await fetch(commitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      if (r.ok) return true;
    } catch (e) {}

    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise(resolve => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: commitUrl,
          headers: { 'Content-Type': 'application/json' },
          data: body,
          onload: res => resolve(res.status >= 200 && res.status < 300),
          onerror: () => resolve(false)
        });
      });
    }
    return false;
  }

  let syncInProgress = false;

  async function runSync() {
    if (syncInProgress) return;
    syncInProgress = true;

    try {
      const gd = W.game_data || {};
      const v = gd.village || {};
      const p = gd.player || {};
      const urlParams = new URLSearchParams(location.search);
      const villageId = v.id || urlParams.get('village') || '';
      const sitterId = urlParams.get('t') || (p.sitter && String(p.sitter) !== '0' ? String(p.id || '') : '');
      const sitterParam = urlParams.get('t') ? `&t=${encodeURIComponent(urlParams.get('t'))}` : '';

      if (!villageId && !v.name) {
        showSyncStatusToast('⚠️ افتح صفحة القرية داخل اللعبة أولاً ثم اضغط المزامنة', 'error');
        syncInProgress = false;
        return;
      }

      showSyncStatusToast('⏳ جاري المزامنة التلقائية وسحب كافة الجيوش والمباني والموارد...', 'loading');

      const base = `${location.origin}/game.php?village=${villageId}${sitterParam}`;
      const curScreen = gd.screen || urlParams.get('screen') || '';
      const curMode = gd.mode || urlParams.get('mode') || '';

      // Fetch all required screens in parallel so 100% of troops, buildings, scavenging, market, and IP are captured
      const [mainHtml, scavHtml, placeUnitsHtml, trainHtml, marketHtml, overviewHtml, detectedIp] = await Promise.all([
        curScreen === 'main' ? Promise.resolve(document.documentElement.outerHTML) : fetchText(base + '&screen=main'),
        curScreen === 'place' && curMode === 'scavenge'
          ? Promise.resolve(document.documentElement.outerHTML)
          : fetchText(base + '&screen=place&mode=scavenge'),
        curScreen === 'place' && curMode === 'units'
          ? Promise.resolve(document.documentElement.outerHTML)
          : fetchText(base + '&screen=place&mode=units'),
        curScreen === 'train' ? Promise.resolve(document.documentElement.outerHTML) : fetchText(base + '&screen=train'),
        curScreen === 'market' ? Promise.resolve(document.documentElement.outerHTML) : fetchText(base + '&screen=market&mode=exchange'),
        curScreen === 'overview' ? Promise.resolve(document.documentElement.outerHTML) : fetchText(base + '&screen=overview'),
        detectPublicIP()
      ]);

      const mainDoc = mainHtml ? new DOMParser().parseFromString(mainHtml, 'text/html') : document;
      const buildings = parseBuildingsFromHtml(mainDoc, mainHtml || document.documentElement.outerHTML);
      const bq = parseBuildQueueFromDoc(mainDoc, Date.now());

      // Combine Army Data from all sources (Scavenge + Place Units + Train + Overview) WITHOUT doubling
      const scavParsed = parseScavengeData(scavHtml);
      const placeParsed = parsePlaceUnitsScreen(placeUnitsHtml);
      const trainParsed = parseTrainScreenUnits(trainHtml);
      const ovParsed = parseOverviewUnits(overviewHtml, document);

      const unitsHome = emptyUnitsMap();
      const unitsAway = emptyUnitsMap();
      const unitsTotal = emptyUnitsMap();

      TW_ALL_UNITS.forEach(u => {
        let hCount = Math.max(
          scavParsed.unitsHome[u] || 0,
          placeParsed.home[u] || 0,
          trainParsed.home[u] || 0,
          ovParsed.home[u] || 0
        );

        const awayFromScav = scavParsed.unitsAwayScav[u] || 0;
        const awayFromPlace = placeParsed.away[u] || 0;
        let awayBest = Math.max(awayFromScav, awayFromPlace);

        const totFromPlace = placeParsed.total[u] || 0;
        const totFromTrain = trainParsed.total[u] || 0;
        const totFromOv = ovParsed.total[u] || 0;
        const knownTotal = Math.max(totFromPlace, totFromTrain, totFromOv);

        // If neither scavenge nor place reported home/away, fallback to overview total as home
        if (hCount === 0 && awayBest === 0 && knownTotal > 0 && !scavParsed.gotHomeFromScav && !placeParsed.foundAny && !trainParsed.foundAny) {
          hCount = knownTotal;
        }

        // If knownTotal is authoritative (from place/train/overview) and awayBest == 0 but knownTotal > hCount:
        if (awayBest === 0 && knownTotal > hCount && (scavParsed.gotHomeFromScav || placeParsed.foundAny || trainParsed.foundAny)) {
          awayBest = knownTotal - hCount;
        }

        // Prevent doubling when a source reported total as home while troops were away
        if (knownTotal > 0 && hCount + awayBest > knownTotal) {
          if (hCount === knownTotal && awayBest > 0) {
            hCount = Math.max(0, knownTotal - awayBest);
          }
        }

        const totBest = knownTotal > 0 ? Math.max(knownTotal, hCount + awayBest) : (hCount + awayBest);

        unitsHome[u] = hCount;
        unitsAway[u] = awayBest;
        unitsTotal[u] = totBest;
      });

      const scavHaulHome = calcTotalHaul(unitsHome);
      const scavHaulAway = calcTotalHaul(unitsAway);
      const scavHaulTotal = calcTotalHaul(unitsTotal);

      const mkt = parseMarketExchangeFromHtml(marketHtml);

      const coordsMatch = (v.coord || v.coords || document.title || '').match(/(\d{3})\|(\d{3})/);
      const coords = coordsMatch ? `${coordsMatch[1]}|${coordsMatch[2]}` : (v.coord || '500|500');
      let continent = '44';
      if (coordsMatch) {
        continent = `${coordsMatch[2][0]}${coordsMatch[1][0]}`;
      }

      const nowTs = Date.now();
      const worldStr = gd.world || location.hostname.split('.')[0] || 'ae';
      const woodNow = parseInt(v.wood, 10) || 0;
      const clayNow = parseInt(v.stone, 10) || 0;
      const ironNow = parseInt(v.iron, 10) || 0;
      const lootObj = scavParsed.loot || { wood: 0, clay: 0, iron: 0 };
      lootObj.total = (lootObj.wood || 0) + (lootObj.clay || 0) + (lootObj.iron || 0);

      const payload = {
        twErpSync: true,
        syncVersion: '6.0',
        timestamp: nowTs,
        syncedAt: nowTs,
        world: worldStr,
        worldCode: worldStr,
        origin: location.origin,
        playerName: p.name || '',
        playerId: String(p.id || ''),
        pp: parseInt(p.pp, 10) || 0,
        villageId: String(villageId || v.id || ''),
        villageGameId: String(villageId || v.id || ''),
        name: v.name || '',
        villageName: v.name || '',
        coord: coords,
        coords,
        continent,
        villagePoints: parseInt(v.points, 10) || 26,
        ip: detectedIp || '',
        wood: woodNow,
        clay: clayNow,
        iron: ironNow,
        woodStock: woodNow,
        clayStock: clayNow,
        ironStock: ironNow,
        storageMax: parseInt(v.storage_max, 10) || 0,
        popUsed: parseInt(v.pop, 10) || 0,
        popMax: parseInt(v.pop_max, 10) || 0,
        woodProdHr: Math.round((parseFloat(v.wood_prod) || 0) * 3600),
        clayProdHr: Math.round((parseFloat(v.stone_prod) || 0) * 3600),
        ironProdHr: Math.round((parseFloat(v.iron_prod) || 0) * 3600),
        woodLevel: buildings['الخشاب'] || 0,
        clayLevel: buildings['حفرة الطمي'] || 0,
        ironLevel: buildings['منجم الحديد'] || 0,
        warehouseLevel: buildings['المخازن'] || 1,
        farmLevel: buildings['المزارع'] || 1,
        marketLevel: buildings['السوق'] || 0,
        buildings,
        buildQueue: bq.queue,
        buildQueueFinishAt: bq.finishAt || 0,
        buildEndAt: bq.finishAt || 0,
        unitsHome,
        unitsAway,
        unitsTotal,
        scavHaulHome,
        scavHaulAway,
        scavHaulTotal,
        spearsHome: unitsHome.spear || 0,
        swordsHome: unitsHome.sword || 0,
        spearsAway: unitsAway.spear || 0,
        swordsAway: unitsAway.sword || 0,
        spearsTotal: unitsTotal.spear || 0,
        swordsTotal: unitsTotal.sword || 0,
        unlockedScavTiers: scavParsed.unlockedTiers || (buildings['الثكنات'] >= 1 ? 1 : 0),
        scavActiveCount: scavParsed.activeMissions || 0,
        scavReturnAt: scavParsed.finishAt || 0,
        scavNextReturnAt: scavParsed.finishAt || 0,
        scavFinishAt: scavParsed.finishAt || 0,
        scavLoot: lootObj,
        rates: mkt.sellRates,
        sellRates: mkt.sellRates,
        marketStock: mkt.marketStock,
        marketCap: mkt.marketCap,
        merchantsAvail: mkt.merchantsAvail,
        merchantsTotal: mkt.merchantsTotal
      };

      const jsonStr = JSON.stringify(payload);
      try {
        if (typeof GM_setClipboard === 'function') GM_setClipboard(jsonStr);
        else if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(jsonStr).catch(() => {});
        }
      } catch (e) {}

      const [cloudOk, assignedPlan] = await Promise.all([
        pushSyncPayloadToFirestore(payload),
        fetchAssignedPlanFromFirestore(payload.villageId)
      ]);
      const armyTxt = formatUnitsSummaryAr(unitsTotal);

      renderSafeAdvisorOverlay(assignedPlan, payload, bq, scavParsed, mkt);

      showSyncStatusToast(
        `✅ <b>تمت مزامنة ${payload.villageName || 'القرية'} تلقائياً ${cloudOk ? '☁️ للنظام' : '📋 للحافظة'}!</b><br>` +
        `<span style="font-size:11px;color:#d1fae5;">⚔️ الجيش الكلي: ${armyTxt} (حمولة: ${scavHaulTotal.toLocaleString('en-US')})</span><br>` +
        `<span style="font-size:11px;color:#fde68a;">🪵${payload.wood} • 🧱${payload.clay} • ⚙️${payload.iron} | 🔒 IP: ${payload.ip || '—'}</span>`,
        'ok'
      );
    } catch (err) {
      showSyncStatusToast('❌ حدث خطأ أثناء المزامنة: ' + (err && err.message ? err.message : err), 'error');
    } finally {
      syncInProgress = false;
    }
  }

  async function fetchAssignedPlanFromFirestore(villageId) {
    if (!villageId) return null;
    const cleanId = 'game_' + String(villageId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    const getUrl = `https://firestore.googleapis.com/v1/projects/${ERP_FIRESTORE_PROJECT_ID}/databases/${ERP_FIRESTORE_DB_ID}/documents/villagePlans/${cleanId}`;
    const parseDoc = (data) => {
      if (!data || !data.fields) return null;
      const f = data.fields;
      let steps = [];
      try {
        steps = JSON.parse(f.stepsJson?.stringValue || '[]');
      } catch (_) {}
      return {
        name: f.name?.stringValue || 'خطة تطوير',
        totalSteps: Number(f.totalSteps?.integerValue || steps.length || 0),
        steps: Array.isArray(steps) ? steps : []
      };
    };
    try {
      const r = await fetch(getUrl);
      if (r.ok) return parseDoc(await r.json());
    } catch (_) {}
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise(resolve => {
        GM_xmlhttpRequest({
          method: 'GET',
          url: getUrl,
          onload: res => {
            if (res.status >= 200 && res.status < 300) {
              try { return resolve(parseDoc(JSON.parse(res.responseText))); } catch (_) {}
            }
            resolve(null);
          },
          onerror: () => resolve(null)
        });
      });
    }
    return null;
  }

  function fmtMinAr(mins) {
    if (!isFinite(mins) || mins <= 0) return 'الآن';
    if (mins < 60) return `${Math.ceil(mins)} د`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return m > 0 ? `${h}س ${m}د` : `${h}س`;
  }

  function renderSafeAdvisorOverlay(planDoc, payload, bq, scavParsed, mkt) {
    try {
      const old = document.getElementById('tw-erp-safe-advisor');
      if (old && old.parentNode) old.parentNode.removeChild(old);

      const isMin = localStorage.getItem('tw_erp_advisor_min_v6') === '1';
      const queuedMap = {};
      if (bq && Array.isArray(bq.queue)) {
        bq.queue.forEach(q => {
          const k = q.bName || q.building || '';
          if (k) queuedMap[k] = (queuedMap[k] || 0) + 1;
        });
      }

      let nextStepHtml = `<span style="color:#94a3b8;">لا توجد خطة معيّنة لهذه القرية في الـ ERP بعد</span>`;
      let planBadge = `<span style="background:rgba(148,163,184,0.2);color:#cbd5e1;padding:1px 6px;border-radius:4px;font-size:10px;">بدون خطة</span>`;

      if (planDoc && Array.isArray(planDoc.steps) && planDoc.steps.length > 0) {
        const bSteps = planDoc.steps.filter(s => s.atype === 'bldg' || s.baseName);
        let doneCount = 0;
        let nextStep = null;

        for (const s of bSteps) {
          const bName = s.baseName || String(s.bName || '').replace(/\s*م\d+.*$/, '').trim();
          const tgtLvl = Number(s.targetLvl || 1);
          const curLvl = Number((payload.buildings && payload.buildings[bName]) || 0) + Number(queuedMap[bName] || 0);
          if (curLvl >= tgtLvl) {
            doneCount++;
          } else if (!nextStep) {
            nextStep = { ...s, bName, tgtLvl, curLvl };
          }
        }

        const totalSteps = bSteps.length || planDoc.steps.length;
        const pct = totalSteps > 0 ? Math.min(100, Math.round((doneCount / totalSteps) * 100)) : 0;
        planBadge = `<span style="background:rgba(245,158,11,0.2);color:#fde68a;border:1px solid rgba(245,158,11,0.45);padding:1px 6px;border-radius:4px;font-size:10px;font-weight:800;">${doneCount}/${totalSteps} (${pct}%)</span>`;

        if (nextStep) {
          const cw = Number(nextStep.cost?.w || 0);
          const cc = Number(nextStep.cost?.c || 0);
          const ci = Number(nextStep.cost?.i || 0);
          const mw = Math.max(0, cw - payload.wood);
          const mc = Math.max(0, cc - payload.clay);
          const mi = Math.max(0, ci - payload.iron);
          const readyNow = (mw === 0 && mc === 0 && mi === 0);

          let etaHtml = `<span style="color:#6ee7b7;font-weight:900;">✅ الموارد جاهزة للبناء الآن</span>`;
          if (!readyNow) {
            const wMin = payload.woodProdHr > 0 ? (mw / payload.woodProdHr) * 60 : 9999;
            const cMin = payload.clayProdHr > 0 ? (mc / payload.clayProdHr) * 60 : 9999;
            const iMin = payload.ironProdHr > 0 ? (mi / payload.ironProdHr) * 60 : 9999;
            const waitMin = Math.max(wMin, cMin, iMin);
            etaHtml = `<span style="color:#fcd34d;font-weight:800;">⏳ متاح بعد ${fmtMinAr(waitMin)} (ناقص: ${mw > 0 ? '🪵' + mw + ' ' : ''}${mc > 0 ? '🧱' + mc + ' ' : ''}${mi > 0 ? '⚙️' + mi : ''})</span>`;
          }

          nextStepHtml =
            `<div style="font-weight:900;color:#fff;font-size:12px;">🔨 التالي: ${nextStep.bName} <span style="color:#fbbf24;">(م${nextStep.curLvl} ➔ م${nextStep.tgtLvl})</span></div>` +
            `<div style="font-size:11px;margin-top:2px;">${etaHtml}</div>`;
        } else {
          nextStepHtml = `<span style="color:#6ee7b7;font-weight:900;">🏆 تم إنجاز جميع خطوات الخطة!</span>`;
        }
      }

      const maxRes = Math.max(payload.wood, payload.clay, payload.iron);
      const whPct = payload.storageMax > 0 ? Math.min(100, Math.round((maxRes / payload.storageMax) * 100)) : 0;
      const idleHaul = payload.scavHaulHome || 0;
      const scavIdle = (payload.scavActiveCount === 0 && idleHaul >= 100 && payload.unlockedScavTiers > 0);

      const tips = [];
      if (scavIdle) {
        tips.push(`<div style="background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.45);color:#fecaca;padding:4px 7px;border-radius:6px;font-size:11px;font-weight:800;">🛡️ الإغارات متوقفة! بالقرية حمولة ${idleHaul.toLocaleString('en-US')} مورد جاهزة</div>`);
      } else if (payload.scavActiveCount > 0) {
        tips.push(`<div style="color:#a7f3d0;font-size:11px;">🛡️ الإغارات نشطة (${payload.scavActiveCount} أفواج)</div>`);
      }

      if (whPct >= 85) {
        tips.push(`<div style="background:rgba(245,158,11,0.18);border:1px solid rgba(245,158,11,0.45);color:#fde68a;padding:4px 7px;border-radius:6px;font-size:11px;font-weight:800;">📦 المخزن ${whPct}% — تجار متاحين: ${mkt.merchantsAvail}/${mkt.merchantsTotal} (بيع مقترح)</div>`);
      }

      const box = document.createElement('div');
      box.id = 'tw-erp-safe-advisor';
      box.style.cssText =
        'position:fixed;bottom:14px;left:14px;z-index:2147483645;width:min(320px,92vw);' +
        'background:linear-gradient(160deg,#0f172a 0%,#090d16 100%);color:#f8fafc;' +
        'border:1.5px solid rgba(245,158,11,0.55);border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,0.75);' +
        'font:700 12px/1.45 Tahoma,Cairo,sans-serif;direction:rtl;text-align:right;overflow:hidden;';

      box.innerHTML =
        `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:rgba(245,158,11,0.14);border-bottom:1px solid rgba(255,255,255,0.08);cursor:pointer;" id="tw-erp-adv-hdr">` +
          `<div style="display:flex;align-items:center;gap:6px;">` +
            `<span>🧭</span><strong style="color:#fde68a;font-size:11.5px;">المساعد الإرشادي الآمن v6</strong>${planBadge}` +
          `</div>` +
          `<button type="button" id="tw-erp-adv-toggle" style="background:rgba(255,255,255,0.1);color:#fff;border:0;border-radius:5px;padding:2px 7px;cursor:pointer;font-size:11px;font-weight:800;">${isMin ? 'فتح ▲' : 'تصغير ▼'}</button>` +
        `</div>` +
        `<div id="tw-erp-adv-body" style="padding:9px 10px;display:${isMin ? 'none' : 'flex'};flex-direction:column;gap:6px;">` +
          `<div>${nextStepHtml}</div>` +
          (tips.length ? `<div style="display:flex;flex-direction:column;gap:4px;">${tips.join('')}</div>` : '') +
          `<div style="display:flex;justify-content:space-between;align-items:center;padding-top:4px;border-top:1px solid rgba(255,255,255,0.07);font-size:10px;color:#94a3b8;">` +
            `<span>🔒 عرض إرشادي فقط (آمن)</span>` +
            `<button type="button" id="tw-erp-adv-resync" style="background:rgba(56,189,248,0.18);color:#7dd3fc;border:1px solid rgba(56,189,248,0.4);border-radius:5px;padding:2px 7px;cursor:pointer;font-size:10px;font-weight:800;">🔄 تحديث</button>` +
          `</div>` +
        `</div>`;

      document.body.appendChild(box);
      const togBtn = document.getElementById('tw-erp-adv-toggle');
      const bodyEl = document.getElementById('tw-erp-adv-body');
      const hdrEl = document.getElementById('tw-erp-adv-hdr');
      const toggleFn = () => {
        const nowMin = bodyEl.style.display !== 'none';
        bodyEl.style.display = nowMin ? 'none' : 'flex';
        togBtn.textContent = nowMin ? 'فتح ▲' : 'تصغير ▼';
        try { localStorage.setItem('tw_erp_advisor_min_v6', nowMin ? '1' : '0'); } catch (_) {}
      };
      if (hdrEl) hdrEl.onclick = toggleFn;
      const resyncBtn = document.getElementById('tw-erp-adv-resync');
      if (resyncBtn) {
        resyncBtn.onclick = (e) => {
          e.stopPropagation();
          runSync();
        };
      }
    } catch (_) {}
  }

  // Expose global trigger so tapping the bookmarklet again re-runs immediately
  W.__twRunErpSync = runSync;
  W.__twSyncVersion = '6.0';

  // Remove any legacy HUD / menus if present from older script versions
  try {
    const oldHud = document.getElementById('tw-erp-assistant-hud');
    if (oldHud && oldHud.parentNode) oldHud.parentNode.removeChild(oldHud);
  } catch (e) {}

  // Auto-run immediately without any click required!
  if (location.href.includes('game.php')) {
    runSync();
  }
})();
