(() => {
  'use strict';

  /** @type {any[]} */
  let cacheProducts = [];
  /** @type {any[]} */
  let cacheCustomers = [];
  /** @type {any[]} */
  let cacheOrders = [];

  /** @typedef {{entity:string,mode:'create'|'edit',payload?:any}} ModalState */

  /** @type {ModalState|null} */
  let modalState = null;

  const qs = (sel, root = document) => /** @type {HTMLElement} */ (root.querySelector(sel));

  /** @returns {HTMLElement[]} */
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** @type {HTMLElement} */
  const modal = qs('#modal');
  /** @type {HTMLFormElement} */
  const modalForm = qs('#modal-form');
  /** @type {HTMLElement} */
  const modalTitle = qs('#modal-title');
  /** @type {HTMLElement} */
  const toastEl = qs('#toast');

  const SUPABASE_URL = 'https://rhqmzccyvfiitojeqkfr.supabase.co';
  const SUPABASE_REST_BASE = `${SUPABASE_URL}/rest/v1`;
  const SUPABASE_ANON_KEY = 'sb_publishable_EGy6mohkRIoPQt1RErhrRw_jr8FaqRr';

  const nfVnd = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

  function escapeHtml(raw) {
    return String(raw ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(text, opts = {}) {
    const ok = !(opts.isError ?? false);
    toastEl.textContent = text;
    toastEl.style.display = 'block';
    toastEl.classList.toggle('is-error', !ok);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      toastEl.style.display = 'none';
    }, opts.ms ?? 3600);
  }

  function supabaseHeaders(extra = {}) {
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...extra,
    };
  }

  async function supabaseRequest(path, opts = {}) {
    const r = await fetch(`${SUPABASE_REST_BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers: supabaseHeaders({
        ...(opts.body == null ? {} : { 'content-type': 'application/json' }),
        ...(opts.prefer ? { Prefer: opts.prefer } : {}),
      }),
      body: opts.body == null ? undefined : JSON.stringify(opts.body),
    });

    let j = null;
    try {
      j = await r.json();
    } catch {
      j = null;
    }

    if (!r.ok) {
      const msg = String(j?.message ?? j?.hint ?? `${r.status} ${r.statusText}`);
      throw new Error(msg || 'Không đọc được phản hồi Supabase');
    }

    return j;
  }

  function mapOrder(row) {
    const c = row.customers ?? {};
    const p = row.products ?? {};
    return {
      ...row,
      transfer_memo: row.payment_content ?? row.transfer_memo ?? '',
      purchase_date:
        String(row.purchased_at ?? row.purchase_date ?? '').slice(0, 10) || isoLocalToday(),
      customer_name: c.name ?? row.customer_name ?? '',
      customer_phone: c.phone ?? row.customer_phone ?? '',
      product_name: p.name ?? row.product_name ?? '',
      product_price: p.price ?? row.product_price ?? 0,
    };
  }

  function rowFirst(rows) {
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  function parseApiUrl(url) {
    const m = String(url).match(/^\/api\/(products|customers|orders)(?:\/([^/]+))?$/);
    if (!m) return null;
    return { entity: m[1], id: m[2] ? decodeURIComponent(m[2]) : null };
  }

  async function getProductById(id) {
    return rowFirst(
      await supabaseRequest(`/products?id=eq.${encodeURIComponent(String(id))}&select=*&limit=1`)
    );
  }

  async function fetchJson(method, url, payload) {
    const parsed = parseApiUrl(url);
    if (!parsed) {
      const r = await fetch(url, {
      method,
      headers: payload == null ? undefined : { 'content-type': 'application/json' },
      body: payload == null ? undefined : JSON.stringify(payload),
      });

      /** @type {any} */
      let j = null;
      try {
        j = await r.json();
      } catch {
        j = null;
      }

      if (!r.ok || !j || j.ok !== true) {
        const msg = String(j?.error ?? j?.message ?? `${r.status} ${r.statusText}`);
        throw new Error(msg || 'Không đọc được phản hồi máy chủ');
      }

      return j;
    }

    const { entity, id } = parsed;

    if (entity === 'products') {
      if (method === 'GET') {
        const rows = await supabaseRequest('/products?select=*&order=id.asc');
        return { ok: true, data: rows };
      }
      if (method === 'POST') {
        const rows = await supabaseRequest('/products', {
          method: 'POST',
          prefer: 'return=representation',
          body: payload,
        });
        return { ok: true, data: rowFirst(rows) };
      }
      if (method === 'PUT' && id) {
        const rows = await supabaseRequest(`/products?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          prefer: 'return=representation',
          body: payload,
        });
        return { ok: true, data: rowFirst(rows) };
      }
      if (method === 'DELETE' && id) {
        await supabaseRequest(`/products?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          prefer: 'return=minimal',
        });
        return { ok: true };
      }
    }

    if (entity === 'customers') {
      if (method === 'GET') {
        const rows = await supabaseRequest('/customers?select=*&order=id.desc');
        return { ok: true, data: rows };
      }
      if (method === 'POST') {
        const body = {
          name: String(payload?.name ?? ''),
          phone: String(payload?.phone ?? ''),
          zalo: String(payload?.zalo ?? ''),
          email: String(payload?.email ?? ''),
        };
        if (payload?.registered_at) body.registered_at = payload.registered_at;
        const rows = await supabaseRequest('/customers', {
          method: 'POST',
          prefer: 'return=representation',
          body,
        });
        return { ok: true, data: rowFirst(rows) };
      }
      if (method === 'PUT' && id) {
        const rows = await supabaseRequest(`/customers?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          prefer: 'return=representation',
          body: payload,
        });
        return { ok: true, data: rowFirst(rows) };
      }
      if (method === 'DELETE' && id) {
        await supabaseRequest(`/customers?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          prefer: 'return=minimal',
        });
        return { ok: true };
      }
    }

    if (entity === 'orders') {
      if (method === 'GET') {
        const rows = await supabaseRequest(
          '/orders?select=*,customers(name,phone),products(name,price)&order=id.desc'
        );
        return { ok: true, data: rows.map(mapOrder) };
      }
      if (method === 'POST') {
        const product = await getProductById(payload.product_id);
        if (!product) throw new Error('Không tìm thấy sản phẩm');
        const quantity = Math.max(1, Math.floor(Number(payload.quantity) || 1));
        const remaining = Number(product.remaining_quantity) || 0;
        if (remaining < quantity) {
          throw new Error(`Không đủ hàng trong kho (còn ${remaining}, yêu cầu ${quantity})`);
        }

        const paymentContent = String(payload.transfer_memo ?? '').trim() || 'MQL5Coc';
        const purchaseDate = String(payload.purchase_date ?? '').slice(0, 10) || isoLocalToday();
        const status = String(payload.status ?? '').trim() || 'pending';
        const amount = (Number(product.price) || 0) * quantity;
        const rows = await supabaseRequest('/orders', {
          method: 'POST',
          prefer: 'return=representation',
          body: {
            customer_id: payload.customer_id,
            product_id: payload.product_id,
            quantity,
            amount,
            status,
            payment_content: paymentContent,
            purchased_at: `${purchaseDate} 00:00:00`,
          },
        });

        if (status === 'pending' || status === 'success') {
          await supabaseRequest(`/products?id=eq.${encodeURIComponent(String(payload.product_id))}`, {
            method: 'PATCH',
            prefer: 'return=minimal',
            body: { remaining_quantity: remaining - quantity },
          });
        }

        return { ok: true, data: mapOrder(rowFirst(rows) ?? {}) };
      }
      if (method === 'PUT' && id) {
        const body = {
          status: String(payload.status ?? '').trim(),
          payment_content: String(payload.transfer_memo ?? '').trim() || 'MQL5Coc',
          purchased_at: `${String(payload.purchase_date ?? '').slice(0, 10) || isoLocalToday()} 00:00:00`,
          updated_at: new Date().toISOString(),
        };
        const rows = await supabaseRequest(`/orders?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          prefer: 'return=representation',
          body,
        });
        return { ok: true, data: mapOrder(rowFirst(rows) ?? {}) };
      }
      if (method === 'DELETE' && id) {
        await supabaseRequest(`/orders?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          prefer: 'return=minimal',
        });
        return { ok: true };
      }
    }

    throw new Error(`API Supabase chưa hỗ trợ: ${method} ${url}`);
  }

  function toDatetimeLocal(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    // Chuẩn SQLite: `YYYY-MM-DD HH:MM:SS`
    const m = s.includes(' ') ? `${s.slice(0, 10)}T${s.slice(11, 16)}` : s;
    return m.replace(' ', 'T').slice(0, 16);
  }

  /** @param {string} localIso */
  function fromDatetimeLocal(localIso) {
    const v = String(localIso ?? '').trim();
    if (!v) return '';
    // `YYYY-MM-DDTHH:mm` -> `YYYY-MM-DD HH:mm:00`
    const [date, time] = v.includes('T') ? v.split('T') : v.split(' ');
    const hhmm = String(time ?? '').slice(0, 5);
    return `${date} ${hhmm}:00`;
  }

  /** Ngày local YYYY-MM-dd (đồng nhất với input type="date"). */
  function isoLocalToday() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /** Chuẩn hoá click target: click vào nút có thể trúng `#text`, không có .closest(...) */
  function clickHTMLElement(ev) {
    const raw = /** @type {EventTarget|null} */ (ev.target);
    let n =
      raw && 'nodeType' in /** @type {Node} */ (raw) ? /** @type {Node} */ (raw) : null;
    if (!n) return null;
    if (n.nodeType !== Node.ELEMENT_NODE && n.parentElement) n = n.parentElement;
    return n instanceof HTMLElement ? n : null;
  }

  /** @returns {HTMLElement} */
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = String(html).trim();
    /** @type {HTMLElement|null} */
    const node = t.content.firstElementChild;
    if (!node || !(node instanceof HTMLElement)) {
      console.error('[admin] el(): cần chuỗi HTML chứa đúng một phần tử gốc (ví dụ <button>…)');
      throw new Error('admin DOM build');
    }
    return node;
  }

  function badgeClass(status) {
    if (status === 'pending') return 'badge badge-pending';
    if (status === 'success') return 'badge badge-success';
    if (status === 'cancelled') return 'badge badge-cancelled';
    return 'badge';
  }

  function setCounts() {
    qs('#count-products').textContent = String(cacheProducts.length);
    qs('#count-customers').textContent = String(cacheCustomers.length);
    qs('#count-orders').textContent = String(cacheOrders.length);
  }

  function toggleEmpty(which, isEmpty) {
    const tbl = qs(`#table-${which}`);
    const empty = qs(`#empty-${which}`);
    tbl.style.display = isEmpty ? 'none' : 'table';
    empty.style.display = isEmpty ? 'block' : 'none';
  }

  async function confirmDelete(question) {
    return window.confirm(question);
  }

  function renderProducts() {
    const tbl = qs('#table-products');
    const empty = cacheProducts.length === 0;
    toggleEmpty('products', empty);
    if (empty) return;

    tbl.innerHTML = `
      <thead>
        <tr>
          <th>ID</th>
          <th>Tên</th>
          <th>Giá</th>
          <th>Mô tả</th>
          <th>Còn lại</th>
          <th style="width:220px">Thao tác</th>
        </tr>
      </thead>
      <tbody></tbody>`;

    const tbody = qs('tbody', tbl);
    for (const p of cacheProducts) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="mono">${escapeHtml(p.id)}</td>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td class="mono">${escapeHtml(nfVnd.format(Number(p.price) || 0))} ₫</td>
        <td><div class="ellipsis mono" title="${escapeHtml(p.description)}">${escapeHtml(p.description)}</div></td>
        <td class="mono">${escapeHtml(p.remaining_quantity)}</td>
        <td></td>`;

      /** @type {HTMLElement} */
      const cell = qs('td:last-child', row);
      cell.appendChild(
        el(`<button type="button" class="btn btn-text js-edit-product" data-id="${escapeHtml(
          String(p.id)
        )}">Sửa</button>`)
      );
      cell.appendChild(
        el(`<button type="button" class="btn btn-danger js-del-product" data-id="${escapeHtml(
          String(p.id)
        )}">Xóa</button>`)
      );

      tbody.appendChild(row);
    }
  }

  function renderCustomers() {
    const tbl = qs('#table-customers');
    const empty = cacheCustomers.length === 0;
    toggleEmpty('customers', empty);
    if (empty) return;

    tbl.innerHTML = `
      <thead>
        <tr>
          <th>ID</th>
          <th>Tên</th>
          <th>Điện thoại</th>
          <th>Zalo</th>
          <th>Email</th>
          <th>Đăng ký lúc</th>
          <th style="width:220px">Thao tác</th>
        </tr>
      </thead>
      <tbody></tbody>`;

    const tbody = qs('tbody', tbl);
    for (const c of cacheCustomers) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="mono">${escapeHtml(c.id)}</td>
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td class="mono">${escapeHtml(c.phone)}</td>
        <td class="mono">${escapeHtml(c.zalo)}</td>
        <td class="mono">${escapeHtml(c.email)}</td>
        <td class="mono">${escapeHtml(c.registered_at)}</td>
        <td></td>`;

      /** @type {HTMLElement} */
      const cell = qs('td:last-child', row);
      cell.appendChild(
        el(`<button type="button" class="btn btn-text js-edit-customer" data-id="${escapeHtml(
          String(c.id)
        )}">Sửa</button>`)
      );
      cell.appendChild(
        el(`<button type="button" class="btn btn-danger js-del-customer" data-id="${escapeHtml(
          String(c.id)
        )}">Xóa</button>`)
      );

      tbody.appendChild(row);
    }
  }

  function renderOrders() {
    const tbl = qs('#table-orders');
    const empty = cacheOrders.length === 0;
    toggleEmpty('orders', empty);
    if (empty) return;

    tbl.innerHTML = `
      <thead>
        <tr>
          <th>ID</th>
          <th>Khách</th>
          <th>Sản phẩm</th>
          <th>SL</th>
          <th>Nội dung CK</th>
          <th>Ngày mua</th>
          <th>TT</th>
          <th>Tạo lúc</th>
          <th style="width:200px">Thao tác</th>
        </tr>
      </thead>
      <tbody></tbody>`;

    const tbody = qs('tbody', tbl);
    for (const o of cacheOrders) {
      const row = document.createElement('tr');
      const customerLine = `${String(o.customer_name ?? '')} • ${String(o.customer_phone ?? '')}`.trim();
      const productLine = `${String(o.product_name ?? '')}`.trim();
      row.innerHTML = `
        <td class="mono">${escapeHtml(o.id)}</td>
        <td><div class="ellipsis" title="${escapeHtml(customerLine)}">${escapeHtml(customerLine)}</div></td>
        <td><div class="ellipsis" title="${escapeHtml(productLine)}">${escapeHtml(productLine)}</div></td>
        <td class="mono">${escapeHtml(o.quantity)}</td>
        <td><div class="ellipsis mono" title="${escapeHtml(String(o.transfer_memo ?? ''))}">${escapeHtml(
        String(o.transfer_memo ?? '')
      )}</div></td>
        <td class="mono">${escapeHtml(String(o.purchase_date ?? '').slice(0, 10))}</td>
        <td><span class="${badgeClass(o.status)}">${escapeHtml(o.status)}</span></td>
        <td class="mono">${escapeHtml(o.created_at)}</td>
        <td></td>`;

      /** @type {HTMLElement} */
      const cell = qs('td:last-child', row);
      cell.appendChild(
        el(`<button type="button" class="btn btn-text js-edit-order" data-id="${escapeHtml(
          String(o.id)
        )}">Sửa đơn</button>`)
      );
      cell.appendChild(
        el(`<button type="button" class="btn btn-danger js-del-order" data-id="${escapeHtml(
          String(o.id)
        )}">Xóa</button>`)
      );

      tbody.appendChild(row);
    }
  }

  function renderAll() {
    setCounts();
    renderProducts();
    renderCustomers();
    renderOrders();
  }

  async function reloadAll() {
    const [p, c, o] = await Promise.all([
      fetchJson('GET', '/api/products'),
      fetchJson('GET', '/api/customers'),
      fetchJson('GET', '/api/orders'),
    ]);
    cacheProducts = p.data ?? [];
    cacheCustomers = c.data ?? [];
    cacheOrders = o.data ?? [];
    renderAll();
  }

  function openModal() {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    modalState = null;
    modalForm.innerHTML = '';
    modalForm.className = 'modal-body';
  }

  function buildProductForm(mode, payload) {
    modalTitle.textContent = mode === 'create' ? 'Thêm sản phẩm' : 'Sửa sản phẩm';
    modalForm.className = 'modal-body';

    const p = payload ?? {};
    modalForm.innerHTML = `
      <div class="field field-span-2">
        <label for="f_name">Tên</label>
        <input id="f_name" name="name" required value="${escapeHtml(p.name ?? '')}" />
      </div>
      <div class="field">
        <label for="f_price">Giá (VND)</label>
        <input id="f_price" name="price" type="number" step="0.01" min="0" value="${escapeHtml(
          String(p.price ?? 0)
        )}" />
      </div>
      <div class="field">
        <label for="f_remaining_quantity">Còn lại</label>
        <input id="f_remaining_quantity" name="remaining_quantity" type="number" step="1" min="0" value="${escapeHtml(
          String(p.remaining_quantity ?? 0)
        )}" />
      </div>
      <div class="field field-span-2">
        <label for="f_description">Mô tả</label>
        <textarea id="f_description" name="description">${escapeHtml(p.description ?? '')}</textarea>
      </div>
    `;
  }

  function buildCustomerForm(mode, payload) {
    modalTitle.textContent = mode === 'create' ? 'Thêm khách hàng' : 'Sửa khách hàng';
    modalForm.className = 'modal-body';

    const c = payload ?? {};
    const reg = toDatetimeLocal(c.registered_at);

    modalForm.innerHTML = `
      <div class="field field-span-2">
        <label for="f_cname">Tên</label>
        <input id="f_cname" name="name" required value="${escapeHtml(c.name ?? '')}" />
      </div>
      <div class="field">
        <label for="f_phone">Điện thoại</label>
        <input id="f_phone" name="phone" value="${escapeHtml(c.phone ?? '')}" />
      </div>
      <div class="field">
        <label for="f_zalo">Zalo</label>
        <input id="f_zalo" name="zalo" value="${escapeHtml(c.zalo ?? '')}" />
      </div>
      <div class="field field-span-2">
        <label for="f_email">Email</label>
        <input id="f_email" name="email" type="email" value="${escapeHtml(c.email ?? '')}" />
      </div>
      <div class="field field-span-2">
        <label for="f_registered_at">Đăng ký lúc</label>
        <input id="f_registered_at" name="registered_at" type="datetime-local" value="${escapeHtml(
          reg
        )}" />
        <div class="form-footnote">Lưu ý: với bản ghi mới, để trống để dùng thời gian hiện tại của máy chủ.</div>
      </div>
    `;
  }

  function buildOrderCreateForm() {
    modalTitle.textContent = 'Thêm đơn hàng';
    modalForm.className = 'modal-body cols-1';

    const customerOptions = cacheCustomers
      .map(
        (c) =>
          `<option value="${escapeHtml(String(c.id))}">${escapeHtml(
            `#${c.id} — ${c.name} — ${c.phone}`
          )}</option>`
      )
      .join('');

    const productOptions = cacheProducts
      .map(
        (p) =>
          `<option value="${escapeHtml(String(p.id))}">${escapeHtml(
            `#${p.id} — ${p.name} — còn ${p.remaining_quantity}`
          )}</option>`
      )
      .join('');

    modalForm.innerHTML = `
      <div class="field">
        <label for="f_customer_id">Khách hàng</label>
        <select id="f_customer_id" name="customer_id" required>${customerOptions}</select>
      </div>
      <div class="field">
        <label for="f_product_id">Sản phẩm</label>
        <select id="f_product_id" name="product_id" required>${productOptions}</select>
      </div>
      <div class="field">
        <label for="f_qty">Số lượng</label>
        <input id="f_qty" name="quantity" type="number" min="1" step="1" value="1" required />
      </div>
      <div class="field">
        <label for="f_transfer_memo">Nội dung chuyển khoản</label>
        <input id="f_transfer_memo" name="transfer_memo" maxlength="240" value="MQL5Coc" />
        <div class="form-footnote" style="margin-top: 4px">Ví dụ cho cọc: <strong>MQL5Coc</strong> (+ mã đơn nếu cần).</div>
      </div>
      <div class="field">
        <label for="f_purchase_date">Ngày mua</label>
        <input id="f_purchase_date" name="purchase_date" type="date" value="${escapeHtml(isoLocalToday())}" required />
      </div>
      <div class="field">
        <label for="f_ostatus">Trạng thái</label>
        <select id="f_ostatus" name="status">
          <option value="" selected>pending (mặc định)</option>
          <option value="pending">pending</option>
          <option value="success">success</option>
          <option value="cancelled">cancelled</option>
        </select>
      </div>
      <div class="form-footnote">
        Khi tạo đơn, hệ thống sẽ trừ <strong>remaining_quantity</strong> theo số lượng nếu đủ hàng.
      </div>
    `;
  }

  function buildOrderEditForm(payload) {
    modalTitle.textContent = 'Sửa đơn hàng';
    modalForm.className = 'modal-body cols-1';

    const line = `#${payload.id} — ${payload.customer_name ?? ''} — ${payload.product_name ?? ''}`;
    const pd =
      typeof payload.purchase_date === 'string' && payload.purchase_date.length >= 10
        ? payload.purchase_date.slice(0, 10)
        : isoLocalToday();
    modalForm.innerHTML = `
      <div class="form-footnote" style="margin-top:0">${escapeHtml(line)}</div>
      <div class="field">
        <label for="f_transfer_edit">Nội dung chuyển khoản</label>
        <input id="f_transfer_edit" name="transfer_memo" maxlength="240" value="${escapeHtml(String(payload.transfer_memo ?? 'MQL5Coc'))}" />
      </div>
      <div class="field">
        <label for="f_purchase_edit">Ngày mua</label>
        <input id="f_purchase_edit" name="purchase_date" type="date" required value="${escapeHtml(pd)}" />
      </div>
      <div class="field">
        <label for="f_status_edit">Trạng thái</label>
        <select id="f_status_edit" name="status" required>
          <option value="pending"${payload.status === 'pending' ? ' selected' : ''}>pending</option>
          <option value="success"${payload.status === 'success' ? ' selected' : ''}>success</option>
          <option value="cancelled"${payload.status === 'cancelled' ? ' selected' : ''}>cancelled</option>
        </select>
      </div>
      <input type="hidden" name="__order_id" value="${escapeHtml(String(payload.id))}" />
    `;
  }

  function onOpenModalFromButton(btn) {
    /** @type {HTMLElement} */
    const b = btn;
    const entity = String(b.dataset.entity ?? '');
    const mode = /** @type any */ (String(b.dataset.mode ?? 'create'));

    if (entity === 'product') {
      modalState = { entity: 'product', mode };
      buildProductForm('create');
      openModal();
      return;
    }
    if (entity === 'customer') {
      modalState = { entity: 'customer', mode };
      buildCustomerForm('create');
      openModal();
      return;
    }
    if (entity === 'order') {
      if (cacheCustomers.length === 0 || cacheProducts.length === 0) {
        showToast('Cần có ít nhất 1 khách và 1 sản phẩm để tạo đơn.', { isError: true });
        return;
      }
      modalState = { entity: 'order', mode: 'create' };
      buildOrderCreateForm();
      openModal();
    }
  }

  /** @returns {HTMLElement|null} */
  function nearestBtn(target, selector) {
    return target.closest(selector);
  }

  document.addEventListener('click', (e) => {
    const t = clickHTMLElement(e);
    if (!t) return;
    const closeHit = nearestBtn(t, '[data-close-modal]');
    if (closeHit) {
      closeModal();
      return;
    }

    const tab = nearestBtn(t, '.tab[data-tab]');
    if (tab) {
      const key = /** @type {HTMLElement} */ (tab).dataset.tab;
      activateTab(key);
      return;
    }

    const open = nearestBtn(t, '.js-open-modal');
    if (open) {
      onOpenModalFromButton(open);
      return;
    }

    const ep = nearestBtn(t, '.js-edit-product');
    if (ep) {
      const id = Number(/** @type {HTMLElement} */ (ep).dataset.id);
      const row = cacheProducts.find((x) => Number(x.id) === id);
      if (!row) return;
      modalState = { entity: 'product', mode: 'edit', payload: row };
      buildProductForm('edit', row);
      openModal();
      return;
    }

    const ec = nearestBtn(t, '.js-edit-customer');
    if (ec) {
      const id = Number(/** @type {HTMLElement} */ (ec).dataset.id);
      const row = cacheCustomers.find((x) => Number(x.id) === id);
      if (!row) return;
      modalState = { entity: 'customer', mode: 'edit', payload: row };
      buildCustomerForm('edit', row);
      openModal();
      return;
    }

    const eo = nearestBtn(t, '.js-edit-order');
    if (eo) {
      const id = Number(/** @type {HTMLElement} */ (eo).dataset.id);
      const row = cacheOrders.find((x) => Number(x.id) === id);
      if (!row) return;
      modalState = { entity: 'order', mode: 'edit', payload: row };
      buildOrderEditForm(row);
      openModal();
      return;
    }

    const dp = nearestBtn(t, '.js-del-product');
    if (dp) {
      const id = Number(/** @type {HTMLElement} */ (dp).dataset.id);
      void (async () => {
        if (!(await confirmDelete(`Xóa sản phẩm #${id}?`))) return;
        try {
          await fetchJson('DELETE', `/api/products/${encodeURIComponent(String(id))}`);
          showToast('Đã xóa sản phẩm');
          await reloadAll();
        } catch (err) {
          showToast(String(err.message || err), { isError: true });
        }
      })();
      return;
    }

    const dc = nearestBtn(t, '.js-del-customer');
    if (dc) {
      const id = Number(/** @type {HTMLElement} */ (dc).dataset.id);
      void (async () => {
        if (!(await confirmDelete(`Xóa khách hàng #${id}?`))) return;
        try {
          await fetchJson('DELETE', `/api/customers/${encodeURIComponent(String(id))}`);
          showToast('Đã xóa khách hàng');
          await reloadAll();
        } catch (err) {
          showToast(String(err.message || err), { isError: true });
        }
      })();
      return;
    }

    const dord = nearestBtn(t, '.js-del-order');
    if (dord) {
      const id = Number(/** @type {HTMLElement} */ (dord).dataset.id);
      void (async () => {
        if (!(await confirmDelete(`Xóa đơn #${id}?`))) return;
        try {
          await fetchJson('DELETE', `/api/orders/${encodeURIComponent(String(id))}`);
          showToast('Đã xóa đơn (kho không tự hoàn lại trong MVP)');
          await reloadAll();
        } catch (err) {
          showToast(String(err.message || err), { isError: true });
        }
      })();
      return;
    }
  });

  /** @param {string|undefined} key */
  function activateTab(key) {
    if (!key) return;

    qsa('.tab').forEach((b) => {
      const is = /** @type {HTMLElement} */ (b).dataset.tab === key;
      /** @type {HTMLButtonElement} */ (/** @type {any} */ (b)).classList.toggle('is-active', is);
      /** @type {HTMLButtonElement} */ (/** @type {any} */ (b)).setAttribute('aria-selected', is ? 'true' : 'false');
    });

    qsa('[role="tabpanel"]').forEach((p) => {
      const pid = /** @type {HTMLElement} */ (p).id;
      const match =
        (key === 'products' && pid === 'panel-products') ||
        (key === 'customers' && pid === 'panel-customers') ||
        (key === 'orders' && pid === 'panel-orders');
      /** @type {HTMLElement} */ (p).toggleAttribute('hidden', !match);
      /** @type {HTMLElement} */ (p).classList.toggle('is-active', match);
    });
  }

  modalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    void (async () => {
      try {
        if (!modalState) return;

        if (modalState.entity === 'product') {
          const fd = new FormData(modalForm);
          const payload = {
            name: String(fd.get('name') ?? ''),
            price: Number(fd.get('price') ?? 0),
            description: String(fd.get('description') ?? ''),
            remaining_quantity: Number(fd.get('remaining_quantity') ?? 0),
          };

          if (modalState.mode === 'create') {
            await fetchJson('POST', '/api/products', payload);
            showToast('Đã thêm sản phẩm');
          } else {
            const id = Number(modalState.payload.id);
            await fetchJson('PUT', `/api/products/${encodeURIComponent(String(id))}`, payload);
            showToast('Đã cập nhật sản phẩm');
          }
        }

        if (modalState.entity === 'customer') {
          const fd = new FormData(modalForm);
          const regLocal = String(fd.get('registered_at') ?? '').trim();
          const payload = {
            name: String(fd.get('name') ?? ''),
            phone: String(fd.get('phone') ?? ''),
            zalo: String(fd.get('zalo') ?? ''),
            email: String(fd.get('email') ?? ''),
          };

          if (regLocal) payload.registered_at = fromDatetimeLocal(regLocal);

          if (modalState.mode === 'create') {
            await fetchJson('POST', '/api/customers', payload);
            showToast('Đã thêm khách hàng');
          } else {
            const id = Number(modalState.payload.id);
            // Khi sửa, registered_at bắt buộc phải có giá trị hợp lệ (NOT NULL)
            if (!regLocal) {
              showToast('Vui lòng chọn thời gian đăng ký khi sửa khách hàng.', { isError: true });
              return;
            }
            await fetchJson('PUT', `/api/customers/${encodeURIComponent(String(id))}`, {
              ...payload,
              registered_at: fromDatetimeLocal(regLocal),
            });
            showToast('Đã cập nhật khách hàng');
          }
        }

        if (modalState.entity === 'order') {
          if (modalState.mode === 'create') {
            const fd = new FormData(modalForm);
            const statusRaw = String(fd.get('status') ?? '').trim();
            const customerId = Number(fd.get('customer_id'));
            const productId = Number(fd.get('product_id'));
            const quantity = Number(fd.get('quantity') ?? 1);
            if (!Number.isFinite(customerId) || customerId <= 0) {
              showToast('Vui lòng chọn khách hàng hợp lệ.', { isError: true });
              return;
            }
            if (!Number.isFinite(productId) || productId <= 0) {
              showToast('Vui lòng chọn sản phẩm hợp lệ.', { isError: true });
              return;
            }
            if (!Number.isFinite(quantity) || quantity < 1) {
              showToast('Số lượng đơn hàng không hợp lệ.', { isError: true });
              return;
            }
            const payload = {
              customer_id: customerId,
              product_id: productId,
              quantity,
              transfer_memo: String(fd.get('transfer_memo') ?? ''),
              purchase_date: String(fd.get('purchase_date') ?? '').slice(0, 10),
            };
            if (statusRaw) payload.status = statusRaw;
            await fetchJson('POST', '/api/orders', payload);
            showToast('Đã tạo đơn và trừ kho (nếu đủ hàng)');
          } else {
            const fd = new FormData(modalForm);
            const id = Number(String(fd.get('__order_id') ?? ''));
            const status = String(fd.get('status') ?? '').trim();
            const transfer_memo = String(fd.get('transfer_memo') ?? '');
            const purchase_date = String(fd.get('purchase_date') ?? '').slice(0, 10);
            await fetchJson('PUT', `/api/orders/${encodeURIComponent(String(id))}`, {
              status,
              transfer_memo,
              purchase_date,
            });
            showToast('Đã cập nhật đơn hàng');
          }
        }

        closeModal();
        await reloadAll();
      } catch (err) {
        showToast(String(err.message || err), { isError: true });
      }
    })();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  void reloadAll().catch((err) => {
    showToast(String(err.message || err), { isError: true });
  });
})();
