/**
 * Self-contained Auto-Cloud Bookmarklet for Tribal Wars ERP.
 * Works in ANY mobile browser's Bookmarks without requiring Tampermonkey.
 * Guarantees:
 * - Zero raw '%' characters (prevents mobile browser decodeURIComponent URIError)
 * - Zero newlines (single-line javascript:(...)() URL)
 * - Direct automatic sync to Cloud Firestore (/incomingVillageSyncs/{docId}) via REST :commit
 * - Full extraction of buildings (16 Arabic names), home + away scavenging troops, market rates,
 *   flags, bonuses, active queues, IPv4, device/browser, and in-game Smart Assistant HUD.
 */

export function __twErpCloudBookmarklet(): void {
  var __name: any = function (t: any) { return t; };
  var W: any = window;
  var PCT = String.fromCharCode(37);
  function mod(a: number, b: number): number {
    return a - Math.floor(a / b) * b;
  }

  var FIREBASE_PROJECT_ID = 'linear-freedom-9gxqk';
  var FIRESTORE_DATABASE_ID = 'ai-studio-erp-58272684-00ec-4692-acb8-6a7218e50c08';
  var FIRESTORE_BASE_URL =
    'https://firestore.googleapis.com/v1/projects/' +
    FIREBASE_PROJECT_ID +
    '/databases/' +
    FIRESTORE_DATABASE_ID +
    '/documents';

  var MARKET_MERCHANTS = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 19, 26, 35, 46, 59, 74, 91, 110, 131, 154, 179, 206, 235
  ];

  var map: Record<string, string> = {
    wood: 'الخشاب',
    stone: 'حفرة الطمي',
    iron: 'منجم الحديد',
    main: 'المبنى الرئيسي',
    smith: 'الحداد',
    barracks: 'الثكنات',
    snob: 'الأكاديمية',
    academy: 'الأكاديمية',
    market: 'السوق',
    farm: 'المزارع',
    storage: 'المخازن',
    wall: 'الحائط',
    stable: 'الإسطبل',
    garage: 'الورشة',
    hide: 'المخابئ',
    statue: 'النصب التذكاري',
    place: 'نقطة التجمع'
  };

  function parseHMS(t: any): number {
    var p = String(t || '').trim().split(':');
    if (p.length === 3) return (+p[0]) * 3600 + (+p[1]) * 60 + (+p[2]);
    return 0;
  }

  function storeGet(k: string): string {
    try {
      return W.localStorage.getItem('tw_erp_' + k) || '';
    } catch (e) {
      return '';
    }
  }

  function storeSet(k: string, val: string): void {
    try {
      W.localStorage.setItem('tw_erp_' + k, val);
    } catch (e) {}
  }

  function getDeviceId(): string {
    var id = storeGet('twDeviceId');
    if (!id) {
      id =
        W.crypto && W.crypto.randomUUID
          ? W.crypto.randomUUID()
          : 'dev-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      storeSet('twDeviceId', id);
    }
    return id;
  }

  function guessBrowser(): string {
    var ua = (W.navigator && W.navigator.userAgent) || '';
    if (/Kiwi/i.test(ua)) return 'Kiwi';
    if (/OPR\/|Opera|OPiOS/i.test(ua)) return 'Opera';
    if (/Edg(e|A|iOS)?\//.test(ua)) return 'Edge';
    if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
    if (/Firefox|FxiOS/i.test(ua)) return 'Firefox';
    if (/YaBrowser/i.test(ua)) return 'Yandex';
    if (/UCBrowser/i.test(ua)) return 'UC';
    if (/Chrome|CriOS|Chromium/i.test(ua)) return 'Chrome';
    if (/Safari/i.test(ua)) return 'Safari';
    return 'Chrome';
  }

  function guessDevice(): string {
    var nav = W.navigator || {};
    var ua = nav.userAgent || '';
    var mobile =
      /Mobi|Android|iPhone|iPad/i.test(ua) ||
      ((nav.maxTouchPoints || 0) > 0 &&
        Math.min((W.screen && W.screen.width) || 0, (W.screen && W.screen.height) || 0) < 820);
    var os = 'غير معروف';
    var m: RegExpMatchArray | null;
    if ((m = ua.match(/Android\s([\d.]+)/i))) os = 'Android ' + m[1];
    else if ((m = ua.match(/(?:iPhone|CPU) OS ([\d_]+)/i))) os = 'iOS ' + m[1].replace(/_/g, '.');
    else if (/Windows NT/i.test(ua)) os = 'Windows';
    else if (/Mac OS X/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';
    var model = '';
    var mm = ua.match(/Android\s[\d.]+;\s*([^;)]+?)(?:\sBuild|;|\))/i);
    if (mm && mm[1] && mm[1] !== 'K') model = ' ' + mm[1].trim();
    return (mobile ? 'موبايل ' : 'كمبيوتر ') + os + model;
  }

  function ensureDeviceInfo(): void {
    var dev = storeGet('twDevice');
    var br = storeGet('twBrowser');
    if (!dev) {
      dev = guessDevice();
      storeSet('twDevice', dev);
    }
    if (!br) {
      br = guessBrowser();
      storeSet('twBrowser', br);
    }
  }

  function copyText(out: string): boolean {
    var ok = false;
    try {
      var ta = document.createElement('textarea');
      ta.value = out;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, out.length);
      ok = document.execCommand('copy');
      ta.remove();
    } catch (e) {}
    try {
      if (W.navigator && W.navigator.clipboard && W.isSecureContext) {
        W.navigator.clipboard.writeText(out).catch(function () {});
        ok = true;
      }
    } catch (e) {}
    return ok;
  }

  function toast(html: string, ms?: number, bg?: string, onTapCopyText?: string): void {
    var old = document.getElementById('tw-erp-sync-bar');
    if (old) old.remove();
    var bar = document.createElement('div');
    bar.id = 'tw-erp-sync-bar';
    bar.style.cssText =
      'position:fixed;top:10px;left:10px;right:10px;z-index:9999999;background:' +
      (bg || 'linear-gradient(135deg,#111827,#1f2937)') +
      ';color:#FBBF24;border:2px solid #F59E0B;border-radius:14px;padding:14px 18px;font-family:sans-serif;font-weight:bold;font-size:14px;text-align:center;box-shadow:0 12px 35px rgba(0,0,0,0.85);cursor:pointer;direction:rtl;';
    bar.innerHTML = html;
    bar.onclick = function () {
      if (onTapCopyText) {
        copyText(onTapCopyText);
        bar.style.background = '#065f46';
        bar.style.color = '#fff';
        bar.innerHTML = '✅ تم نسخ بيانات القرية للحافظة وتم إرسالها للسحابة بنجاح!';
        setTimeout(function () {
          if (bar.parentNode) bar.remove();
        }, 1800);
      } else {
        bar.remove();
      }
    };
    document.body.appendChild(bar);
    if (ms) {
      setTimeout(function () {
        if (bar.parentNode) bar.remove();
      }, ms);
    }
  }

  function formatDuration(sec: number): string {
    if (sec <= 0) return 'الآن';
    var h = Math.floor(sec / 3600);
    var m = Math.floor(mod(sec, 3600) / 60);
    var s = Math.floor(mod(sec, 60));
    if (h > 0) return h + 'س و' + m + 'د';
    if (m > 0) return m + 'د و' + s + 'ث';
    return s + 'ث';
  }

  function pushSyncToFirestore(d: any, outJson: string): Promise<boolean> {
    return new Promise(function (resolve) {
      var cleanWorld = String(d.worldCode || 'ae').replace(/[^a-zA-Z0-9_\-]/g, '_');
      var cleanVilId = String(d.villageId || d.coord || 'v1').replace(/[^a-zA-Z0-9_\-]/g, '_');
      var docId = ('sync_' + cleanWorld + '_' + cleanVilId).slice(0, 120);
      var commitUrl = FIRESTORE_BASE_URL + ':commit';
      var docName =
        'projects/' +
        FIREBASE_PROJECT_ID +
        '/databases/' +
        FIRESTORE_DATABASE_ID +
        '/documents/incomingVillageSyncs/' +
        docId;

      var bodyStr = JSON.stringify({
        writes: [
          {
            update: {
              name: docName,
              fields: {
                syncId: { stringValue: docId },
                villageId: { stringValue: String(d.villageId || '1').slice(0, 64) },
                worldCode: { stringValue: String(d.worldCode || 'ae').slice(0, 64) },
                playerName: { stringValue: String(d.playerName || 'حساب').slice(0, 120) },
                villageName: { stringValue: String(d.name || 'قرية').slice(0, 160) },
                payloadJson: { stringValue: outJson },
                clientTimestamp: { integerValue: String(d.timestamp || Date.now()) }
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

      fetch(commitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr
      })
        .then(function (r) {
          resolve(!!(r && r.ok));
        })
        .catch(function () {
          resolve(false);
        });
    });
  }

  function parseGameLoginsFast(html: string): { ip: string | null; rows: any[] } {
    var out: { ip: string | null; rows: any[] } = { ip: null, rows: [] };
    try {
      var reRow = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      var m: RegExpExecArray | null;
      while ((m = reRow.exec(html)) !== null) {
        var rowHtml = m[1];
        if (rowHtml.indexOf('<th') !== -1) continue;
        var cells: string[] = [];
        var reCell = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        var mc: RegExpExecArray | null;
        while ((mc = reCell.exec(rowHtml)) !== null) {
          cells.push(mc[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
        }
        if (cells.length >= 3) {
          var ipMatch = cells[2].match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
          if (ipMatch) {
            out.rows.push({
              date: cells[0],
              device: cells[1],
              ip: ipMatch[0],
              sitter: cells[3] || ''
            });
            if (out.rows.length >= 20) break;
          }
        }
      }
      if (out.rows.length) out.ip = out.rows[0].ip;
    } catch (e) {}
    return out;
  }

  function extractActiveQueuesFromDoc(docNode: Document): { buildingOrders: any[]; trainingOrders: any[] } {
    var bOrders: any[] = [];
    var tOrders: any[] = [];
    try {
      var bqRows = docNode.querySelectorAll('#buildqueue tr, [id^="order_item_"], .buildorder_row');
      bqRows.forEach(function (tr: any) {
        var plainText = (tr.innerText || tr.textContent || '').replace(/\s+/g, ' ').trim();
        if (plainText.indexOf('أوامر البناء') !== -1 || plainText.indexOf('Building orders') !== -1 || !plainText) return;
        for (var k in map) {
          var arabName = map[k];
          if (plainText.indexOf(arabName) !== -1 || (tr.className && tr.className.indexOf('buildorder_' + k) !== -1)) {
            var pNoHtml = plainText.replace(/<[^>]+>/g, ' ');
            var lvlM = pNoHtml.match(/(?:المستوى|Level|م|lvl)\s*(\d+)/i) || pNoHtml.match(/\((\d+)\)/);
            var lvl = lvlM ? parseInt(lvlM[1], 10) : 1;
            var timerEl = tr.querySelector('.timer, [data-endtime]');
            var fSec = timerEl ? parseHMS(timerEl.textContent) : 0;
            bOrders.push({
              baseName: k,
              bName: arabName,
              targetLvl: lvl,
              finishSec: fSec,
              finishAt: fSec > 0 ? Date.now() + fSec * 1000 : 0
            });
            break;
          }
        }
      });

      var tqRows = docNode.querySelectorAll('[id^="trainqueue_"] tr.lit, #trainqueue_barracks tr');
      tqRows.forEach(function (tr: any) {
        var txt = (tr.innerText || tr.textContent || '').replace(/\s+/g, ' ').trim();
        var countM = txt.match(/(\d+)/);
        var isSp = txt.indexOf('رمح') !== -1 || txt.toLowerCase().indexOf('spear') !== -1;
        var isSw = txt.indexOf('سيف') !== -1 || txt.toLowerCase().indexOf('sword') !== -1;
        if (countM && (isSp || isSw)) {
          var timerEl = tr.querySelector('.timer');
          var fSec = timerEl ? parseHMS(timerEl.textContent) : 0;
          tOrders.push({
            unit: isSp ? 'spear' : 'sword',
            unitName: isSp ? 'رمح' : 'سيف',
            count: parseInt(countM[1], 10),
            finishSec: fSec,
            finishAt: fSec > 0 ? Date.now() + fSec * 1000 : 0
          });
        }
      });
    } catch (e) {}
    return { buildingOrders: bOrders, trainingOrders: tOrders };
  }

  function renderCompactHUD(d: any): void {
    try {
      var gd = W.game_data;
      if (!gd || !gd.village) return;
      var v = gd.village;
      var b = v.buildings || {};
      var wood = Number(v.wood || 0);
      var clay = Number(v.stone || 0);
      var iron = Number(v.iron || 0);
      var storageMax = Number(v.storage_max || 1000);
      var woodProd = Number(v.wood_prod || 0.05);
      var clayProd = Number(v.stone_prod || 0.05);
      var ironProd = Number(v.iron_prod || 0.05);

      var mktLvl = parseInt(b.market || 0, 10);
      var totalTraders = MARKET_MERCHANTS[mktLvl] || 0;
      var tradersAway = Number(v.trader_away || 0);
      var freeTraders = Math.max(0, totalTraders - tradersAway);
      var maxStock = Math.max(wood, clay, iron);
      var sellableRes = Math.min(freeTraders * 1000, Math.max(0, maxStock - 300));

      var secToFullWood = woodProd > 0 ? (storageMax - wood) / woodProd : 999999;
      var secToFullClay = clayProd > 0 ? (storageMax - clay) / clayProd : 999999;
      var secToFullIron = ironProd > 0 ? (storageMax - iron) / ironProd : 999999;
      var secToFull = Math.max(0, Math.min(secToFullWood, secToFullClay, secToFullIron));

      var scavReturnSec =
        d.scavNextReturnAt && d.scavNextReturnAt > Date.now()
          ? Math.max(0, Math.round((d.scavNextReturnAt - Date.now()) / 1000))
          : 0;

      var needScavenge = (d.spearsHome || 0) >= 5;
      var needSell = freeTraders > 0 && sellableRes >= 1000;
      var nextSec = scavReturnSec > 0 ? Math.min(scavReturnSec, secToFull) : secToFull;

      var hud = document.getElementById('tw-assistant-hud');
      if (!hud) {
        hud = document.createElement('div');
        hud.id = 'tw-assistant-hud';
        document.body.appendChild(hud);
      }
      hud.style.cssText =
        'position:fixed;bottom:12px;left:12px;z-index:9999990;font-family:sans-serif;direction:rtl;text-align:right;background:#111827;color:#F3F4F6;border:2px solid #F59E0B;border-radius:14px;padding:10px 14px;box-shadow:0 10px 30px rgba(0,0,0,0.85);max-width:320px;font-size:12px;';
      hud.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;border-bottom:1px solid #374151;padding-bottom:5px;">' +
        '<strong style="color:#FBBF24;font-size:13px;">🛡️ مساعد المنظومة السحابي</strong>' +
        '<button id="tw-hud-resync-btn" style="background:#059669;color:#fff;border:0;border-radius:6px;padding:3px 8px;font-weight:bold;cursor:pointer;font-size:11px;">🔄 مزامنة الآن</button>' +
        '</div>' +
        '<div style="line-height:1.6;">' +
        '<div>⚔️ الجيش: <b>' +
        (d.spearsTotal || 0) +
        ' رمح</b> (' +
        (d.spearsHome || 0) +
        ' بالقرية • ' +
        (d.spearsAway || 0) +
        ' بإغارة)</div>' +
        (needScavenge
          ? '<div style="color:#F87171;font-weight:bold;">🔴 تنبيه: يوجد ' +
            d.spearsHome +
            ' رمح بالقرية جاهز للإرسال للإغارة!</div>'
          : '<div style="color:#34D399;">🟢 الإغارات نشطة (' +
            (scavReturnSec > 0 ? 'تعود بعد ' + formatDuration(scavReturnSec) : 'لا يوجد جيش عاطل') +
            ')</div>') +
        (needSell
          ? '<div style="color:#FBBF24;font-weight:bold;">💰 متاح بيع ~' +
            sellableRes.toLocaleString() +
            ' مورد (' +
            freeTraders +
            ' تاجر متاح)</div>'
          : '') +
        '<div style="color:#93C5FD;">⏰ الدخول القادم الآمن: <b>بعد ' +
        formatDuration(nextSec) +
        '</b></div>' +
        '</div>';
      var btn = document.getElementById('tw-hud-resync-btn');
      if (btn) {
        btn.onclick = function () {
          runBookmarkletSync();
        };
      }
    } catch (e) {}
  }

  function runBookmarkletSync(): void {
    try {
      var gd = W.game_data;
      if (!gd || !gd.village) {
        if (typeof W.loadStateFromFirestore === 'function') {
          W.loadStateFromFirestore();
          if (typeof W.showToast === 'function') {
            W.showToast('✅ البوك مارك جاهز! افتح صفحة قريتك داخل اللعبة واضغط على البوك مارك للمزامنة السحابية الفورية.');
          }
          return;
        }
        toast('⚠️ افتح صفحة القرية داخل لعبة حرب القبائل أولاً ثم اضغط على البوك مارك.', 5000, '#7f1d1d');
        return;
      }

      var v = gd.village;
      var p = gd.player || {};
      var b = v.buildings || {};
      var coord = String(v.coord || v.x + '|' + v.y || '');
      var cont = '44';
      var cm = coord.match(/(\d{3})\|(\d{3})/);
      if (cm) {
        cont = cm[2].charAt(0) + cm[1].charAt(0);
      }

      var vb = v.bonus || {};
      var bw =
        vb.wood !== undefined && vb.wood !== null
          ? Math.max(0, Math.round((Number(vb.wood) - 1.0) * 100))
          : 0;
      var bc =
        vb.stone !== undefined && vb.stone !== null
          ? Math.max(0, Math.round((Number(vb.stone) - 1.0) * 100))
          : 0;
      var bi =
        vb.iron !== undefined && vb.iron !== null
          ? Math.max(0, Math.round((Number(vb.iron) - 1.0) * 100))
          : 0;

      var d: any = {
        playerName: p.name ? String(p.name) : '',
        playerId: p.id ? String(p.id) : '',
        pp: p.pp !== undefined && p.pp !== null ? parseInt(p.pp, 10) : null,
        name: v.name || 'قرية مستوردة',
        coord: coord,
        continent: cont,
        villageId: String(v.id || ''),
        worldCode: String(gd.world || ''),
        buildings: {},
        bonusPct: { wood: bw, clay: bc, iron: bi },
        flagPct: 0,
        premium: !!(p.premium || (gd.features && gd.features.Premium && gd.features.Premium.active)),
        scavReturnAt: 0,
        scavNextReturnAt: 0,
        scavActiveCount: 0,
        scavLoot: { wood: 0, clay: 0, iron: 0, total: 0 },
        spearsHome: 0,
        swordsHome: 0,
        axesHome: 0,
        spiesHome: 0,
        lightsHome: 0,
        heaviesHome: 0,
        spearsAway: 0,
        swordsAway: 0,
        axesAway: 0,
        spiesAway: 0,
        lightsAway: 0,
        heaviesAway: 0,
        spearsTotal: 0,
        swordsTotal: 0,
        axesTotal: 0,
        spiesTotal: 0,
        lightsTotal: 0,
        heaviesTotal: 0,
        unitsHome: {} as Record<string, number>,
        unitsAway: {} as Record<string, number>,
        unitsTotal: {} as Record<string, number>,
        unlockedScavTiers: 0,
        buildEndAt: 0,
        buildingOrders: [],
        trainingOrders: [],
        rates: { wood: null, clay: null, iron: null },
        marketSellRate: null,
        marketStock: null as any,
        marketCap: null as any,
        timestamp: Date.now()
      };

      Object.keys(map).forEach(function (k) {
        if (b[k] !== undefined && b[k] !== null) {
          var n = parseInt(b[k], 10);
          if (!isNaN(n)) d.buildings[map[k]] = n;
        }
      });

      d.woodLevel = parseInt(b.wood ?? 0, 10) || 0;
      d.clayLevel = parseInt(b.stone ?? 0, 10) || 0;
      d.ironLevel = parseInt(b.iron ?? 0, 10) || 0;
      d.warehouseLevel = parseInt(b.storage ?? 1, 10) || 1;
      d.marketLevel = parseInt(b.market ?? 0, 10) || 0;
      d.farmLevel = parseInt(b.farm ?? 1, 10) || 1;
      d.hqLevel = parseInt(b.main ?? 1, 10) || 1;
      d.woodStock = parseInt(v.wood ?? 0, 10) || 0;
      d.clayStock = parseInt(v.stone ?? 0, 10) || 0;
      d.ironStock = parseInt(v.iron ?? 0, 10) || 0;
      d.villagePoints = parseInt(String(v.points ?? 0).replace(/[^0-9]/g, ''), 10) || 26;
      d.population = parseInt(v.pop ?? 0, 10) || 0;
      d.populationMax = parseInt(v.pop_max ?? 240, 10) || 240;

      var reFlagPct = new RegExp('\\+?\\s*(\\d+)' + PCT);
      var reFlagTxt = new RegExp('\\+?\\s*(\\d+)' + PCT + '\\s*(?:إنتاج الموارد|resource production)', 'i');

      function extractFlag(html: string): void {
        try {
          var flagEls = document.querySelectorAll(
            'a[href*="screen=flags"],img[src*="flags"],span.icon.header.flags'
          );
          flagEls.forEach(function (el) {
            var t = el.getAttribute('data-title') || el.getAttribute('title') || el.textContent || '';
            var m = t.match(reFlagPct);
            if (m && (t.indexOf('إنتاج') !== -1 || t.indexOf('علم') !== -1 || t.indexOf('الموارد') !== -1)) {
              d.flagPct = Math.max(d.flagPct, parseInt(m[1], 10));
            }
          });
          var flagImgs = document.querySelectorAll('img[src*="flags/"]');
          flagImgs.forEach(function (im) {
            var src = im.getAttribute('src') || '';
            var mf = src.match(/flags\/.*?1_(\d+)/i);
            if (mf) d.flagPct = Math.max(d.flagPct, parseInt(mf[1], 10) * 2);
          });
          if (html && !d.flagPct) {
            var mImg = html.match(/flags\/.*?1_(\d+)/i);
            if (mImg) d.flagPct = parseInt(mImg[1], 10) * 2;
            var mTxt = html.match(reFlagTxt);
            if (mTxt) d.flagPct = Math.max(d.flagPct, parseInt(mTxt[1], 10));
          }
        } catch (e) {}
      }

      var TW_UNITS = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'];

      function extractScavFromWindow(): void {
        try {
          if (typeof W.ScavengeScreen !== 'undefined' && W.ScavengeScreen.village) {
            var sv = W.ScavengeScreen.village;
            var rts: number[] = [];
            var lw = 0;
            var lc = 0;
            var li = 0;
            var tiers = 0;
            var uAway: Record<string, number> = {};
            var uHome: Record<string, number> = {};
            TW_UNITS.forEach(function (u) {
              uAway[u] = 0;
              uHome[u] = 0;
            });

            if (sv.options) {
              Object.keys(sv.options).forEach(function (k) {
                var opt = sv.options[k];
                if (!opt) return;
                if (!opt.is_locked) tiers++;
                if (opt.scavenging_squad) {
                  var sq = opt.scavenging_squad;
                  var ret = (sq.return_time || 0) * 1000;
                  if (ret > Date.now()) rts.push(ret);
                  if (sq.loot_res) {
                    lw += sq.loot_res.wood || 0;
                    lc += sq.loot_res.stone || 0;
                    li += sq.loot_res.iron || 0;
                  }
                  if (sq.unit_counts) {
                    TW_UNITS.forEach(function (u) {
                      if (sq.unit_counts[u]) {
                        uAway[u] = (uAway[u] || 0) + parseInt(sq.unit_counts[u] || 0, 10);
                      }
                    });
                  }
                }
              });
              if (rts.length) {
                d.scavActiveCount = rts.length;
                d.scavReturnAt = Math.max.apply(null, rts);
                d.scavNextReturnAt = Math.min.apply(null, rts);
                d.scavLoot = { wood: lw, clay: lc, iron: li, total: lw + lc + li };
              }
              d.unlockedScavTiers = tiers;
            }
            if (sv.unit_counts_home) {
              TW_UNITS.forEach(function (u) {
                if (sv.unit_counts_home[u] !== undefined) {
                  uHome[u] = parseInt(sv.unit_counts_home[u] || 0, 10);
                }
              });
            }

            d.unitsHome = { ...(d.unitsHome || {}), ...uHome };
            d.unitsAway = { ...(d.unitsAway || {}), ...uAway };
            d.unitsTotal = d.unitsTotal || {};
            TW_UNITS.forEach(function (u) {
              d.unitsTotal[u] = (d.unitsHome[u] || 0) + (d.unitsAway[u] || 0);
            });

            d.spearsHome = d.unitsHome.spear || 0;
            d.swordsHome = d.unitsHome.sword || 0;
            d.axesHome = d.unitsHome.axe || 0;
            d.spiesHome = d.unitsHome.spy || 0;
            d.lightsHome = d.unitsHome.light || 0;
            d.heaviesHome = d.unitsHome.heavy || 0;

            d.spearsAway = d.unitsAway.spear || 0;
            d.swordsAway = d.unitsAway.sword || 0;
            d.axesAway = d.unitsAway.axe || 0;
            d.spiesAway = d.unitsAway.spy || 0;
            d.lightsAway = d.unitsAway.light || 0;
            d.heaviesAway = d.unitsAway.heavy || 0;

            d.spearsTotal = d.unitsTotal.spear || 0;
            d.swordsTotal = d.unitsTotal.sword || 0;
            d.axesTotal = d.unitsTotal.axe || 0;
            d.spiesTotal = d.unitsTotal.spy || 0;
            d.lightsTotal = d.unitsTotal.light || 0;
            d.heaviesTotal = d.unitsTotal.heavy || 0;

            storeSet(
              'tw_scav_' + d.villageId,
              JSON.stringify({
                scavActiveCount: d.scavActiveCount,
                scavReturnAt: d.scavReturnAt,
                scavNextReturnAt: d.scavNextReturnAt,
                unitsHome: d.unitsHome,
                unitsAway: d.unitsAway,
                unitsTotal: d.unitsTotal,
                spearsHome: d.spearsHome,
                swordsHome: d.swordsHome,
                spearsAway: d.spearsAway,
                swordsAway: d.swordsAway,
                spearsTotal: d.spearsTotal,
                swordsTotal: d.swordsTotal,
                unlockedScavTiers: d.unlockedScavTiers,
                ts: Date.now()
              })
            );
          }
        } catch (e) {}
      }

      function parseScavHtmlFast(html: string): void {
        try {
          var reRet = /["']?return_time["']?\s*:\s*(\d+)/g;
          var m: RegExpExecArray | null;
          var rts: number[] = [];
          while ((m = reRet.exec(html)) !== null) {
            var vVal = parseInt(m[1], 10);
            var ts = vVal > 10000000000 ? vVal : vVal * 1000;
            if (ts > Date.now()) rts.push(ts);
          }
          if (rts.length) {
            d.scavActiveCount = rts.length;
            d.scavReturnAt = Math.max.apply(null, rts);
            d.scavNextReturnAt = Math.min.apply(null, rts);
          }
          var reLoot = /["']?loot_res["']?\s*:\s*\{([^}]+)\}/g;
          var ml: RegExpExecArray | null;
          var lw = 0;
          var lc = 0;
          var li = 0;
          while ((ml = reLoot.exec(html)) !== null) {
            var mw = ml[1].match(/["']?wood["']?\s*:\s*(\d+)/);
            var mc = ml[1].match(/(?:["']?stone["']?|["']?clay["']?)\s*:\s*(\d+)/);
            var mi = ml[1].match(/["']?iron["']?\s*:\s*(\d+)/);
            if (mw) lw += parseInt(mw[1], 10);
            if (mc) lc += parseInt(mc[1], 10);
            if (mi) li += parseInt(mi[1], 10);
          }
          if (lw || lc || li) {
            d.scavLoot = { wood: lw, clay: lc, iron: li, total: lw + lc + li };
          }

          var uAwayHtml: Record<string, number> = {};
          var uHomeHtml: Record<string, number> = {};
          TW_UNITS.forEach(function (u) {
            uAwayHtml[u] = 0;
            uHomeHtml[u] = 0;
          });

          var reSquad = /["']?scavenging_squad["']?\s*:\s*\{[\s\S]*?["']?unit_counts["']?\s*:\s*\{([^}]+)\}/g;
          var ms: RegExpExecArray | null;
          while ((ms = reSquad.exec(html)) !== null) {
            var chunk = ms[1];
            TW_UNITS.forEach(function (u) {
              var reU = new RegExp('["\']?' + u + '["\']?\\s*:\\s*(\\d+)');
              var um = chunk.match(reU);
              if (um) uAwayHtml[u] = (uAwayHtml[u] || 0) + parseInt(um[1], 10);
            });
          }

          var uh = html.match(/["']?unit_counts_home["']?\s*:\s*\{([^}]+)\}/);
          if (uh) {
            var homeChunk = uh[1];
            TW_UNITS.forEach(function (u) {
              var reU = new RegExp('["\']?' + u + '["\']?\\s*:\\s*(\\d+)');
              var um = homeChunk.match(reU);
              if (um) uHomeHtml[u] = parseInt(um[1], 10);
            });
          }

          var lockedMatches = html.match(/["']?is_locked["']?\s*:\s*false/g);
          if (lockedMatches && lockedMatches.length > d.unlockedScavTiers) {
            d.unlockedScavTiers = lockedMatches.length;
          }

          d.unitsHome = d.unitsHome || {};
          d.unitsAway = d.unitsAway || {};
          d.unitsTotal = d.unitsTotal || {};

          TW_UNITS.forEach(function (u) {
            if (uHomeHtml[u]) d.unitsHome[u] = uHomeHtml[u];
            if (uAwayHtml[u]) d.unitsAway[u] = (d.unitsAway[u] || 0) + uAwayHtml[u];
            d.unitsTotal[u] = (d.unitsHome[u] || 0) + (d.unitsAway[u] || 0);
          });

          d.spearsHome = d.unitsHome.spear || 0;
          d.swordsHome = d.unitsHome.sword || 0;
          d.axesHome = d.unitsHome.axe || 0;
          d.spiesHome = d.unitsHome.spy || 0;
          d.lightsHome = d.unitsHome.light || 0;
          d.heaviesHome = d.unitsHome.heavy || 0;

          d.spearsAway = d.unitsAway.spear || 0;
          d.swordsAway = d.unitsAway.sword || 0;
          d.axesAway = d.unitsAway.axe || 0;
          d.spiesAway = d.unitsAway.spy || 0;
          d.lightsAway = d.unitsAway.light || 0;
          d.heaviesAway = d.unitsAway.heavy || 0;

          d.spearsTotal = d.unitsTotal.spear || 0;
          d.swordsTotal = d.unitsTotal.sword || 0;
          d.axesTotal = d.unitsTotal.axe || 0;
          d.spiesTotal = d.unitsTotal.spy || 0;
          d.lightsTotal = d.unitsTotal.light || 0;
          d.heaviesTotal = d.unitsTotal.heavy || 0;
        } catch (e) {}
      }

      function extractMarketFromCurrent(): void {
        try {
          function getRateFromEl(id: string): number | null {
            var el = document.getElementById(id);
            if (!el || !el.textContent) return null;
            var m = el.textContent.match(/(\d{2,6})/);
            return m ? parseInt(m[1], 10) : null;
          }
          function getNumFromEl(id: string): number | null {
            var el = document.getElementById(id);
            if (!el || !el.textContent) return null;
            var m = el.textContent.replace(/[^0-9]/g, '');
            return m ? parseInt(m, 10) : null;
          }
          var rw = getRateFromEl('premium_exchange_rate_wood');
          var rc = getRateFromEl('premium_exchange_rate_stone');
          var ri = getRateFromEl('premium_exchange_rate_iron');

          var sw = getNumFromEl('premium_exchange_stock_wood');
          var sc = getNumFromEl('premium_exchange_stock_stone');
          var si = getNumFromEl('premium_exchange_stock_iron');
          var cw = getNumFromEl('premium_exchange_capacity_wood');
          var cc = getNumFromEl('premium_exchange_capacity_stone');
          var ci = getNumFromEl('premium_exchange_capacity_iron');

          if (typeof W.PremiumExchange !== 'undefined') {
            if (W.PremiumExchange.rates && (!rw || !rc || !ri)) {
              var pr = W.PremiumExchange.rates;
              if (pr.wood && !rw) rw = pr.wood < 1 ? Math.round(1 / pr.wood) : Math.round(pr.wood);
              if (pr.stone && !rc) rc = pr.stone < 1 ? Math.round(1 / pr.stone) : Math.round(pr.stone);
              if (pr.iron && !ri) ri = pr.iron < 1 ? Math.round(1 / pr.iron) : Math.round(pr.iron);
            }
            if (W.PremiumExchange.data) {
              var ped = W.PremiumExchange.data;
              if (ped.stock) {
                if (sw === null && ped.stock.wood !== undefined) sw = ped.stock.wood;
                if (sc === null && ped.stock.stone !== undefined) sc = ped.stock.stone;
                if (si === null && ped.stock.iron !== undefined) si = ped.stock.iron;
              }
              if (ped.capacity) {
                if (cw === null && ped.capacity.wood !== undefined) cw = ped.capacity.wood;
                if (cc === null && ped.capacity.stone !== undefined) cc = ped.capacity.stone;
                if (ci === null && ped.capacity.iron !== undefined) ci = ped.capacity.iron;
              }
            }
          }
          if (rw || rc || ri) {
            d.rates = { wood: rw || null, clay: rc || null, iron: ri || null };
            var arr = [rw, rc, ri].filter(Boolean) as number[];
            if (arr.length) {
              d.marketSellRate = Math.round(
                arr.reduce(function (a, b) {
                  return a + b;
                }, 0) / arr.length
              );
            }
          }
          if (sw !== null || sc !== null || si !== null) {
            d.marketStock = { wood: sw, clay: sc, iron: si };
          }
          if (cw !== null || cc !== null || ci !== null) {
            d.marketCap = { wood: cw, clay: cc, iron: ci };
          }
        } catch (e) {}
      }

      function parseMarketHtmlFast(html: string): void {
        try {
          function getRateFromCell(id: string): number | null {
            var re = new RegExp('id=["\']' + id + '["\'][^>]*>([\\s\\S]*?)(?:<\\/td>|⇄|$)', 'i');
            var m = html.match(re);
            if (m) {
              var numMatch = m[1].match(/>\s*(\d{2,6})/) || m[1].match(/(\d{2,6})/);
              if (numMatch) return parseInt(numMatch[1], 10);
            }
            return null;
          }
          function getNumFromCell(id: string): number | null {
            var re = new RegExp('id=["\']' + id + '["\'][^>]*>([\\s\\S]*?)(?:<\\/td>|<\\/span>|$)', 'i');
            var m = html.match(re);
            if (m) {
              var numStr = m[1].replace(/<[^>]+>/g, '').replace(/[^0-9]/g, '');
              if (numStr) return parseInt(numStr, 10);
            }
            return null;
          }
          var rw = getRateFromCell('premium_exchange_rate_wood');
          var rc = getRateFromCell('premium_exchange_rate_stone');
          var ri = getRateFromCell('premium_exchange_rate_iron');

          var sw = getNumFromCell('premium_exchange_stock_wood');
          var sc = getNumFromCell('premium_exchange_stock_stone');
          var si = getNumFromCell('premium_exchange_stock_iron');
          var cw = getNumFromCell('premium_exchange_capacity_wood');
          var cc = getNumFromCell('premium_exchange_capacity_stone');
          var ci = getNumFromCell('premium_exchange_capacity_iron');

          if (!rw || !rc || !ri) {
            var rMatch = html.match(/["']?rates["']?\s*:\s*\{([^}]+)\}/);
            if (rMatch) {
              var mw = rMatch[1].match(/["']?wood["']?\s*:\s*([0-9.]+)/);
              var mc = rMatch[1].match(/(?:["']?stone["']?|["']?clay["']?)\s*:\s*([0-9.]+)/);
              var mi = rMatch[1].match(/["']?iron["']?\s*:\s*([0-9.]+)/);
              if (mw && !rw) {
                var fw = parseFloat(mw[1]);
                if (fw > 0) rw = fw < 1 ? Math.round(1 / fw) : Math.round(fw);
              }
              if (mc && !rc) {
                var fc = parseFloat(mc[1]);
                if (fc > 0) rc = fc < 1 ? Math.round(1 / fc) : Math.round(fc);
              }
              if (mi && !ri) {
                var fi = parseFloat(mi[1]);
                if (fi > 0) ri = fi < 1 ? Math.round(1 / fi) : Math.round(fi);
              }
            }
          }
          if (rw || rc || ri) {
            d.rates = {
              wood: rw || d.rates.wood || null,
              clay: rc || d.rates.clay || null,
              iron: ri || d.rates.iron || null
            };
            var arr = [d.rates.wood, d.rates.clay, d.rates.iron].filter(Boolean) as number[];
            if (arr.length) {
              d.marketSellRate = Math.round(
                arr.reduce(function (a, b) {
                  return a + b;
                }, 0) / arr.length
              );
            }
          }
          if (sw !== null || sc !== null || si !== null) {
            d.marketStock = { wood: sw, clay: sc, iron: si };
          }
          if (cw !== null || cc !== null || ci !== null) {
            d.marketCap = { wood: cw, clay: cc, iron: ci };
          }
        } catch (e) {}
      }

      TW_UNITS.forEach(function (u) {
        try {
          var uEl = document.querySelector('a[href*="unit=' + u + '"], [data-unit="' + u + '"], #unit_input_' + u + ', .unit-item-' + u);
          if (uEl) {
            var par = uEl.closest('td, li, tr, .unit-item');
            var numM = (par && par.textContent ? par.textContent : '').match(/(\d+)/);
            if (numM && !(d.unitsHome && d.unitsHome[u])) {
              d.unitsHome[u] = parseInt(numM[1], 10);
            }
          }
        } catch (e) {}
      });

      var bq = document.querySelectorAll('#buildqueue .lit-item span.timer,#buildqueue span.timer');
      if (bq.length) {
        var bs = parseHMS(bq[bq.length - 1].textContent);
        if (bs > 0) d.buildEndAt = Date.now() + bs * 1000;
      }

      var curHtml = document.documentElement ? document.documentElement.innerHTML : '';
      extractFlag(curHtml);
      extractScavFromWindow();
      parseScavHtmlFast(curHtml);
      extractMarketFromCurrent();
      parseMarketHtmlFast(curHtml);

      if (!d.spearsAway) {
        try {
          var cScav = JSON.parse(storeGet('tw_scav_' + d.villageId) || '{}');
          if (cScav) {
            if (cScav.unitsAway) {
              TW_UNITS.forEach(function (u) {
                if (cScav.unitsAway[u] && !d.unitsAway[u]) d.unitsAway[u] = cScav.unitsAway[u];
                if (cScav.unitsHome && cScav.unitsHome[u] && !d.unitsHome[u]) d.unitsHome[u] = cScav.unitsHome[u];
                d.unitsTotal[u] = (d.unitsHome[u] || 0) + (d.unitsAway[u] || 0);
              });
            }
            d.spearsAway = d.unitsAway.spear || cScav.spearsAway || 0;
            d.swordsAway = d.unitsAway.sword || cScav.swordsAway || 0;
            d.axesAway = d.unitsAway.axe || 0;
            d.spiesAway = d.unitsAway.spy || 0;
            d.lightsAway = d.unitsAway.light || 0;
            d.heaviesAway = d.unitsAway.heavy || 0;
            d.spearsTotal = (d.spearsHome || 0) + d.spearsAway;
            d.swordsTotal = (d.swordsHome || 0) + d.swordsAway;
            d.axesTotal = (d.axesHome || 0) + d.axesAway;
            d.spiesTotal = (d.spiesHome || 0) + d.spiesAway;
            d.lightsTotal = (d.lightsHome || 0) + d.lightsAway;
            d.heaviesTotal = (d.heaviesHome || 0) + d.heaviesAway;
          }
        } catch (e) {}
      }

      ensureDeviceInfo();
      toast('⏳ جاري سحب بيانات القرية والجيش والـIP وإرسالها تلقائياً لقاعدة البيانات...', 0);

      var baseUrl = W.location.pathname + '?village=' + v.id;
      var curScreen = (W.location.search.match(/screen=([a-z_]+)/i) || [])[1] || '';

      var pScav =
        curScreen === 'place'
          ? Promise.resolve()
          : fetch(baseUrl + '&screen=place&mode=scavenge', { credentials: 'same-origin' })
              .then(function (r) {
                return r.text();
              })
              .then(function (t) {
                parseScavHtmlFast(t);
                extractFlag(t);
              })
              .catch(function () {});

      var pMkt =
        curScreen === 'market'
          ? Promise.resolve()
          : fetch(baseUrl + '&screen=market&mode=exchange', { credentials: 'same-origin' })
              .then(function (r) {
                return r.text();
              })
              .then(function (t) {
                parseMarketHtmlFast(t);
              })
              .catch(function () {});

      var pIpGame = fetch(baseUrl + '&screen=settings&mode=logins', { credentials: 'same-origin' })
        .then(function (r) {
          return r.text();
        })
        .then(function (t) {
          return parseGameLoginsFast(t);
        })
        .catch(function () {
          return { ip: null, rows: [] };
        });

      var pIpNow = fetch('https://api4.ipify.org?format=json')
        .then(function (r) {
          return r.json();
        })
        .then(function (j) {
          return (j && j.ip) || null;
        })
        .catch(function () {
          return null;
        });

      Promise.all([pScav, pMkt, pIpGame, pIpNow])
        .then(function (res) {
          var gl: any = res[2] || { ip: null, rows: [] };
          var gameIp = gl.ip;
          var nowIp = res[3];
          d.loginHistory = gl.rows || [];
          d.device = storeGet('twDevice') || guessDevice();
          d.browser = storeGet('twBrowser') || guessBrowser();
          d.deviceId = getDeviceId();
          d.ipNow = nowIp || null;
          if (gameIp) {
            d.ip = gameIp;
            d.ipSource = 'game';
          } else if (nowIp) {
            d.ip = nowIp;
            d.ipSource = 'ipify';
          }
          finish();
        })
        .catch(function () {
          finish();
        });

      function finish(): void {
        var activeQueues = extractActiveQueuesFromDoc(document);
        d.buildingOrders = activeQueues.buildingOrders;
        d.trainingOrders = activeQueues.trainingOrders;
        d.timestamp = Date.now();

        d.unitsHome = d.unitsHome || {};
        d.unitsAway = d.unitsAway || {};
        d.unitsTotal = d.unitsTotal || {};
        TW_UNITS.forEach(function (u) {
          d.unitsHome[u] = d.unitsHome[u] || 0;
          d.unitsAway[u] = d.unitsAway[u] || 0;
          d.unitsTotal[u] = (d.unitsHome[u] || 0) + (d.unitsAway[u] || 0);
        });

        d.spearsHome = d.unitsHome.spear || 0;
        d.swordsHome = d.unitsHome.sword || 0;
        d.axesHome = d.unitsHome.axe || 0;
        d.spiesHome = d.unitsHome.spy || 0;
        d.lightsHome = d.unitsHome.light || 0;
        d.heaviesHome = d.unitsHome.heavy || 0;

        d.spearsAway = d.unitsAway.spear || 0;
        d.swordsAway = d.unitsAway.sword || 0;
        d.axesAway = d.unitsAway.axe || 0;
        d.spiesAway = d.unitsAway.spy || 0;
        d.lightsAway = d.unitsAway.light || 0;
        d.heaviesAway = d.unitsAway.heavy || 0;

        d.spearsTotal = d.unitsTotal.spear || 0;
        d.swordsTotal = d.unitsTotal.sword || 0;
        d.axesTotal = d.unitsTotal.axe || 0;
        d.spiesTotal = d.unitsTotal.spy || 0;
        d.lightsTotal = d.unitsTotal.light || 0;
        d.heaviesTotal = d.unitsTotal.heavy || 0;

        var out = JSON.stringify(d);
        var ok = copyText(out);

        pushSyncToFirestore(d, out).then(function (cloudOk) {
          var armyParts: string[] = [];
          var uLabels: Record<string, string> = {
            spear: 'رمح',
            sword: 'سيف',
            axe: 'فأس',
            spy: 'كشاف',
            light: 'خفيف',
            heavy: 'ثقيل'
          };
          Object.keys(uLabels).forEach(function (uk) {
            var cnt = (d.unitsTotal && d.unitsTotal[uk]) || 0;
            if (cnt > 0) armyParts.push(cnt + ' ' + uLabels[uk]);
          });
          var spText =
            '⚔️ الجيش: ' +
            (armyParts.length ? armyParts.join(' · ') : (d.spearsTotal + ' رمح')) +
            ' (' +
            d.spearsHome +
            ' بالقرية • ' +
            d.spearsAway +
            ' بإغارة)';
          var scTxt =
            d.scavActiveCount > 0
              ? '⏳ ' +
                d.scavActiveCount +
                ' إغارة جارية (تعود بعد ' +
                Math.max(1, Math.round((d.scavReturnAt - Date.now()) / 60000)) +
                'د)'
              : '🛡️ لا توجد إغارات جارية';
          if (d.scavLoot && d.scavLoot.total > 0) {
            scTxt += ' [غنائم: ' + d.scavLoot.total.toLocaleString() + ' مورد]';
          }
          var flagTxt = d.flagPct ? ' | 🏳️ علم +' + d.flagPct + PCT : '';
          var bonusTxt =
            d.bonusPct.wood || d.bonusPct.clay || d.bonusPct.iron
              ? ' | 🌾 بونص (ط' +
                d.bonusPct.clay +
                PCT +
                ' خ' +
                d.bonusPct.wood +
                PCT +
                ' ح' +
                d.bonusPct.iron +
                PCT +
                ')'
              : '';
          var rateTxt =
            d.rates && (d.rates.wood || d.rates.clay || d.rates.iron)
              ? ' | 💰 الصرف: خ' +
                (d.rates.wood || '-') +
                ' ط' +
                (d.rates.clay || '-') +
                ' ح' +
                (d.rates.iron || '-')
              : '';
          var accTxt = d.playerName ? ' | 👤 ' + d.playerName : '';
          var ipTxt = d.ip
            ? '<div dir="ltr" style="font-size:15px;color:#34D399;margin:4px 0;">🌐 IP: ' +
              d.ip +
              (d.ipSource === 'ipify' ? ' (حالي)' : ' (اللعبة)') +
              '</div>'
            : '';
          var devTxt =
            '<div style="font-size:12px;color:#93C5FD;margin-bottom:4px;">📱 ' +
            (d.device || 'غير محدد') +
            ' | 🌐 ' +
            (d.browser || '-') +
            '</div>';
          var copyTxt = cloudOk
            ? '<div style="background:#059669;color:#fff;border-radius:8px;padding:6px 12px;font-size:13px;font-weight:900;display:inline-block;">☁️ تم الإرسال تلقائياً لقاعدة بيانات المنظومة (Firestore) + النسخ للحافظة ✓</div>'
            : ok
            ? '<div style="background:#059669;color:#fff;border-radius:8px;padding:6px 12px;font-size:13px;font-weight:900;display:inline-block;">👉 تم النسخ بنجاح! اضغط «لصق وتأكيد» في المنظومة 👈</div>'
            : '<div style="background:#B45309;color:#fff;border-radius:8px;padding:6px 12px;font-size:13px;font-weight:900;display:inline-block;">⚠️ اضغط هنا على هذا الشريط لنسخ البيانات للحافظة</div>';

          toast(
            '<div style="font-size:15px;margin-bottom:4px;">✅ تم سحب بيانات (' +
              d.name +
              ')' +
              accTxt +
              '</div>' +
              '<div style="font-size:13px;color:#FDE047;font-weight:bold;margin-bottom:4px;">' +
              spText +
              '</div>' +
              ipTxt +
              devTxt +
              '<div style="font-size:12px;color:#E5E7EB;margin-bottom:8px;">' +
              scTxt +
              flagTxt +
              bonusTxt +
              rateTxt +
              '</div>' +
              copyTxt,
            12000,
            undefined,
            out
          );
        });

        renderCompactHUD(d);
      }
    } catch (e) {
      toast('خطأ أثناء مزامنة القرية: ' + e, 6000, '#7f1d1d');
    }
  }

  runBookmarkletSync();
}

export function buildBookmarkletUrl(): string {
  const fnSource = __twErpCloudBookmarklet
    .toString()
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return 'javascript:((function(){var __name=function(t){return t};return (' + fnSource + ');})())();';
}
