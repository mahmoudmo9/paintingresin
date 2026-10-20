(function () {
  'use strict';
  const D = window.APP_DATA;
  const $ = (s) => document.querySelector(s);

  // ---------- helpers ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'on') for (const ev in v) el.addEventListener(ev, v[ev]);
      else if (k === 'style') el.setAttribute('style', v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => { if (c == null || c === false) return; el.append(c instanceof Node ? c : String(c)); });
    return el;
  }
  const nf = new Intl.NumberFormat('fa-IR');
  const fa = (n) => (n == null || n === '' || isNaN(Number(n)) ? '—' : nf.format(Number(n)));
  const pct = (v) => fa(Math.round(Number(v) * 100)) + '٪';
  const store = {
    get(k, d) { try { const v = localStorage.getItem('rr_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('rr_' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };
  const fact = (k) => { const f = D.facts.find((x) => x.key === k); return f ? Number(f.value) : null; };

  // ---------- derived data (same rules as the dashboard) ----------
  const CLS_LABEL = { none: 'بدون شکاف جدی', war: 'فقط جنگی', structwar: 'ساختاری، تشدیدشده با جنگ', struct: 'ساختاری' };
  const CLS_HINT = {
    struct: 'وابسته به واردات؛ جنگ شکاف را بیشتر نکرده و با عادی‌سازی هم می‌ماند',
    structwar: 'پایهٔ شکاف می‌ماند؛ الان به‌خاطر حمل، آسیب یا ارز بدتر است',
    war: 'قبل از جنگ داخلی بود؛ با برگشت تولید داخل بسته می‌شود',
    none: 'در هر دو سناریو عرضهٔ داخلی کافی'
  };
  const clsOf = (a, b) => (a <= 1 ? 'none' : b <= 1 ? 'war' : a > b ? 'structwar' : 'struct');
  const GAP = { 4: 'شدید', 3: 'زیاد', 2: 'متوسط', 1: 'کم' };
  const SUP = ['راحت', 'متوسط', 'سخت', 'خیلی سخت'];
  const DEM = ['بالا', 'متوسط', 'کم'];

  const M = D.materials.map((m) => Object.assign({}, m, {
    gap_a_score: Number(m.gap_a_score), gap_b_score: Number(m.gap_b_score), dep_score: Number(m.dep_score),
    cons_min: Number(m.cons_min), cons_max: Number(m.cons_max), cons_mid: Number(m.cons_mid),
    cls: clsOf(Number(m.gap_a_score), Number(m.gap_b_score))
  }));
  const MAT = new Map(M.map((m) => [m.id, m]));
  const B = D.brands.map((b) => {
    const m = MAT.get(b.material_id);
    const worse = m && m.gap_a_score > m.gap_b_score;
    const i = SUP.indexOf(b.supply);
    const supply_a = worse && i >= 0 ? SUP[Math.min(i + 1, 3)] : b.supply;
    return Object.assign({}, b, { supply_b: b.supply, supply_a });
  });
  const signal = (d, s) => d === 'بالا'
    ? ((s === 'سخت' || s === 'خیلی سخت') ? 'کمبود؛ فرصت تأمین' : s === 'متوسط' ? 'تقاضای قوی، عرضه محدود' : 'بازار رقابتی')
    : d === 'متوسط' ? 'بازار متوسط' : 'بازار محدود';
  const sigClass = (s) => (s.startsWith('کمبود') ? 'sig-bad' : s === 'تقاضای قوی، عرضه محدود' ? 'sig-warn' : s === 'بازار رقابتی' ? 'sig-ok' : 'sig-mut');
  const brandCount = (id) => B.filter((b) => b.material_id === id).length;
  const PT = D.paint_types;
  const ptSet = (id) => { const p = PT.find((x) => x.id === id); return p ? new Set(String(p.materials).split(',')) : null; };
  const countCls = (c) => M.filter((m) => m.cls === c).length;

  // ---------- state ----------
  const state = {
    scn: store.get('scn', 'a') === 'b' ? 'b' : 'a',
    view: store.get('view', 'industry'),
    paint: '', cls: '', q: '', sort: 'gap',
    bq: '', bmat: '', bcountry: '', bev: '', bsup: '', bdem: ''
  };
  if (!['industry', 'materials', 'brands', 'method'].includes(state.view)) state.view = 'industry';
  const gapOf = (m) => (state.scn === 'a' ? m.gap_a_score : m.gap_b_score);
  const gapLabel = (m) => (state.scn === 'a' ? m.gap_a : m.gap_b);
  const supOf = (b) => (state.scn === 'a' ? b.supply_a : b.supply_b);
  const SCN_NAME = { a: 'وضع موجود', b: 'عادی‌سازی' };

  // ---------- generic pieces ----------
  const gapPill = (score, label) => h('span', { class: 'pill dot g' + score }, 'شکاف ' + label);
  const clsPill = (c) => h('span', { class: 'pill c-' + c }, CLS_LABEL[c]);
  const secHead = (title, sub) => h('div', { class: 'sec-h' }, h('h2', null, title), sub ? h('p', null, sub) : null);
  const kpi = (label, val, unit, note, extra) => h('div', Object.assign({ class: 'card kpi' + (extra && extra.cls ? ' ' + extra.cls : '') }, extra && extra.attrs),
    h('div', { class: 'lab' }, label), h('div', { class: 'val' }, val, unit ? h('span', { class: 'unit' }, ' ' + unit) : null), note ? h('div', { class: 'note' }, note) : null);

  // ---------- views ----------
  function renderIndustry() {
    const v = $('#v-industry');
    const units = fact('units'), prod8 = fact('prod_8m');
    const hard = M.filter((m) => m.status === 'red');
    const tio2 = MAT.get('tio2'), price = fact('tio2_price');
    const tMin = Math.round(tio2.cons_min * fact('tio2_import_min') * price / 1000);
    const tMax = Math.round(tio2.cons_max * fact('tio2_import_max') * price / 1000);
    const structAll = countCls('struct') + countCls('structwar');

    const shocks = h('ul', { class: 'dots' },
      h('li', { class: 'bad' }, h('span', null, 'تولید ۶ مجتمع آسیب‌دیدهٔ خلیج فارس در فروردین و اردیبهشت به ', h('b', null, pct(fact('pgpic_output'))), ' پارسال رسید. ماهشهر، با حدود ', h('b', null, pct(fact('mahshahr_share'))), ' تولید واقعی پتروشیمی کشور، با قطع برق یوتیلیتی عملاً متوقف شد.')),
      h('li', { class: 'bad' }, h('span', null, 'پتروشیمی کارون، تنها تولیدکنندهٔ داخلی TDI و MDI با ظرفیت ', h('b', null, fa(fact('karun_cap'))), ' هزار تن، خرداد ۱۴۰۵ هدف قرار گرفت؛ خبری از راه‌اندازی دوباره‌اش پیدا نشد.')),
      h('li', null, h('span', null, 'صادرات پتروشیمی از فروردین ممنوع شد. تا اواخر خرداد ', h('b', null, pct(fact('petchem_restored'))), ' واحدهای آسیب‌دیده راه افتادند، ولی تا اوایل مهر فقط ', h('b', null, pct(fact('petchem_cap_restored'))), ' ظرفیت ازدست‌رفته برگشته است. NPC زمستان سختی را از نظر گاز پیش‌بینی می‌کند.')),
      h('li', { class: 'bad' }, h('span', null, 'محاصرهٔ دریایی از ۲۳ تیر ۱۴۰۵ دوباره برقرار است. ریال در شش ماه حدود ', h('b', null, pct(fact('rial_loss'))), ' ارزش از دست داده و تورم به حدود ', h('b', null, pct(fact('inflation'))), ' رسیده است.')),
      h('li', null, h('span', null, 'رکود ساخت‌وساز باعث خروج حدود ', h('b', null, pct(fact('arch_exit'))), ' فعالان رنگ ساختمانی شده و تولید سایپا ', h('b', null, pct(fact('saipa_drop'))), ' افت کرده؛ بازسازی تأسیسات احتمالاً تقاضای رنگ حفاظتی و صنعتی را بالا می‌برد (استنباط).'))
    );

    const scnCards = D.scenarios.map((s) => h('div', { class: 'card scn-card' + (s.id === state.scn ? ' on' : ''), on: { click: () => setScn(s.id) }, style: 'cursor:pointer' },
      h('div', { class: 'rc-top' }, h('h3', null, s.name), h('span', { class: 'tag' }, s.short)),
      h('p', { class: 'small' }, s.definition),
      h('dl', { class: 'kv' },
        h('dt', null, 'محاصره'), h('dd', null, s.blockade),
        h('dt', null, 'پتروشیمی'), h('dd', null, s.petchem),
        h('dt', null, 'گاز زمستانی'), h('dd', null, s.gas),
        h('dt', null, 'ارز'), h('dd', null, s.fx),
        h('dt', null, 'تقاضا'), h('dd', null, s.demand))
    ));

    const chain = D.value_chain.slice().sort((a, b) => a.order - b.order).map((c) => {
      const ga = Number(c.gap_a_score), gb = Number(c.gap_b_score);
      const cl = clsOf(ga, gb);
      const g = state.scn === 'a' ? ga : gb;
      return h('div', { class: 'card link c-' + cl },
        h('div', { class: 'n' }, fa(c.order)),
        h('div', { style: 'display:grid;gap:4px;min-width:0' },
          h('div', { class: 'rc-top' }, h('h3', null, c.name), h('span', { class: 'pill ' + (c.tab ? 's-done' : 's-queue') }, c.status)),
          h('div', { class: 'ex' }, c.examples),
          h('div', { class: 'rc-meta' }, gapPill(g, GAP[g]), clsPill(cl)),
          h('div', { class: 'meta' },
            h('span', null, h('span', { class: 'k' }, 'وابستگی: '), c.dep),
            h('span', null, h('span', { class: 'k' }, 'خرید: '), c.purchase),
            h('span', null, h('span', { class: 'k' }, 'تقاضا: '), c.demand_pattern),
            h('span', null, h('span', { class: 'k' }, 'جذابیت: '), c.attract)),
          h('div', { class: 'small' }, c.note),
          c.tab ? h('div', null, h('button', { type: 'button', class: 'chipbtn', on: { click: () => setView('materials') } }, 'رفتن به مواد اولیه ←')) : null
        ));
    });

    const ptList = PT.map((p) => h('div', { class: 'card row-card', on: { click: () => { state.paint = p.id; setView('materials'); } } },
      h('div', { class: 'rc-top' }, h('span', { class: 'rc-name' }, p.name), h('span', { class: 'pill' }, 'تقاضا: ' + (state.scn === 'a' ? p.demand_a : p.demand_b))),
      h('div', { class: 'rc-sub' }, p.application + ' · ' + p.components + ' · ' + p.base),
      h('div', { class: 'rc-sub' }, 'حجم ' + fa(p.vol_min) + '–' + fa(p.vol_max) + ' هزار تن · ارزش ' + fa(p.value_min) + '–' + fa(p.value_max) + ' میلیون دلار'),
      h('div', { class: 'small muted' }, p.demand_note)
    ));

    v.replaceChildren(
      h('p', { class: 'lead' }, h('b', null, fa(structAll)), ' گروه از ', h('b', null, fa(M.length)), ' ماده اولیه شکاف ساختاری دارند و با عادی‌سازی هم می‌مانند؛ ', h('b', null, fa(countCls('war'))), ' گروه فقط شکاف جنگی دارند. درجه‌ها و حجم‌ها برآورد است، نه آمار رسمی.'),
      h('div', { class: 'kpis' },
        kpi('واحدهای فعال رنگ و رزین', fa(units), 'واحد', 'وزارت صمت، ۱۴۰۴'),
        kpi('تولید سالانه (برآورد)', fa(Math.round(prod8 * 12 / 8)), 'هزار تن', 'سالانه‌شده از ' + fa(prod8) + ' هزار تن در ۸ ماه ۱۴۰۴'),
        kpi('مواد پرحجم وابسته به واردات', fa(hard.length), 'قلم', 'از ' + fa(M.length) + ' گروه بررسی‌شده', { cls: 'alert' }),
        kpi('ارزش تخمینی واردات تیتان', fa(tMin) + '–' + fa(tMax), 'میلیون دلار', 'مصرف × سهم واردات × ' + fa(price) + ' دلار/تن')
      ),
      h('div', { class: 'sec' }, secHead('شوک‌های عرضه در ۱۴۰۵'), h('div', { class: 'card' }, shocks)),
      h('div', { class: 'sec' }, secHead('دو سناریو', 'شکاف ساختاری قبل از جنگ هم بود و با عادی‌سازی می‌ماند؛ شکاف جنگی با برگشت اوضاع کم یا بسته می‌شود. روی هر کارت بزنید تا سناریو عوض شود.'), h('div', { class: 'list' }, scnCards)),
      h('div', { class: 'sec' }, secHead('زنجیرهٔ ارزش', 'همهٔ حلقه‌های وابسته به واردات؛ فعلاً فقط مواد اولیه بررسی شده و بقیه برآورد کیفی‌اند.'), h('div', { class: 'list' }, chain)),
      h('div', { class: 'sec' }, secHead('انواع رنگ و رزین', 'تقاضا در سناریوی ' + SCN_NAME[state.scn] + '. روی هر نوع بزنید تا مواد اولیه‌اش را ببینید.'), h('div', { class: 'list' }, ptList))
    );
  }

  function renderMaterials() {
    const v = $('#v-materials');
    const set = state.paint ? ptSet(state.paint) : null;
    let rows = M.filter((m) => !set || set.has(m.id))
      .filter((m) => !state.cls || m.cls === state.cls);
    const sorters = {
      gap: (a, b) => gapOf(b) - gapOf(a) || b.cons_mid - a.cons_mid,
      cons: (a, b) => b.cons_mid - a.cons_mid,
      dep: (a, b) => b.dep_score - a.dep_score || gapOf(b) - gapOf(a),
      name: (a, b) => a.name.localeCompare(b.name, 'fa')
    };
    rows = rows.sort(sorters[state.sort] || sorters.gap);
    const maxCons = Math.max(...M.map((m) => m.cons_max));

    const paintSel = h('select', { class: 'select', 'aria-label': 'نوع رنگ', on: { change: (e) => { state.paint = e.target.value; renderMaterials(); } } },
      h('option', { value: '' }, 'همهٔ انواع رنگ و رزین'),
      ...[...new Set(PT.map((p) => p.application))].map((g) => h('optgroup', { label: g }, ...PT.filter((p) => p.application === g).map((p) => h('option', { value: p.id }, p.name)))));
    paintSel.value = state.paint;
    const sortSel = h('select', { class: 'select', 'aria-label': 'مرتب‌سازی', on: { change: (e) => { state.sort = e.target.value; renderMaterials(); } } },
      h('option', { value: 'gap' }, 'مرتب: شدت شکاف'), h('option', { value: 'cons' }, 'مرتب: مصرف'), h('option', { value: 'dep' }, 'مرتب: وابستگی'), h('option', { value: 'name' }, 'مرتب: نام'));
    sortSel.value = state.sort;
    const search = h('input', { class: 'input', type: 'search', placeholder: 'جست‌وجوی ماده، گروه یا کد HS', value: state.q, 'aria-label': 'جست‌وجو' });
    search.addEventListener('input', () => { state.q = search.value; drawList(); });

    const tiles = h('div', { class: 'kpis' }, ...['structwar', 'struct', 'war', 'none'].map((c) => {
      const el = kpi(CLS_LABEL[c], fa(countCls(c)), 'گروه', CLS_HINT[c], { cls: 'tap c-' + c + (state.cls === c ? ' on' : ''), attrs: { 'data-cls': c, role: 'button', tabindex: '0' } });
      el.addEventListener('click', () => { state.cls = state.cls === c ? '' : c; renderMaterials(); });
      return el;
    }));

    let summary = null;
    if (state.paint) {
      const p = PT.find((x) => x.id === state.paint);
      summary = h('div', { class: 'card', style: 'border-inline-start:4px solid var(--accent)' },
        h('div', { class: 'rc-sub' }, p.application),
        h('h3', null, p.name),
        h('div', { class: 'rc-sub' }, p.components + ' · ' + p.base),
        h('dl', { class: 'kv' },
          h('dt', null, 'حجم بازار'), h('dd', null, fa(p.vol_min) + '–' + fa(p.vol_max) + ' هزار تن در سال'),
          h('dt', null, 'ارزش بازار'), h('dd', null, fa(p.value_min) + '–' + fa(p.value_max) + ' میلیون دلار'),
          h('dt', null, 'تقاضا (' + SCN_NAME[state.scn] + ')'), h('dd', null, (state.scn === 'a' ? p.demand_a : p.demand_b) + ' — ' + p.demand_note),
          p.missing ? h('dt', null, 'خارج از داشبورد') : null, p.missing ? h('dd', null, p.missing) : null),
        h('div', null, h('button', { type: 'button', class: 'chipbtn', on: { click: () => { state.paint = ''; renderMaterials(); } } }, 'نمایش همهٔ مواد ×')));
    }

    const listBox = h('div', { class: 'list' });
    const countEl = h('div', { class: 'count' });
    function drawList() {
      const qq = state.q.trim().toLowerCase();
      const rr = rows.filter((m) => !qq || [m.name, m.group, m.supply, m.hs, m.role].join(' ').toLowerCase().includes(qq));
      countEl.textContent = fa(rr.length) + ' گروه ماده' + (state.cls ? ' · ' + CLS_LABEL[state.cls] : '');
      listBox.replaceChildren(...rr.map((m) => {
        const g = gapOf(m);
        return h('div', { class: 'card row-card g' + g, role: 'button', tabindex: '0', on: { click: () => openMaterial(m.id) } },
          h('div', { class: 'rc-top' }, h('span', { class: 'rc-name' }, m.name), h('span', { class: 'rc-sub' }, m.group)),
          h('div', { class: 'rc-meta' }, gapPill(g, gapLabel(m)), clsPill(m.cls), h('span', { class: 'pill' }, 'وابستگی ' + m.dep)),
          h('div', { class: 'cons' }, h('div', { class: 'bar g' + g }, h('i', { style: 'width:' + Math.max(3, m.cons_max / maxCons * 100) + '%' })), h('span', null, fa(m.cons_min) + '–' + fa(m.cons_max) + ' هزار تن')),
          h('div', { class: 'rc-sub' }, m.supply)
        );
      }));
      if (!rr.length) listBox.append(h('div', { class: 'empty' }, 'ماده‌ای با این فیلترها پیدا نشد.'));
    }
    v.replaceChildren(...[
      h('div', { class: 'controls' }, paintSel, h('div', { class: 'ctl-row' }, sortSel, search)),
      summary,
      h('div', { class: 'sec' }, secHead('نوع شکاف', 'روی هر کارت بزنید تا فهرست فقط همان نوع را نشان دهد. شمارش‌ها برای کل ۳۹ گروه است.'), tiles),
      h('div', { class: 'sec' }, secHead('مواد اولیه', 'شدت شکاف در سناریوی ' + SCN_NAME[state.scn] + '. روی هر ماده بزنید تا جزئیات، نقش در فرمول و برندهایش باز شود.'), countEl, listBox)
    ].filter(Boolean));
    drawList();
  }

  function renderBrands() {
    const v = $('#v-brands');
    const matSel = h('select', { class: 'select', 'aria-label': 'ماده اولیه', on: { change: (e) => { state.bmat = e.target.value; renderBrands(); } } },
      h('option', { value: '' }, 'همهٔ مواد اولیه'), ...M.slice().sort((a, b) => a.name.localeCompare(b.name, 'fa')).map((m) => h('option', { value: m.id }, m.name)));
    matSel.value = state.bmat;
    const cc = {};
    B.forEach((b) => String(b.country).split('/').forEach((c) => { cc[c] = (cc[c] || 0) + 1; }));
    const ctySel = h('select', { class: 'select', 'aria-label': 'کشور', on: { change: (e) => { state.bcountry = e.target.value; renderBrands(); } } },
      h('option', { value: '' }, 'همهٔ کشورها'), ...Object.keys(cc).sort((a, b) => cc[b] - cc[a]).map((c) => h('option', { value: c }, c)));
    ctySel.value = state.bcountry;
    const evSel = h('select', { class: 'select', 'aria-label': 'شواهد', on: { change: (e) => { state.bev = e.target.value; renderBrands(); } } },
      h('option', { value: '' }, 'همهٔ سطوح شواهد'),
      h('option', { value: 'تأیید در بازار ایران' }, 'تأیید در بازار ایران'),
      h('option', { value: 'تولیدکننده داخلی' }, 'تولیدکنندهٔ داخلی'),
      h('option', { value: 'رایج جهانی؛ حضور در ایران تأییدنشده' }, 'رایج جهانی؛ تأییدنشده'));
    evSel.value = state.bev;
    const search = h('input', { class: 'input', type: 'search', placeholder: 'جست‌وجوی برند، گرید یا شرکت', value: state.bq, 'aria-label': 'جست‌وجو' });

    const base = B.filter((b) => !state.bmat || b.material_id === state.bmat)
      .filter((b) => !state.bcountry || String(b.country).split('/').includes(state.bcountry))
      .filter((b) => !state.bev || b.evidence === state.bev);

    // supply × demand matrix for current scenario
    const mx = h('div', { class: 'mx' }, h('div', { class: 'rh' }, ''), ...SUP.map((s) => h('div', { class: 'h' }, 'عرضه ' + s)));
    DEM.forEach((d) => {
      mx.append(h('div', { class: 'rh' }, 'تقاضا ' + d));
      SUP.forEach((s, i) => {
        const n = base.filter((b) => b.demand === d && supOf(b) === s).length;
        const hot = d === 'بالا';
        const tint = hot && i >= 2 ? 'sig-bad' : hot && i === 1 ? 'sig-warn' : hot ? 'sig-ok' : '';
        const on = state.bsup === s && state.bdem === d;
        mx.append(h('button', { type: 'button', class: tint + (on ? ' on' : ''), disabled: n ? null : true, on: { click: () => { if (on) { state.bsup = ''; state.bdem = ''; } else { state.bsup = s; state.bdem = d; } renderBrands(); } } }, fa(n)));
      });
    });

    const listBox = h('div', { class: 'list' });
    const countEl = h('div', { class: 'count' });
    function drawList() {
      const q = state.bq.trim().toLowerCase();
      const rows = base.filter((b) => !state.bsup || (supOf(b) === state.bsup && b.demand === state.bdem))
        .filter((b) => !q || [b.product, b.brand, b.company, b.country, b.material].join(' ').toLowerCase().includes(q))
        .sort((a, b) => {
          const ma = MAT.get(a.material_id), mb = MAT.get(b.material_id);
          return (gapOf(mb) - gapOf(ma)) || (mb.cons_mid - ma.cons_mid) || a.material.localeCompare(b.material, 'fa');
        });
      countEl.textContent = fa(rows.length) + ' محصول' + (state.bsup ? ' · عرضه ' + state.bsup + ' و تقاضای ' + state.bdem : '');
      listBox.replaceChildren(...rows.map((b) => {
        const s = supOf(b); const sg = signal(b.demand, s);
        return h('div', { class: 'card row-card ' + sigClass(sg) },
          h('div', { class: 'rc-top' }, h('span', { class: 'rc-name ltr' }, b.product), h('span', { class: 'rc-sub' }, b.country)),
          h('div', { class: 'rc-sub ltr', style: 'text-align:right' }, b.brand + (b.company ? ' · ' + b.company : '')),
          h('div', { class: 'rc-sub' }, b.material),
          h('div', { class: 'rc-meta' },
            h('span', { class: 'pill sup' + SUP.indexOf(s) }, 'عرضه ' + s),
            h('span', { class: 'pill' }, 'تقاضا ' + b.demand),
            h('span', { class: 'pill ' + sigClass(sg) }, sg)),
          h('div', { class: 'small muted' }, b.evidence + (b.sd_reason ? ' — ' + b.sd_reason : ''))
        );
      }));
      if (!rows.length) listBox.append(h('div', { class: 'empty' }, 'برندی با این فیلترها پیدا نشد.'));
    }
    search.addEventListener('input', () => { state.bq = search.value; drawList(); });
    const anyFilter = state.bmat || state.bcountry || state.bev || state.bsup || state.bq;
    v.replaceChildren(...[
      h('div', { class: 'controls' }, search, matSel, h('div', { class: 'ctl-row' }, ctySel, evSel),
        anyFilter ? h('div', null, h('button', { type: 'button', class: 'chipbtn', on: { click: () => { Object.assign(state, { bmat: '', bcountry: '', bev: '', bsup: '', bdem: '', bq: '' }); renderBrands(); } } }, 'پاک کردن فیلترها ×')) : null),
      h('div', { class: 'sec' }, secHead('عرضه و تقاضا', 'تعداد محصولات در هر ترکیب، در سناریوی ' + SCN_NAME[state.scn] + '. استنباط، نه دادهٔ بازار. روی هر خانه بزنید تا فهرست فیلتر شود.'), h('div', { class: 'card' }, mx)),
      h('div', { class: 'sec' }, secHead('برندها و گریدها'), countEl, listBox)
    ].filter(Boolean));
    drawList();
  }

  function renderMethod() {
    const v = $('#v-method');
    v.replaceChildren(
      h('div', { class: 'card foot' },
        h('h2', null, 'روش'),
        h('p', null, h('b', null, 'آمار کلان. '), 'تعداد واحدها، تولید، سهم‌ها، قیمت تیتان، ظرفیت کارون و شوک‌های ۱۴۰۵ از منابع منتشرشده است. حجم مصرف هر ماده برآورد است: تولید حدود یک میلیون تن رنگ ضرب در سهم معمول آن ماده در فرمول.'),
        h('p', null, h('b', null, 'سناریوها. '), 'برای هر ماده چهار چیز برآورد شده: وابستگی ساختاری، شدت شکاف در وضع موجود و در عادی‌سازی (کم، متوسط، زیاد، شدید)، و زمان بازگشت تولیدکنندهٔ داخلی آسیب‌دیده. نوع شکاف از مقایسهٔ دو درجه حساب می‌شود: شکاف وضع موجود کم = بدون شکاف؛ شکاف عادی‌سازی کم و وضع موجود بیشتر = فقط جنگی؛ هر دو حداقل متوسط = ساختاری، و اگر وضع موجود بدتر باشد تشدیدشده با جنگ.'),
        h('p', null, h('b', null, 'برندها. '), 'عرضه و تقاضای هر محصول استنباط است (کشور سازنده، ریسک تحریم، تولید داخلی، عمومی یا ویژه بودن گرید). در وضع موجود، عرضهٔ محصولات موادی که شکافشان با جنگ بیشتر شده یک پله سخت‌تر حساب شده است.'),
        h('p', null, h('b', null, 'برای عدد دقیق. '), 'آمار گمرک به تفکیک کد HS، گزارش‌های تولید ماهانهٔ کدال برای وضعیت مجتمع‌ها، یا پرس‌وجو از چند کارخانهٔ رنگ متوسط.')),
      h('div', { class: 'card foot' },
        h('h2', null, 'منابع'),
        h('p', null, 'Tehran Times / وزارت صمت، Mordor Intelligence، IndexBox، Middle East Forum، Hydrocarbon Processing، Iran International، Tehran Times / NPC، Noon Post، Wikipedia (محاصرهٔ دریایی)، رکنا.')),
      h('div', { class: 'card foot install' },
        h('h2', null, 'نصب روی آیفون'),
        h('p', null, 'در Safari دکمهٔ Share را بزنید و «Add to Home Screen» را انتخاب کنید. بعد از اولین باز شدن، برنامه آفلاین هم کار می‌کند.')),
      h('p', { class: 'small muted', style: 'text-align:center' }, 'داده‌ها: ' + D.meta.data_date + ' · نسخهٔ ' + fa(D.meta.version.split('.')[0]) + '.' + fa(D.meta.version.split('.')[1]))
    );
  }

  // ---------- material detail sheet ----------
  const sheet = $('#sheet');
  function openMaterial(id, push) {
    const m = MAT.get(id); if (!m) return;
    $('#sheet-title').textContent = m.name;
    const item = (lab, txt, ltr) => (txt ? h('div', { class: 'item' }, h('span', { class: 'lab' }, lab), h('span', { class: 'txt' + (ltr ? ' ltr' : '') }, txt)) : null);
    const byC = {};
    B.filter((b) => b.material_id === id).forEach((b) => { (byC[b.country] = byC[b.country] || []).push(b.brand); });
    const countries = Object.keys(byC).sort((a, b) => byC[b].length - byC[a].length).map((c) =>
      h('div', { class: 'country' }, h('span', { class: 'c' }, c), h('span', { class: 'ltr', style: 'text-align:right' }, [...new Set(byC[c])].join(' · '))));
    const uses = PT.filter((p) => String(p.materials).split(',').includes(id));
    const body = $('#sheet-body');
    body.replaceChildren(...[
      h('div', { class: 'card', style: 'border-inline-start:4px solid var(--tint)' },
        h('div', { class: 'rc-sub' }, m.group + ' · ' + m.status_label),
        h('div', { class: 'rc-meta' }, clsPill(m.cls), h('span', { class: 'pill' }, 'وابستگی ' + m.dep)),
        h('div', { class: 'cons' }, h('span', null, 'مصرف سالانه تخمینی'), h('b', null, fa(m.cons_min) + '–' + fa(m.cons_max) + ' هزار تن'))),
      h('div', { class: 'sec' }, h('h3', null, 'دو سناریو'),
        h('div', { class: 'card items' },
          h('div', { class: 'rc-meta' }, h('span', { class: 'small muted' }, 'وضع موجود:'), gapPill(m.gap_a_score, m.gap_a), h('span', { class: 'small muted' }, 'عادی‌سازی:'), gapPill(m.gap_b_score, m.gap_b)),
          item('عوامل شکاف در وضع موجود', m.a_drivers),
          item('تولیدکنندهٔ داخلی و وضعیتش', m.dom_status),
          item('زمان بازگشت تولید داخل', m.recovery))),
      h('div', { class: 'sec' }, h('h3', null, 'مشخصات فنی و خرید'),
        h('div', { class: 'card items' },
          item('نقش در فرمول', m.role), item('درصد معمول در فرمول', m.dosage), item('مشخصات کلیدی هنگام خرید', m.specs),
          item('جایگزین‌ها', m.substitutes), item('تأمین در ایران', m.supply), item('کد HS تقریبی (با تعرفهٔ گمرک چک شود)', m.hs, true), item('نکته', m.note))),
      countries.length ? h('div', { class: 'sec' }, h('h3', null, 'برندها بر اساس کشور (' + fa(brandCount(id)) + ')'),
        h('div', { class: 'card countries' }, countries),
        h('div', null, h('button', { type: 'button', class: 'chipbtn', on: { click: () => { closeSheet(); Object.assign(state, { bmat: id, bcountry: '', bev: '', bsup: '', bdem: '', bq: '' }); setView('brands'); } } }, 'دیدن همهٔ محصولات در برندها ←'))) : null,
      uses.length ? h('div', { class: 'sec' }, h('h3', null, 'در این انواع رنگ و رزین'), h('div', { class: 'chipbar' }, uses.map((p) => h('button', { type: 'button', class: 'chipbtn', on: { click: () => { closeSheet(); state.paint = p.id; setView('materials'); } } }, p.name)))) : null
    ].filter(Boolean));
    body.firstChild.classList.add('g' + gapOf(m));
    sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false');
    sheet.scrollTop = 0;
    if (push !== false) try { history.pushState({ sheet: id }, '', '#m-' + id); } catch (e) { /* ignore */ }
  }
  function closeSheet(fromPop) {
    if (!sheet.classList.contains('open')) return;
    sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true');
    if (!fromPop && location.hash.startsWith('#m-')) try { history.back(); } catch (e) { /* ignore */ }
  }
  $('#sheet-back').addEventListener('click', () => closeSheet());
  window.addEventListener('popstate', () => {
    if (location.hash.startsWith('#m-')) openMaterial(location.hash.slice(3), false); else closeSheet(true);
  });

  // ---------- navigation ----------
  const RENDER = { industry: renderIndustry, materials: renderMaterials, brands: renderBrands, method: renderMethod };
  function setView(vw) {
    state.view = vw; store.set('view', vw);
    document.querySelectorAll('.view').forEach((s) => { s.hidden = s.id !== 'v-' + vw; });
    document.querySelectorAll('.tabbar button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.v === vw)));
    RENDER[vw]();
    window.scrollTo(0, 0);
  }
  function setScn(s) {
    state.scn = s; store.set('scn', s);
    document.querySelectorAll('#seg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.s === s)));
    RENDER[state.view]();
    if (sheet.classList.contains('open') && location.hash.startsWith('#m-')) openMaterial(location.hash.slice(3), false);
  }
  document.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.v)));
  document.querySelectorAll('#seg button').forEach((b) => b.addEventListener('click', () => setScn(b.dataset.s)));

  // ---------- start ----------
  document.querySelectorAll('#seg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.s === state.scn)));
  setView(state.view);
  if (location.hash.startsWith('#m-')) openMaterial(location.hash.slice(3), false);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})();
