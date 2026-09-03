/* ═══════════════════════════════════════════════════════════
   COMMS CARD — Frontend Logic
   Formulário interativo de comissões com cálculo dinâmico
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Config ───
  // window.API_URL é definido em config.js (gerado pelo entrypoint Docker).
  // Quando vazio, usa paths relativos — nginx faz proxy para o backend.
  const API_URL = (window.API_URL != null) ? window.API_URL : '';

  // ─── Multi-select config ───
  const MULTI_CATEGORIA = 'design de personagem';
  const MULTI_MIN = 3;
  const MULTI_MAX = 5;

  // ─── State ───
  let comissoes = { bases: [], adicionais: [] };
  let selectedCategoria = null;
  let selectedBase = null;          // single-select categories
  let selectedBaseQtds = new Map(); // multi-select: id → quantity
  let selectedAdicionais = new Set();

  // ─── DOM refs ───
  const priceTable    = document.getElementById('price-table');
  const extrasList    = document.getElementById('extras-list');
  const totalValue    = document.getElementById('total-value');
  const summaryItems  = document.getElementById('summary-items');
  const submitBtn     = document.getElementById('submit-btn');
  const form          = document.getElementById('commission-form');
  const modalOverlay  = document.getElementById('modal-overlay');
  const modalClose    = document.getElementById('modal-close');
  const modalEl       = document.getElementById('modal');
  const modalIcon     = document.getElementById('modal-icon');
  const modalTitle    = document.getElementById('modal-title');
  const modalText     = document.getElementById('modal-text');

  // ═══════════════════════════════════════
  // INIT — fetch data or use fallback
  // ═══════════════════════════════════════
  async function init() {
    try {
      const res = await fetch(`${API_URL}/api/comissoes`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      comissoes = await res.json();
    } catch (err) {
      console.warn('[comms-card] API indisponível, usando dados locais:', err.message);
      comissoes = fallbackData();
    }

    // Backward compat: if API returns old format without categoria, tag all as 'arte padrão'
    if (comissoes.bases.length && !comissoes.bases[0].categoria) {
      comissoes.bases.forEach(b => { b.categoria = 'arte padrão'; });
    }

    const categorias = [...new Set(comissoes.bases.map(b => b.categoria))];
    selectedCategoria = categorias[0] || null;

    renderCategoriaTabs();
    renderPriceTable();
    renderExtras();
    updateSummary();
  }

  // Dados estáticos caso o backend não esteja disponível
  function fallbackData() {
    return {
      bases: [
        // arte padrão
        { id: 1,  categoria: 'arte padrão',          tipo: '1/2 corpo', estilo: 'sketch',   preco: 15 },
        { id: 2,  categoria: 'arte padrão',          tipo: '1/2 corpo', estilo: 'p&b',      preco: 25 },
        { id: 3,  categoria: 'arte padrão',          tipo: '1/2 corpo', estilo: 'colorido', preco: 45 },
        { id: 4,  categoria: 'arte padrão',          tipo: 'full body', estilo: 'sketch',   preco: 20 },
        { id: 5,  categoria: 'arte padrão',          tipo: 'full body', estilo: 'p&b',      preco: 35 },
        { id: 6,  categoria: 'arte padrão',          tipo: 'full body', estilo: 'colorido', preco: 55 },
        // design de personagem
        { id: 7,  categoria: 'icon', tipo: '',          estilo: 'sketch',   preco: 10 },
        { id: 8,  categoria: 'icon', tipo: '',          estilo: 'p&b',      preco: 15 },
        { id: 9,  categoria: 'icon', tipo: '',          estilo: 'colorido', preco: 25 },
        // tipo 3
        { id: 10, categoria: 'design de personagem',               tipo: 'icon',      estilo: 'sketch',   preco: 6  },
        { id: 11, categoria: 'design de personagem',               tipo: 'icon',      estilo: 'p&b',      preco: 8  },
        { id: 12, categoria: 'design de personagem',               tipo: 'icon',      estilo: 'colorido', preco: 15 },
        { id: 13, categoria: 'design de personagem',               tipo: '1/2 corpo', estilo: 'sketch',   preco: 8  },
        { id: 14, categoria: 'design de personagem',               tipo: '1/2 corpo', estilo: 'p&b',      preco: 15 },
        { id: 15, categoria: 'design de personagem',               tipo: '1/2 corpo', estilo: 'colorido', preco: 20 },
        { id: 16, categoria: 'design de personagem',               tipo: 'full body', estilo: 'sketch',   preco: 10 },
        { id: 17, categoria: 'design de personagem',               tipo: 'full body', estilo: 'p&b',      preco: 20 },
        { id: 18, categoria: 'design de personagem',               tipo: 'full body', estilo: 'colorido', preco: 30 },
        // tipo 4
        { id: 19, categoria: 'chibi',               tipo: '1/2 corpo', estilo: 'sketch',   preco: 10 },
        { id: 20, categoria: 'chibi',               tipo: '1/2 corpo', estilo: 'p&b',      preco: 15 },
        { id: 21, categoria: 'chibi',               tipo: '1/2 corpo', estilo: 'colorido', preco: 25 },
        { id: 22, categoria: 'chibi',               tipo: 'full body', estilo: 'sketch',   preco: 12 },
        { id: 23, categoria: 'chibi',               tipo: 'full body', estilo: 'p&b',      preco: 25 },
        { id: 24, categoria: 'chibi',               tipo: 'full body', estilo: 'colorido', preco: 35 },
      ],
      adicionais: [
        { id: 25, nome: 'Render detalhada',    descricao: 'Acabamento com mais detalhes', preco: 15 },
        { id: 26, nome: 'Fundo simples',       descricao: 'Fundo com cor ou gradiente',  preco: 10 },
        { id: 27, nome: 'Fundo detalhado',     descricao: 'Fundo com cenário ilustrado',  preco: 25 },
        { id: 28, nome: 'Personagem adicional',descricao: '+1 personagem na arte',        preco: 30 },
      ],
    };
  }

  // ═══════════════════════════════════════
  // CATEGORY TABS
  // ═══════════════════════════════════════
  function renderCategoriaTabs() {
    const categorias = [...new Set(comissoes.bases.map(b => b.categoria))];

    let html = '<div class="category-tabs" role="tablist" aria-label="Categorias de comissão">';
    categorias.forEach((cat, i) => {
      html += `<button type="button" class="cat-tab${i === 0 ? ' active' : ''}"
                 role="tab"
                 aria-selected="${i === 0 ? 'true' : 'false'}"
                 data-cat="${escHtml(cat)}">${escHtml(cat)}</button>`;
    });
    html += '</div>';

    priceTable.insertAdjacentHTML('beforebegin', html);

    document.querySelectorAll('.cat-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.cat-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        selectedCategoria = tab.dataset.cat;
        selectedBase = null;
        selectedBaseQtds.clear();
        priceTable.classList.remove('invalid');
        clearError('error-base');
        renderPriceTable();
        updateSummary();
      });
    });
  }

  // ═══════════════════════════════════════
  // PRICE TABLE — interactive grid
  // ═══════════════════════════════════════
  function getTotalQty() {
    let t = 0;
    selectedBaseQtds.forEach(q => { t += q; });
    return t;
  }

  function renderPriceTable() {
    const isMulti     = selectedCategoria === MULTI_CATEGORIA;
    const basesAtivas = comissoes.bases.filter(b => b.categoria === selectedCategoria);
    const tipos       = [...new Set(basesAtivas.map(b => b.tipo))];
    const estilos     = [...new Set(basesAtivas.map(b => b.estilo))];

    priceTable.style.setProperty('--cols', estilos.length);

    let html = '';

    // Counter bar for multi-select
    if (isMulti) {
      const qty = getTotalQty();
      html += `<div class="qty-counter" id="qty-counter">
        <span id="qty-total">${qty}</span>/${MULTI_MAX} selecionados
        <span class="qty-counter-hint">(mín. ${MULTI_MIN})</span>
      </div>`;
    }

    // Header row
    html += '<div class="price-table-head">';
    html += '  <span>tipo</span>';
    estilos.forEach(e => { html += `<span>${escHtml(e)}</span>`; });
    html += '</div>';

    // Data rows
    tipos.forEach(tipo => {
      html += '<div class="price-table-row">';
      html += `<div class="ptr-label">${escHtml(tipo)}</div>`;

      estilos.forEach(estilo => {
        const item = basesAtivas.find(b => b.tipo === tipo && b.estilo === estilo);
        if (item) {
          if (isMulti) {
            const qty = selectedBaseQtds.get(item.id) || 0;
            html += `
              <div class="price-cell price-cell--multi${qty > 0 ? ' has-qty' : ''}">
                <button type="button" class="qty-btn qty-minus" data-id="${item.id}" aria-label="remover">−</button>
                <div class="qty-display">
                  <span class="qty-count">${qty}</span>
                  <span class="qty-price-label">R$${item.preco}</span>
                </div>
                <button type="button" class="qty-btn qty-plus" data-id="${item.id}" aria-label="adicionar">+</button>
              </div>`;
          } else {
            html += `
              <div class="price-cell">
                <input type="radio" name="base-comissao" id="base-${item.id}"
                       value="${item.id}" data-preco="${item.preco}">
                <label for="base-${item.id}">R$${item.preco}</label>
              </div>`;
          }
        } else {
          html += '<div class="price-cell"><span>—</span></div>';
        }
      });

      html += '</div>';
    });

    priceTable.innerHTML = html;

    if (isMulti) {
      priceTable.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id  = parseInt(btn.dataset.id);
          const cur = selectedBaseQtds.get(id) || 0;

          if (btn.classList.contains('qty-plus')) {
            if (getTotalQty() < MULTI_MAX) selectedBaseQtds.set(id, cur + 1);
          } else {
            if (cur > 1) selectedBaseQtds.set(id, cur - 1);
            else if (cur === 1) selectedBaseQtds.delete(id);
          }

          // Update cell UI in-place
          const cell   = btn.closest('.price-cell--multi');
          const newQty = selectedBaseQtds.get(id) || 0;
          cell.querySelector('.qty-count').textContent = newQty;
          cell.classList.toggle('has-qty', newQty > 0);

          // Update counter bar
          const totalEl = document.getElementById('qty-total');
          if (totalEl) totalEl.textContent = getTotalQty();

          priceTable.classList.remove('invalid');
          clearError('error-base');
          updateSummary();
        });
      });
    } else {
      priceTable.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', e => {
          selectedBase = comissoes.bases.find(b => b.id === parseInt(e.target.value));
          priceTable.classList.remove('invalid');
          clearError('error-base');
          updateSummary();
        });
      });
    }
  }

  // ═══════════════════════════════════════
  // EXTRAS — checkbox list
  // ═══════════════════════════════════════
  function renderExtras() {
    if (!comissoes.adicionais.length) {
      extrasList.innerHTML = '<p class="form-block-hint">nenhum adicional disponível</p>';
      return;
    }

    let html = '';

    comissoes.adicionais.forEach(item => {
      html += `
        <div class="extra-item" data-id="${item.id}" tabindex="0" role="checkbox" aria-checked="false">
          <input type="checkbox" id="extra-${item.id}" value="${item.id}" tabindex="-1">
          <div class="extra-check">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div class="extra-info">
            <div class="extra-name">${escHtml(item.nome)}</div>
            <div class="extra-desc">${escHtml(item.descricao)}</div>
          </div>
          <div class="extra-price">+R$${item.preco}</div>
        </div>`;
    });

    extrasList.innerHTML = html;

    // Event listeners — click anywhere on the item to toggle
    extrasList.querySelectorAll('.extra-item').forEach(item => {
      const toggle = () => {
        const cb = item.querySelector('input[type="checkbox"]');
        cb.checked = !cb.checked;
        const id = parseInt(cb.value);

        if (cb.checked) {
          selectedAdicionais.add(id);
          item.classList.add('selected');
          item.setAttribute('aria-checked', 'true');
        } else {
          selectedAdicionais.delete(id);
          item.classList.remove('selected');
          item.setAttribute('aria-checked', 'false');
        }

        updateSummary();
      };

      item.addEventListener('click', e => {
        if (e.target.tagName === 'INPUT') return;
        toggle();
      });

      // Keyboard accessibility
      item.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggle();
        }
      });
    });
  }

  // ═══════════════════════════════════════
  // TOTAL + SUMMARY
  // ═══════════════════════════════════════
  function calculateTotal() {
    let total = 0;
    if (selectedCategoria === MULTI_CATEGORIA) {
      selectedBaseQtds.forEach((qty, id) => {
        const item = comissoes.bases.find(b => b.id === id);
        if (item) total += item.preco * qty;
      });
    } else {
      if (selectedBase) total += selectedBase.preco;
    }
    selectedAdicionais.forEach(id => {
      const item = comissoes.adicionais.find(a => a.id === id);
      if (item) total += item.preco;
    });
    return total;
  }

  function updateSummary() {
    const total = calculateTotal();

    // Update total display
    totalValue.textContent = formatCurrency(total);
    totalValue.classList.remove('bump');
    void totalValue.offsetWidth; // trigger reflow
    totalValue.classList.add('bump');

    // Update summary tags
    let tags = '';

    if (selectedCategoria === MULTI_CATEGORIA) {
      selectedBaseQtds.forEach((qty, id) => {
        const item = comissoes.bases.find(b => b.id === id);
        if (item) {
          const label = [item.tipo, item.estilo].filter(Boolean).join(' ');
          tags += `<span class="summary-tag">${qty}× ${escHtml(label)}
            <span class="tag-price">R$${item.preco * qty}</span></span>`;
        }
      });
    } else {
      if (selectedBase) {
        const label = [selectedBase.tipo, selectedBase.estilo].filter(Boolean).join(' · ');
        tags += `<span class="summary-tag">${escHtml(selectedBase.categoria)} · ${escHtml(label)}
          <span class="tag-price">R$${selectedBase.preco}</span></span>`;
      }
    }

    selectedAdicionais.forEach(id => {
      const item = comissoes.adicionais.find(a => a.id === id);
      if (item) {
        tags += `<span class="summary-tag">${escHtml(item.nome)}
          <span class="tag-price">+R$${item.preco}</span></span>`;
      }
    });

    summaryItems.innerHTML = tags || '<span class="summary-empty">nenhum item selecionado</span>';

    // Enable submit
    const hasSelection = selectedCategoria === MULTI_CATEGORIA
      ? getTotalQty() >= MULTI_MIN
      : !!selectedBase;
    submitBtn.disabled = !hasSelection;
  }

  function formatCurrency(value) {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  }

  // ═══════════════════════════════════════
  // FORM SUBMISSION
  // ═══════════════════════════════════════
  form.addEventListener('submit', async e => {
    e.preventDefault();

    // Validate
    if (!validate()) return;

    const nome        = document.getElementById('client-name').value.trim();
    const email       = document.getElementById('client-email').value.trim();
    const observacoes = document.getElementById('observations').value.trim();

    const pedido = { cliente: { nome, email }, adicionais: [...selectedAdicionais], observacoes };

    if (selectedCategoria === MULTI_CATEGORIA) {
      pedido.bases = [];
      selectedBaseQtds.forEach((quantidade, id) => {
        pedido.bases.push({ id, quantidade });
      });
      pedido.categoria = selectedCategoria;
    } else {
      pedido.base = { id: selectedBase.id };
    }

    // Loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const res = await fetch(`${API_URL}/api/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pedido),
      });

      const data = await res.json();

      if (data.sucesso) {
        showModal('success');
        resetForm();
      } else {
        showModal('error', data.mensagem || 'Erro ao processar pedido.');
      }
    } catch (err) {
      console.error('[comms-card] Erro ao enviar pedido:', err);
      showModal('error', 'Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = selectedCategoria === MULTI_CATEGORIA
        ? getTotalQty() < MULTI_MIN
        : !selectedBase;
    }
  });

  // ─── Validation ───
  function validate() {
    let ok = true;

    const name  = document.getElementById('client-name');
    const email = document.getElementById('client-email');

    // Name
    if (!name.value.trim()) {
      showError('error-name', 'por favor, informe seu nome');
      name.classList.add('invalid');
      ok = false;
    } else {
      clearError('error-name');
      name.classList.remove('invalid');
    }

    // Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.value.trim()) {
      showError('error-email', 'por favor, informe seu e-mail');
      email.classList.add('invalid');
      ok = false;
    } else if (!emailRegex.test(email.value.trim())) {
      showError('error-email', 'e-mail inválido');
      email.classList.add('invalid');
      ok = false;
    } else {
      clearError('error-email');
      email.classList.remove('invalid');
    }

    // Base selection
    if (selectedCategoria === MULTI_CATEGORIA) {
      const qty = getTotalQty();
      if (qty < MULTI_MIN) {
        showError('error-base', `selecione no mínimo ${MULTI_MIN} itens (${qty}/${MULTI_MAX} selecionados)`);
        priceTable.classList.add('invalid');
        ok = false;
      }
    } else {
      if (!selectedBase) {
        showError('error-base', 'selecione um tipo de comissão');
        priceTable.classList.add('invalid');
        ok = false;
      }
    }

    // Scroll to first error
    if (!ok) {
      const firstInvalid = form.querySelector('.invalid, .field-error.visible');
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    return ok;
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = msg;
      el.classList.add('visible');
    }
  }

  function clearError(id) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = '';
      el.classList.remove('visible');
    }
  }

  // Clear errors on input
  document.getElementById('client-name').addEventListener('input', function () {
    if (this.value.trim()) {
      this.classList.remove('invalid');
      clearError('error-name');
    }
  });

  document.getElementById('client-email').addEventListener('input', function () {
    if (this.value.trim()) {
      this.classList.remove('invalid');
      clearError('error-email');
    }
  });

  // ─── Reset form ───
  function resetForm() {
    form.reset();
    selectedBase = null;
    selectedBaseQtds.clear();
    selectedAdicionais.clear();

    // Re-render table to reset steppers / radios
    renderPriceTable();

    // Clear radio buttons (single-select)
    priceTable.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);

    // Clear checkboxes
    extrasList.querySelectorAll('.extra-item').forEach(item => {
      item.classList.remove('selected');
      item.setAttribute('aria-checked', 'false');
    });
    extrasList.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);

    // Clear errors
    form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
    form.querySelectorAll('.field-error').forEach(el => {
      el.textContent = '';
      el.classList.remove('visible');
    });

    updateSummary();
  }

  // ═══════════════════════════════════════
  // MODAL
  // ═══════════════════════════════════════
  function showModal(type, message) {
    if (type === 'success') {
      modalEl.className = 'modal';
      modalIcon.src = 'assets/modal-success.png';
      modalIcon.alt = 'Sucesso';
      modalTitle.textContent = 'pedido enviado!';
      modalText.textContent = 'seu pedido foi recebido com sucesso!';
    } else {
      modalEl.className = 'modal error';
      modalIcon.src = 'assets/modal-error.png';
      modalIcon.alt = 'Erro';
      modalTitle.textContent = 'ops, algo deu errado';
      modalText.textContent = message || 'erro ao enviar pedido :c tente novamente.';
    }

    modalOverlay.classList.add('active');
    modalOverlay.setAttribute('aria-hidden', 'false');
    modalClose.focus();
  }

  function hideModal() {
    modalOverlay.classList.remove('active');
    modalOverlay.setAttribute('aria-hidden', 'true');
  }

  modalClose.addEventListener('click', hideModal);

  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) hideModal();
  });

  // ESC to close modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      hideModal();
    }
  });

  // ═══════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════
  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ═══════════════════════════════════════
  // START
  // ═══════════════════════════════════════
  init();

})();
