/*
 * Trophy Room Kiosk — main app (vanilla JS, no dependencies, offline).
 * Views: gallery ⇄ trophy detail, plus PIN-protected admin.
 * State comes from /api/state; live sync across devices via SSE.
 */
(function () {
  'use strict';

  /* ================================ i18n ================================ */

  var I18N = {
    ar: {
      brand: 'قاعة الكؤوس', tapToReturn: 'المس أي مكان للعودة',
      adminTitle: 'لوحة التحكم', back: 'رجوع', enterPin: 'أدخل الرمز السري',
      login: 'دخول', wrongPin: 'رمز خاطئ', tabTrophies: 'الكؤوس',
      tabLighting: 'الإضاءة والأجهزة', tabSystem: 'النظام', search: 'بحث…',
      addTrophy: '+ إضافة كأس', controllers: 'وحدات WLED (٤ شرائط)',
      globalLight: 'الإضاءة العامة', master: 'تشغيل الإضاءة',
      idleColor: 'لون الوضع العام', testAllOn: 'تجربة: تشغيل الكل',
      testAllOff: 'إطفاء الكل', save: 'حفظ', saved: 'تم الحفظ ✓',
      sent: 'تم إرسال الأمر ✓', changePin: 'تغيير الرمز السري',
      oldPin: 'الرمز الحالي', newPin: 'الرمز الجديد (٤–٨ أرقام)',
      pinChanged: 'تم تغيير الرمز ✓', exportTitle: 'تصدير الإعدادات',
      exportHint: 'حمّل كل التعديلات كملف إعدادات أساسي، أو ثبّتها مباشرة في ملف النظام.',
      exportDownload: 'تحميل base-config.json', exportApply: 'تثبيت التعديلات في الأساس',
      applied: 'تم التثبيت في الملف الأساسي ✓',
      confirmApply: 'سيتم استبدال الملف الأساسي بكل التعديلات الحالية (يُحفظ نسخة احتياطية). متابعة؟',
      perfTitle: 'الأداء', reducedFx: 'وضع التأثيرات المخفّضة (لأجهزة التلفاز الضعيفة)',
      editTrophy: 'تعديل كأس', newTrophy: 'كأس جديد',
      fTitleAr: 'العنوان (عربي)', fTitleEn: 'العنوان (إنجليزي)',
      fGameAr: 'اللعبة (عربي)', fGameEn: 'اللعبة (إنجليزي)',
      fLocAr: 'المكان (عربي)', fLocEn: 'المكان (إنجليزي)',
      fDescAr: 'الوصف (عربي)', fDescEn: 'الوصف (إنجليزي)', fYear: 'السنة',
      fImage: 'الصورة الرئيسية', fPhotos: 'صور إضافية (سطر لكل صورة)',
      fLighting: 'الإضاءة', fDevice: 'الجهاز', fStart: 'أول ليد',
      fStop: 'آخر ليد', fColor: 'اللون', testRange: '💡 تجربة هذا النطاق',
      cancel: 'إلغاء', edit: 'تعديل', del: 'حذف', restore: 'استرجاع الأصل',
      confirmDelete: 'حذف هذا الكأس؟', edited: 'معدّل', custom: 'مضاف',
      device: 'جهاز', led: 'ليد', errNet: 'تعذر الاتصال بالخادم',
      uploading: 'جارٍ الرفع…', ipLabel: 'عنوان IP', ledCountLabel: 'عدد الليدات',
      seconds: 'ث',
    },
    en: {
      brand: 'Trophy Room', tapToReturn: 'Touch anywhere to return',
      adminTitle: 'Admin Panel', back: 'Back', enterPin: 'Enter admin PIN',
      login: 'Login', wrongPin: 'Wrong PIN', tabTrophies: 'Trophies',
      tabLighting: 'Lighting & Devices', tabSystem: 'System', search: 'Search…',
      addTrophy: '+ Add trophy', controllers: 'WLED controllers (4 strips)',
      globalLight: 'Global lighting', master: 'Master lights on',
      idleColor: 'Idle "all on" color', testAllOn: 'Test: all on',
      testAllOff: 'All off', save: 'Save', saved: 'Saved ✓',
      sent: 'Command sent ✓', changePin: 'Change PIN',
      oldPin: 'Current PIN', newPin: 'New PIN (4–8 digits)',
      pinChanged: 'PIN changed ✓', exportTitle: 'Export configuration',
      exportHint: 'Download every change as a base config file, or bake it straight into the system file.',
      exportDownload: 'Download base-config.json', exportApply: 'Bake changes into base',
      applied: 'Baked into base config ✓',
      confirmApply: 'This replaces the base config file with all current changes (a backup is kept). Continue?',
      perfTitle: 'Performance', reducedFx: 'Reduced-effects mode (for weak TV browsers)',
      editTrophy: 'Edit trophy', newTrophy: 'New trophy',
      fTitleAr: 'Title (Arabic)', fTitleEn: 'Title (English)',
      fGameAr: 'Game (Arabic)', fGameEn: 'Game (English)',
      fLocAr: 'Location (Arabic)', fLocEn: 'Location (English)',
      fDescAr: 'Description (Arabic)', fDescEn: 'Description (English)', fYear: 'Year',
      fImage: 'Main image', fPhotos: 'Extra photos (one per line)',
      fLighting: 'Lighting', fDevice: 'Device', fStart: 'First LED',
      fStop: 'Last LED', fColor: 'Color', testRange: '💡 Test this range',
      cancel: 'Cancel', edit: 'Edit', del: 'Delete', restore: 'Restore original',
      confirmDelete: 'Delete this trophy?', edited: 'edited', custom: 'custom',
      device: 'Device', led: 'LED', errNet: 'Cannot reach server',
      uploading: 'Uploading…', ipLabel: 'IP address', ledCountLabel: 'LED count',
      seconds: 's',
    },
  };

  var lang = 'ar';
  try { lang = localStorage.getItem('lang') || 'ar'; } catch (e) {}
  function T(k) { return (I18N[lang] && I18N[lang][k]) || I18N.ar[k] || k; }

  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    $('btn-lang').textContent = lang === 'ar' ? 'EN' : 'عربي';
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = T(nodes[i].getAttribute('data-i18n'));
    nodes = document.querySelectorAll('[data-i18n-ph]');
    for (i = 0; i < nodes.length; i++) nodes[i].setAttribute('placeholder', T(nodes[i].getAttribute('data-i18n-ph')));
  }

  /* =============================== helpers =============================== */

  function $(id) { return document.getElementById(id); }
  function loc(t, field) { return t[field + '_' + lang] || t[field + '_ar'] || t[field + '_en'] || ''; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function flash(el, text, cls) {
    el.textContent = text;
    el.className = 'msg ' + (cls || '');
    setTimeout(function () { if (el.textContent === text) { el.textContent = ''; el.className = 'msg'; } }, 4000);
  }
  function api(path, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    if (token) opts.headers['X-Token'] = token;
    if (opts.body && typeof opts.body !== 'string') {
      opts.body = JSON.stringify(opts.body);
      opts.headers['Content-Type'] = 'application/json';
    }
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || r.status);
        return j;
      });
    });
  }

  /* ================================ state ================================ */

  var state = { version: -1, trophies: [], settings: { masterOn: true, idleColor: '#ffb03a', devices: [] } };
  var token = null;
  var view = 'gallery';       // gallery | detail | admin
  var currentTrophy = null;
  var detailTimer = null, detailDeadline = 0, countdownTimer = null;

  function loadState() {
    return api('/api/state').then(function (s) {
      var changed = s.version !== state.version;
      state = s;
      if (changed) renderCurrentView();
      return s;
    });
  }

  /* live sync: any change on any device pushes a new version over SSE */
  function connectSSE() {
    if (!('EventSource' in window)) { setInterval(loadState, 5000); return; }
    var es = new EventSource('/api/events');
    es.onmessage = function (ev) {
      try {
        var v = JSON.parse(ev.data).version;
        if (v !== state.version) loadState().then(applyLightsForView);
      } catch (e) {}
    };
    es.onerror = function () {
      es.close();
      setTimeout(connectSSE, 3000);
    };
  }

  /* =============================== lighting ============================== */

  function applyLightsForView() {
    if (view === 'detail' && currentTrophy) Lighting.highlight(currentTrophy, state.settings);
    else if (view !== 'admin') Lighting.applyIdle(state.settings);
  }
  // Re-assert every 45s so strips recover from power cuts / manual changes.
  setInterval(function () { if (view !== 'admin') applyLightsForView(); }, 45000);

  /* ================================ views ================================ */

  function showView(name) {
    view = name;
    $('view-gallery').classList.toggle('hidden', name !== 'gallery');
    $('view-detail').classList.toggle('hidden', name !== 'detail');
    $('view-admin').classList.toggle('hidden', name !== 'admin');
    if (name === 'detail') { if (window.BgFx) BgFx.pause(); }
    else if (window.BgFx) BgFx.resume();
  }

  function renderCurrentView() {
    applyLang();
    if (view === 'gallery') renderGallery();
    else if (view === 'detail') {
      // trophy may have been edited or deleted from another device
      var t = null;
      for (var i = 0; i < state.trophies.length; i++) if (state.trophies[i].id === currentTrophy.id) t = state.trophies[i];
      if (t) { currentTrophy = t; renderDetail(t); }
      else closeDetail();
    } else if (view === 'admin') renderAdminList();
  }

  /* ------- gallery ------- */
  function renderGallery() {
    var g = $('grid'), html = '';
    for (var i = 0; i < state.trophies.length; i++) {
      var t = state.trophies[i];
      html += '<div class="card" data-id="' + esc(t.id) + '">' +
        '<span class="card-dot" style="color:' + esc(t.color) + ';background:' + esc(t.color) + '"></span>' +
        '<img src="' + esc(t.image) + '" alt="" loading="lazy" draggable="false" onerror="this.src=\'img/trophy-1.svg\'">' +
        '<div class="card-body"><div class="card-title">' + esc(loc(t, 'title')) + '</div>' +
        '<div class="card-sub"><span>' + esc(loc(t, 'game')) + '</span><span class="card-year">' + esc(t.year) + '</span></div></div></div>';
    }
    g.innerHTML = html;
  }

  $('grid').addEventListener('click', function (ev) {
    var card = ev.target.closest('.card');
    if (!card) return;
    for (var i = 0; i < state.trophies.length; i++) {
      if (state.trophies[i].id === card.getAttribute('data-id')) return openDetail(state.trophies[i]);
    }
  });

  /* ------- detail ------- */
  function openDetail(t) {
    currentTrophy = t;
    renderDetail(t);
    showView('detail');
    Lighting.highlight(t, state.settings);
    startDetailTimer();
  }

  function renderDetail(t) {
    $('d-title').textContent = loc(t, 'title');
    $('d-year').textContent = t.year;
    $('d-game').textContent = loc(t, 'game');
    var locTxt = loc(t, 'location');
    $('d-location').textContent = locTxt ? '📍 ' + locTxt : '';
    $('d-location').style.display = locTxt ? '' : 'none';
    $('d-desc').textContent = loc(t, 'desc');
    var photos = (t.photos && t.photos.length ? t.photos : [t.image]).slice();
    if (photos.indexOf(t.image) === -1) photos.unshift(t.image);
    $('d-photo').src = photos[0];
    var th = '';
    if (photos.length > 1) {
      for (var i = 0; i < photos.length; i++) {
        th += '<img src="' + esc(photos[i]) + '" data-src="' + esc(photos[i]) + '" class="' + (i === 0 ? 'sel' : '') + '" draggable="false">';
      }
    }
    $('d-thumbs').innerHTML = th;
  }

  function startDetailTimer() {
    stopDetailTimer();
    detailDeadline = Date.now() + 30000;
    detailTimer = setTimeout(closeDetail, 30000);
    countdownTimer = setInterval(function () {
      var s = Math.max(0, Math.ceil((detailDeadline - Date.now()) / 1000));
      $('d-countdown').textContent = s <= 10 ? s + ' ' + T('seconds') : '';
    }, 500);
  }
  function stopDetailTimer() {
    if (detailTimer) clearTimeout(detailTimer);
    if (countdownTimer) clearInterval(countdownTimer);
    detailTimer = countdownTimer = null;
    $('d-countdown').textContent = '';
  }

  function closeDetail() {
    stopDetailTimer();
    currentTrophy = null;
    showView('gallery');
    renderGallery();
    Lighting.applyIdle(state.settings); // all lights back on
  }

  $('view-detail').addEventListener('click', function (ev) {
    // thumbnails swap the big photo instead of closing
    if (ev.target.matches('#d-thumbs img')) {
      $('d-photo').src = ev.target.getAttribute('data-src');
      var imgs = $('d-thumbs').querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) imgs[i].classList.toggle('sel', imgs[i] === ev.target);
      startDetailTimer(); // interacting resets the 30s auto-return
      return;
    }
    closeDetail();
  });

  /* ------- language toggle ------- */
  $('btn-lang').addEventListener('click', function () {
    lang = lang === 'ar' ? 'en' : 'ar';
    try { localStorage.setItem('lang', lang); } catch (e) {}
    renderCurrentView();
  });

  /* ================================ admin ================================ */

  $('btn-admin').addEventListener('click', function () {
    showView('admin');
    $('pin-gate').classList.toggle('hidden', !!token);
    $('admin-body').classList.toggle('hidden', !token);
    if (token) renderAdmin();
    else setTimeout(function () { $('pin-input').focus(); }, 50);
  });
  $('btn-admin-close').addEventListener('click', function () {
    showView('gallery');
    renderGallery();
    applyLightsForView();
  });

  function doLogin() {
    api('/api/login', { method: 'POST', body: { pin: $('pin-input').value } })
      .then(function (r) {
        token = r.token;
        $('pin-input').value = '';
        $('pin-gate').classList.add('hidden');
        $('admin-body').classList.remove('hidden');
        renderAdmin();
      })
      .catch(function () { flash($('pin-msg'), T('wrongPin'), 'err'); });
  }
  $('pin-go').addEventListener('click', doLogin);
  $('pin-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });

  /* tabs */
  var tabs = document.querySelectorAll('.admin-tabs .tab');
  for (var ti = 0; ti < tabs.length; ti++) {
    tabs[ti].addEventListener('click', function () {
      for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
      this.classList.add('active');
      var name = this.getAttribute('data-tab');
      ['trophies', 'lighting', 'system'].forEach(function (n) {
        $('tab-' + n).classList.toggle('hidden', n !== name);
      });
    });
  }

  function renderAdmin() {
    renderAdminList();
    renderDeviceRows();
    $('set-master').checked = !!state.settings.masterOn;
    $('set-idlecolor').value = state.settings.idleColor || '#ffb03a';
    $('set-reduced').checked = window.PerfMode ? PerfMode.reduced : false;
  }

  /* ------- trophy list ------- */
  function renderAdminList() {
    if (view !== 'admin' || !token) return;
    var q = ($('admin-search').value || '').toLowerCase();
    var html = '';
    for (var i = 0; i < state.trophies.length; i++) {
      var t = state.trophies[i];
      var hay = (t.title_ar + ' ' + t.title_en + ' ' + t.game_ar + ' ' + t.game_en + ' ' + t.year).toLowerCase();
      if (q && hay.indexOf(q) === -1) continue;
      var badge = t.builtin ? (t.edited ? '<span class="badge">' + T('edited') + '</span>' : '') : '<span class="badge">' + T('custom') + '</span>';
      html += '<div class="admin-item">' +
        '<img src="' + esc(t.image) + '" onerror="this.src=\'img/trophy-1.svg\'">' +
        '<div class="ai-txt"><div class="ai-title">' + esc(loc(t, 'title')) + badge + '</div>' +
        '<div class="ai-sub">' + esc(loc(t, 'game')) + ' · ' + esc(t.year) + '</div>' +
        '<div class="ai-led">' + T('device') + ' ' + t.device + ' · ' + T('led') + ' ' + t.ledStart + '–' + t.ledStop +
        ' <span class="swatch" style="background:' + esc(t.color) + '"></span></div></div>' +
        '<button class="btn btn-mini" data-act="edit" data-id="' + esc(t.id) + '">' + T('edit') + '</button>' +
        (t.builtin && t.edited ? '<button class="btn btn-mini" data-act="restore" data-id="' + esc(t.id) + '">' + T('restore') + '</button>' : '') +
        '<button class="btn btn-mini btn-danger" data-act="del" data-id="' + esc(t.id) + '">' + T('del') + '</button>' +
        '</div>';
    }
    $('admin-list').innerHTML = html;
  }
  $('admin-search').addEventListener('input', renderAdminList);

  $('admin-list').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-act]');
    if (!b) return;
    var id = b.getAttribute('data-id'), act = b.getAttribute('data-act');
    var t = null;
    for (var i = 0; i < state.trophies.length; i++) if (state.trophies[i].id === id) t = state.trophies[i];
    if (act === 'edit' && t) openEditor(t);
    else if (act === 'del' && confirm(T('confirmDelete'))) {
      api('/api/trophy/' + encodeURIComponent(id), { method: 'DELETE' }).then(loadState);
    } else if (act === 'restore') {
      api('/api/trophy/' + encodeURIComponent(id) + '/restore', { method: 'POST' }).then(loadState);
    }
  });

  $('btn-new-trophy').addEventListener('click', function () { openEditor(null); });

  /* ------- trophy editor ------- */
  var editId = null;
  var FIELDS = ['title_ar', 'title_en', 'game_ar', 'game_en', 'location_ar', 'location_en', 'desc_ar', 'desc_en', 'year', 'image', 'device', 'ledStart', 'ledStop', 'color'];

  function openEditor(t) {
    editId = t ? t.id : null;
    $('editor-title').textContent = t ? T('editTrophy') : T('newTrophy');
    FIELDS.forEach(function (f) {
      $('f-' + f).value = t ? (t[f] != null ? t[f] : '') : ({ year: new Date().getFullYear(), device: 1, ledStart: 0, ledStop: 30, color: '#ff9500', image: 'img/trophy-1.svg' }[f] || '');
    });
    $('f-photos').value = t && t.photos ? t.photos.join('\n') : '';
    $('editor-msg').textContent = '';
    $('editor').classList.remove('hidden');
  }
  function closeEditor() { $('editor').classList.add('hidden'); }
  $('btn-editor-cancel').addEventListener('click', closeEditor);
  $('editor').addEventListener('click', function (ev) { if (ev.target === this) closeEditor(); });

  $('btn-editor-save').addEventListener('click', function () {
    var body = { id: editId };
    FIELDS.forEach(function (f) { body[f] = $('f-' + f).value; });
    body.photos = $('f-photos').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    api('/api/trophy', { method: 'POST', body: body })
      .then(function () { closeEditor(); return loadState(); })
      .catch(function (e) { flash($('editor-msg'), String(e.message), 'err'); });
  });

  $('btn-test-range').addEventListener('click', function () {
    Lighting.testRange(
      parseInt($('f-device').value, 10) || 1,
      parseInt($('f-ledStart').value, 10) || 0,
      parseInt($('f-ledStop').value, 10) || 1,
      $('f-color').value, state.settings);
    flash($('editor-msg'), T('sent'), 'ok');
  });

  /* image uploads (base64 → server saves file, returns path) */
  function uploadFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        api('/api/upload', { method: 'POST', body: { data: r.result } })
          .then(function (res) { resolve(res.path); }).catch(reject);
      };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  $('f-image-pick').addEventListener('click', function () { $('f-image-file').click(); });
  $('f-image-file').addEventListener('change', function () {
    if (!this.files[0]) return;
    flash($('editor-msg'), T('uploading'));
    uploadFile(this.files[0]).then(function (p) { $('f-image').value = p; flash($('editor-msg'), T('saved'), 'ok'); })
      .catch(function () { flash($('editor-msg'), T('errNet'), 'err'); });
    this.value = '';
  });
  $('f-photos-pick').addEventListener('click', function () { $('f-photos-file').click(); });
  $('f-photos-file').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files);
    this.value = '';
    if (!files.length) return;
    flash($('editor-msg'), T('uploading'));
    var chain = Promise.resolve();
    files.forEach(function (f) {
      chain = chain.then(function () {
        return uploadFile(f).then(function (p) {
          $('f-photos').value = ($('f-photos').value.trim() + '\n' + p).trim();
        });
      });
    });
    chain.then(function () { flash($('editor-msg'), T('saved'), 'ok'); })
      .catch(function () { flash($('editor-msg'), T('errNet'), 'err'); });
  });

  /* ------- lighting & devices tab ------- */
  function renderDeviceRows() {
    var html = '';
    var devs = state.settings.devices || [];
    for (var i = 0; i < 4; i++) {
      var d = devs[i] || { ip: '', ledCount: 300 };
      html += '<div class="dev-row"><div class="dev-n">' + (i + 1) + '</div>' +
        '<input dir="ltr" id="dev-ip-' + i + '" value="' + esc(d.ip) + '" placeholder="' + T('ipLabel') + ' — 192.168.1.10' + (i + 1) + '">' +
        '<input dir="ltr" type="number" min="1" max="4096" id="dev-count-' + i + '" value="' + esc(d.ledCount) + '" title="' + T('ledCountLabel') + '">' +
        '<span class="hint">' + T('ledCountLabel') + '</span></div>';
    }
    $('dev-rows').innerHTML = html;
  }

  function collectSettings() {
    var devices = [];
    for (var i = 0; i < 4; i++) {
      devices.push({ ip: $('dev-ip-' + i).value.trim(), ledCount: parseInt($('dev-count-' + i).value, 10) || 300 });
    }
    return { masterOn: $('set-master').checked, idleColor: $('set-idlecolor').value, devices: devices };
  }

  $('btn-save-settings').addEventListener('click', function () {
    api('/api/settings', { method: 'POST', body: collectSettings() })
      .then(function () { flash($('light-msg'), T('saved'), 'ok'); return loadState(); })
      .then(applyLightsForView)
      .catch(function (e) { flash($('light-msg'), String(e.message), 'err'); });
  });
  $('btn-all-on').addEventListener('click', function () {
    Lighting.allOn(collectSettings());
    flash($('light-msg'), T('sent'), 'ok');
  });
  $('btn-all-off').addEventListener('click', function () {
    Lighting.allOff(collectSettings());
    flash($('light-msg'), T('sent'), 'ok');
  });

  /* ------- system tab ------- */
  $('btn-change-pin').addEventListener('click', function () {
    api('/api/pin', { method: 'POST', body: { oldPin: $('pin-old').value, newPin: $('pin-new').value } })
      .then(function () {
        $('pin-old').value = $('pin-new').value = '';
        flash($('pin-change-msg'), T('pinChanged'), 'ok');
      })
      .catch(function (e) { flash($('pin-change-msg'), String(e.message), 'err'); });
  });

  $('btn-export').addEventListener('click', function (ev) {
    ev.preventDefault();
    fetch('/api/export', { headers: { 'X-Token': token } })
      .then(function (r) { if (!r.ok) throw 0; return r.blob(); })
      .then(function (b) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = 'base-config.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
        flash($('sys-msg'), T('saved'), 'ok');
      })
      .catch(function () { flash($('sys-msg'), T('errNet'), 'err'); });
  });

  $('btn-apply-base').addEventListener('click', function () {
    if (!confirm(T('confirmApply'))) return;
    api('/api/apply-base', { method: 'POST' })
      .then(function () { flash($('sys-msg'), T('applied'), 'ok'); return loadState(); })
      .catch(function (e) { flash($('sys-msg'), String(e.message), 'err'); });
  });

  $('set-reduced').addEventListener('change', function () {
    if (window.PerfMode) PerfMode.set(this.checked);
  });

  /* ================================ boot ================================ */

  function hideLoader() { $('loader').classList.add('gone'); }
  // The loading screen must never hang: force-hide after 4s no matter what.
  setTimeout(hideLoader, 4000);

  applyLang();
  loadState()
    .then(function () {
      hideLoader();
      applyLightsForView();
    })
    .catch(hideLoader);
  connectSSE();
})();
