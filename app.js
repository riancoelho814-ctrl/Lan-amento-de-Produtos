/* app.js - Kanban simples, minimalista, localStorage (pronto para migrar p/ Firebase) */

(() => {
  // Configuração inicial: nomes de colunas / status
  const STATUSES = [
    { id: '1_foto', label: 'Entregue para Foto' },
    { id: '2_editado', label: 'Produto Editado' },
    { id: '3_lancado', label: 'Produto Lançado no Sistema' },
    { id: '4_entregue', label: 'Produto Entregue no Endereço' },
    { id: '5_completo', label: 'Completo' }
  ];

  const DB_KEY = 'fluxboard_db_v1';
  const userInput = document.getElementById('userName');
  const boardEl = document.getElementById('board');
  const btnNewCard = document.getElementById('btnNewCard');
  const btnExport = document.getElementById('btnExport');
  const btnImport = document.getElementById('btnImport');
  const btnBatch = document.getElementById('btnBatch');
  const completedEl = document.getElementById('completedBonuses');

  // Modal
  const modal = document.getElementById('modal');
  const modalForm = document.getElementById('modalForm');
  const m_name = document.getElementById('m_name');
  const m_bonus = document.getElementById('m_bonus');
  const m_code = document.getElementById('m_code');
  const m_address = document.getElementById('m_address');
  const m_image = document.getElementById('m_image');
  const modalTitle = document.getElementById('modalTitle');
  const modalCancel = document.getElementById('modalCancel');

  // Prompt modal (import / batch)
  const prompt = document.getElementById('prompt');
  const promptTitle = document.getElementById('promptTitle');
  const promptInput = document.getElementById('promptInput');
  const promptCancel = document.getElementById('promptCancel');
  const promptAction = document.getElementById('promptAction');

  let db = loadDb();
  let editCardId = null;

  // Inicializa usuário salvo
  userInput.value = localStorage.getItem('flux_user_name') || '';
  userInput.addEventListener('change', () => {
    localStorage.setItem('flux_user_name', userInput.value.trim());
  });

  // ================= DB helpers =================
  function loadDb() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) {
        const empty = { cards: {}, columns: {}, order: STATUSES.map(s => s.id) };
        // inicializa colunas
        STATUSES.forEach(s => empty.columns[s.id] = { id: s.id, title: s.label, cardIds: [] });
        localStorage.setItem(DB_KEY, JSON.stringify(empty));
        return empty;
      }
      return JSON.parse(raw);
    } catch (e) {
      console.error('Erro ao carregar DB', e);
      return { cards: {}, columns: {}, order: STATUSES.map(s => s.id) };
    }
  }
  function saveDb() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

  // ================= Render =================
  function renderBoard() {
    boardEl.innerHTML = '';
    updateCompletedBonuses();

    db.order.forEach(colId => {
      const col = db.columns[colId];
      const colEl = document.createElement('div');
      colEl.className = 'column';
      colEl.dataset.col = colId;

      const titleEl = document.createElement('div');
      titleEl.className = 'title';
      titleEl.innerHTML = `<span>${col.title} <small>(${col.cardIds.length})</small></span>
        <div><button class="small-btn" data-add="${col.id}">+ Card</button></div>`;

      const list = document.createElement('div');
      list.className = 'card-list';
      list.dataset.col = colId;
      list.addEventListener('dragover', ev => ev.preventDefault());
      list.addEventListener('drop', onDrop);

      col.cardIds.forEach(cardId => {
        const card = db.cards[cardId];
        if (!card) return;
        const cardEl = makeCardEl(card);
        list.appendChild(cardEl);
      });

      colEl.appendChild(titleEl);
      colEl.appendChild(list);
      boardEl.appendChild(colEl);
    });

    // delegação: botões + Card adicionar
    document.querySelectorAll('[data-add]').forEach(btn => {
      btn.addEventListener('click', () => openModalForNew(btn.dataset.add));
    });

    saveDb();
  }

  function makeCardEl(card) {
    const el = document.createElement('div');
    el.className = 'card';
    el.draggable = true;
    el.dataset.id = card.id;
    el.addEventListener('dragstart', onDragStart);

    el.innerHTML = `<strong>${escapeHtml(card.title)}</strong>
      <small>Cód. Bônus: ${card.bonusCode || '-'} • Cód. Prod: ${card.productCode || '-'}</small>
      <small>Tempo no status: <span data-time="${card.id}">calculando...</span></small>
      <div class="actions">
        <button class="small-btn" data-edit="${card.id}">Editar</button>
        <button class="small-btn" data-delete="${card.id}">Excluir</button>
        <button class="small-btn" data-advance="${card.id}">Avançar</button>
      </div>`;

    // event delegation for actions will be attached by renderBoard
    return el;
  }

  // ================= Drag & Drop =================
  let dragCardId = null;
  function onDragStart(e) {
    dragCardId = e.currentTarget.dataset.id;
    e.dataTransfer.setData('text/plain', dragCardId);
    e.dataTransfer.effectAllowed = 'move';
  }
  function onDrop(e) {
    e.preventDefault();
    const destCol = e.currentTarget.dataset.col;
    const cardId = e.dataTransfer.getData('text/plain') || dragCardId;
    if (!cardId) return;
    moveCardToColumn(cardId, destCol);
  }

  function moveCardToColumn(cardId, destCol) {
    const fromColId = findCardColumn(cardId);
    if (!fromColId) return;
    if (fromColId === destCol) {
      // colocar no topo
      const col = db.columns[destCol];
      col.cardIds = col.cardIds.filter(c => c !== cardId);
      col.cardIds.unshift(cardId);
    } else {
      // remove do antigo e adiciona no novo
      db.columns[fromColId].cardIds = db.columns[fromColId].cardIds.filter(c => c !== cardId);
      db.columns[destCol].cardIds.unshift(cardId);
      // registra histórico do card
      const card = db.cards[cardId];
      card.history = card.history || [];
      card.history.push({ status: destCol, timestamp: Date.now(), user: userInput.value || 'Não Identificado' });
      card.currentStatus = destCol;
    }
    saveDb();
    renderBoard();
  }

  function findCardColumn(cardId) {
    return Object.values(db.columns).find(c => c.cardIds.includes(cardId))?.id;
  }

  // ================= Modal CRUD =================
  btnNewCard.addEventListener('click', () => openModalForNew(STATUSES[0].id));
  modalCancel.addEventListener('click', closeModal);
  modalForm.addEventListener('submit', onModalSubmit);

  function openModalForNew(columnId) {
    editCardId = null;
    modalTitle.textContent = 'Nova Demanda';
    m_name.value = '';
    m_bonus.value = '';
    m_code.value = '';
    m_address.value = '';
    m_image.value = '';
    modal.dataset.target = columnId;
    showModal(modal);
  }

  function openModalForEdit(cardId) {
    const card = db.cards[cardId];
    if (!card) return;
    editCardId = cardId;
    modalTitle.textContent = 'Editar Demanda';
    m_name.value = card.title || '';
    m_bonus.value = card.bonusCode || '';
    m_code.value = card.productCode || '';
    m_address.value = card.deliveryAddress || '';
    m_image.value = card.imageUrl || '';
    modal.dataset.target = card.currentStatus || STATUSES[0].id;
    showModal(modal);
  }

  function onModalSubmit(e) {
    e.preventDefault();
    const payload = {
      title: m_name.value.trim() || 'Produto sem nome',
      bonusCode: m_bonus.value.trim(),
      productCode: m_code.value.trim(),
      deliveryAddress: m_address.value.trim(),
      imageUrl: m_image.value.trim()
    };

    if (editCardId) {
      const card = db.cards[editCardId];
      Object.assign(card, payload, { updatedAt: Date.now() });
      // ensure history exists
      card.history = card.history || [];
    } else {
      const id = 'c' + Date.now() + Math.floor(Math.random()*1000);
      const colId = modal.dataset.target || STATUSES[0].id;
      db.cards[id] = {
        id, ...payload, createdAt: Date.now(), updatedAt: Date.now(),
        currentStatus: colId,
        history: [{ status: colId, timestamp: Date.now(), user: userInput.value || 'Não Identificado' }]
      };
      db.columns[colId].cardIds.unshift(id);
    }

    saveDb();
    closeModal();
    renderBoard();
  }

  function closeModal() { modal.classList.add('hidden'); }
  function showModal(el) { el.classList.remove('hidden'); }

  // ================= Actions delegation =================
  document.body.addEventListener('click', (e) => {
    const editId = e.target.closest('[data-edit]')?.dataset.edit;
    const delId = e.target.closest('[data-delete]')?.dataset.delete;
    const advId = e.target.closest('[data-advance]')?.dataset.advance;

    if (editId) { openModalForEdit(editId); return; }
    if (delId) { if (confirm('Excluir este card?')) deleteCard(delId); return; }
    if (advId) { advanceStatus(advId); return; }
  });

  function deleteCard(id) {
    // remove de colunas
    const colId = findCardColumn(id);
    if (colId) db.columns[colId].cardIds = db.columns[colId].cardIds.filter(c => c !== id);
    delete db.cards[id];
    saveDb();
    renderBoard();
  }

  function advanceStatus(id) {
    const card = db.cards[id];
    const idx = db.order.indexOf(card.currentStatus);
    const next = db.order[idx+1];
    if (!next) { alert('Já está no status final.'); return; }
    moveCardToColumn(id, next);
  }

  // ================= Import / Export / Batch =================
  btnExport.addEventListener('click', () => {
    const dump = JSON.stringify(db, null, 2);
    downloadText('fluxboard-export.json', dump);
  });

  btnImport.addEventListener('click', () => {
    promptTitle.textContent = 'Importar JSON (cole aqui)';
    promptInput.value = '';
    promptAction.textContent = 'Importar JSON';
    promptAction.onclick = () => {
      try {
        const parsed = JSON.parse(promptInput.value);
        // simples validação
        if (!parsed.columns || !parsed.cards) throw new Error('Formato inválido');
        db = parsed;
        saveDb();
        renderBoard();
        closePrompt();
        alert('Importação concluída');
      } catch (err) {
        alert('Erro ao importar: ' + err.message);
      }
    };
    showModal(prompt);
  });

  btnBatch.addEventListener('click', () => {
    promptTitle.textContent = 'Avançar em Lote (cole códigos de produto 6 dígitos)';
    promptInput.value = '';
    promptAction.textContent = 'Avançar';
    promptAction.onclick = () => {
      const text = promptInput.value.trim();
      const codes = text.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
      if (codes.length === 0) { alert('Insira códigos.'); return; }
      let advanced = 0;
      const notFound = [];
      codes.forEach(code => {
        const cardId = Object.keys(db.cards).find(id => db.cards[id].productCode === code);
        if (cardId) {
          const card = db.cards[cardId];
          if (card.currentStatus === STATUSES[STATUSES.length-1].id) {
            notFound.push(code);
          } else {
            advanceStatus(cardId);
            advanced++;
          }
        } else notFound.push(code);
      });
      closePrompt();
      alert(`Avançados: ${advanced}\nNão encontrados ou já finais: ${notFound.join(', ')}`);
    };
    showModal(prompt);
  });

  promptCancel.addEventListener('click', closePrompt);
  function closePrompt(){ prompt.classList.add('hidden'); }
  function showModalPrompt(){ prompt.classList.remove('hidden'); }

  // ================= Utilities =================
  function downloadText(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }

  function escapeHtml(s){ return (s+'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

  // ================= Timers / Time in status display =================
  function formatTime(totalSeconds) {
    if (totalSeconds < 0) totalSeconds = 0;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const parts = [];
    if (days) parts.push(days + 'd');
    if (hours || days) parts.push(hours + 'h');
    parts.push(minutes + 'min');
    parts.push(seconds + 's');
    return parts.join(' ');
  }

  function updateTimers() {
    Object.values(db.cards).forEach(card => {
      const el = document.querySelector(`[data-time="${card.id}"]`);
      if (!el) return;
      const lastEntry = (card.history && card.history[card.history.length - 1]) || { timestamp: card.createdAt || Date.now() };
      const start = lastEntry.timestamp;
      const sec = Math.floor((Date.now() - start) / 1000);
      el.textContent = formatTime(sec);
    });
  }

  // ================= Completed bonuses summary =================
  function updateCompletedBonuses() {
    const bonusStatus = {}; // bonusCode -> {total, completed}
    Object.values(db.cards).forEach(c => {
      if (!c.bonusCode) return;
      bonusStatus[c.bonusCode] = bonusStatus[c.bonusCode] || { total:0, completed:0 };
      bonusStatus[c.bonusCode].total++;
      if (c.currentStatus === STATUSES[STATUSES.length-1].id) bonusStatus[c.bonusCode].completed++;
    });
    const completed = Object.keys(bonusStatus).filter(code => bonusStatus[code].total > 0 && bonusStatus[code].total === bonusStatus[code].completed);
    completedEl.textContent = completed.length ? completed.join(' | ') : 'Nenhum';
  }

  // ================= Init =================
  function initInteractionDelegation() {
    // handle edit/delete/advance buttons inside cards
    // already delegated on body click
  }

  function restoreOrSeed() {
    // if no cards, seed minimal example
    if (Object.keys(db.cards).length === 0) {
      // seed demo
      createCardSeed('277322','Produto Demo A','6792940', STATUSES[0].id);
      createCardSeed('277323','Produto Demo B','6792940', STATUSES[1].id);
      createCardSeed('277324','Produto Demo C','6792951', STATUSES[2].id);
    }
  }
  function createCardSeed(productCode, title, bonusCode, columnId) {
    const id = 'c' + Date.now() + Math.floor(Math.random()*1000);
    db.cards[id] = {
      id, title, productCode, bonusCode,
      createdAt: Date.now(), updatedAt: Date.now(),
      currentStatus: columnId,
      history: [{ status: columnId, timestamp: Date.now(), user: 'seed' }]
    };
    db.columns[columnId].cardIds.unshift(id);
    saveDb();
  }

  // attach edit shortcut when modal hidden etc.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closePrompt(); }
  });

  // prompt actions
  document.getElementById('promptAction'); // already used by assignment in events

  // small helper: attach event to modal edit-buttons after render
  function attachPostRenderHandlers() {
    // attach edit/delete/advance to each card (data attributes handled by delegation)
  }

  // inicialização
  restoreOrSeed();
  renderBoard();
  initInteractionDelegation();
  setInterval(updateTimers, 1000);

  // helper to open prompt
  window.showModal = showModal;
  window.showPrompt = showModalPrompt;

})();
