const STORAGE_KEY = "kanban-studio-workspace-v2";
const LEGACY_STORAGE_KEY = "kanban-studio-board-v1";
const THEME_KEY = "kanban-studio-theme";
const themes = ["light", "dark", "oled"];

const priorityOrder = ["urgent", "high", "medium", "low"];
const priorityLabels = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low"
};

const seedColumns = [
  { title: "Backlog", accent: "#7c6df0" },
  { title: "To Do", accent: "#2f7df6" },
  { title: "In Progress", accent: "#f59f00" },
  { title: "Review", accent: "#14a06f" },
  { title: "Done", accent: "#667085" }
];

let workspace = null;
let board = null;
let activeDragCardId = null;
let activeChecklist = [];
let toastTimer = null;
let storageMode = "local";
let serverSaveTimer = null;

const els = {
  board: document.querySelector("#board"),
  boardSwitcher: document.querySelector("#boardSwitcher"),
  boardTitle: document.querySelector("#boardTitle"),
  currentBoardTitle: document.querySelector("#currentBoardTitle"),
  newBoardBtn: document.querySelector("#newBoardBtn"),
  duplicateBoardBtn: document.querySelector("#duplicateBoardBtn"),
  addColumnBtn: document.querySelector("#addColumnBtn"),
  addCardBtn: document.querySelector("#addCardBtn"),
  archiveBtn: document.querySelector("#archiveBtn"),
  activityBtn: document.querySelector("#activityBtn"),
  searchInput: document.querySelector("#searchInput"),
  priorityFilter: document.querySelector("#priorityFilter"),
  labelFilter: document.querySelector("#labelFilter"),
  clearFiltersBtn: document.querySelector("#clearFiltersBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  resetBtn: document.querySelector("#resetBtn"),
  themeToggle: document.querySelector("#themeToggle"),
  statCards: document.querySelector("#statCards"),
  statDone: document.querySelector("#statDone"),
  statOverdue: document.querySelector("#statOverdue"),
  statColumns: document.querySelector("#statColumns"),
  toast: document.querySelector("#toast"),
  cardDialog: document.querySelector("#cardDialog"),
  cardForm: document.querySelector("#cardForm"),
  cardDialogTitle: document.querySelector("#cardDialogTitle"),
  cardId: document.querySelector("#cardId"),
  cardTitle: document.querySelector("#cardTitle"),
  cardDescription: document.querySelector("#cardDescription"),
  cardColumn: document.querySelector("#cardColumn"),
  cardPriority: document.querySelector("#cardPriority"),
  cardDueDate: document.querySelector("#cardDueDate"),
  cardAssignee: document.querySelector("#cardAssignee"),
  cardLabels: document.querySelector("#cardLabels"),
  checklistItems: document.querySelector("#checklistItems"),
  checklistInput: document.querySelector("#checklistInput"),
  checklistCount: document.querySelector("#checklistCount"),
  addChecklistItemBtn: document.querySelector("#addChecklistItemBtn"),
  archiveCardBtn: document.querySelector("#archiveCardBtn"),
  deleteCardBtn: document.querySelector("#deleteCardBtn"),
  columnDialog: document.querySelector("#columnDialog"),
  columnForm: document.querySelector("#columnForm"),
  columnDialogTitle: document.querySelector("#columnDialogTitle"),
  columnId: document.querySelector("#columnId"),
  columnTitle: document.querySelector("#columnTitle"),
  columnAccent: document.querySelector("#columnAccent"),
  deleteColumnBtn: document.querySelector("#deleteColumnBtn"),
  archiveDialog: document.querySelector("#archiveDialog"),
  archiveList: document.querySelector("#archiveList"),
  activityDialog: document.querySelector("#activityDialog"),
  activityList: document.querySelector("#activityList")
};

init();

async function init() {
  setTheme(getInitialTheme(), false);
  workspace = await loadWorkspace();
  board = getActiveBoard();
  bindEvents();
  saveWorkspace();
  render();
}

function bindEvents() {
  els.boardSwitcher.addEventListener("change", () => {
    workspace.activeBoardId = els.boardSwitcher.value;
    board = getActiveBoard();
    saveAndRender();
  });

  els.newBoardBtn.addEventListener("click", createNewBoard);
  els.duplicateBoardBtn.addEventListener("click", duplicateCurrentBoard);

  els.boardTitle.addEventListener("input", () => {
    board.title = els.boardTitle.value.trim() || "Untitled board";
    board.updatedAt = Date.now();
    renderBoardSwitcher();
    saveWorkspace();
    renderHeader();
  });

  els.addColumnBtn.addEventListener("click", () => openColumnDialog());
  els.addCardBtn.addEventListener("click", () => openCardDialog());
  els.archiveBtn.addEventListener("click", openArchiveDialog);
  els.activityBtn.addEventListener("click", openActivityDialog);
  els.searchInput.addEventListener("input", renderBoard);
  els.priorityFilter.addEventListener("change", renderBoard);
  els.labelFilter.addEventListener("change", renderBoard);

  els.clearFiltersBtn.addEventListener("click", () => {
    els.searchInput.value = "";
    els.priorityFilter.value = "all";
    els.labelFilter.value = "all";
    renderBoard();
  });

  els.themeToggle.addEventListener("click", () => {
    const currentIndex = themes.indexOf(document.documentElement.dataset.theme);
    setTheme(themes[(currentIndex + 1) % themes.length]);
  });

  els.exportBtn.addEventListener("click", exportWorkspace);
  els.importInput.addEventListener("change", importWorkspace);
  els.resetBtn.addEventListener("click", resetBoard);

  els.cardForm.addEventListener("submit", saveCardFromForm);
  els.columnForm.addEventListener("submit", saveColumnFromForm);
  els.addChecklistItemBtn.addEventListener("click", addChecklistItemFromInput);
  els.checklistInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addChecklistItemFromInput();
    }
  });
  els.archiveCardBtn.addEventListener("click", archiveActiveCard);
  els.deleteCardBtn.addEventListener("click", deleteActiveCard);
  els.deleteColumnBtn.addEventListener("click", deleteActiveColumn);

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });
}

function getInitialTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (themes.includes(savedTheme)) return savedTheme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setTheme(theme, persist = true) {
  const nextTheme = themes.includes(theme) ? theme : "light";
  document.documentElement.dataset.theme = nextTheme;
  const labels = {
    light: "Theme: Light",
    dark: "Theme: Dark",
    oled: "Theme: OLED"
  };
  const icons = {
    light: "◐",
    dark: "◑",
    oled: "●"
  };
  if (els?.themeToggle) {
    els.themeToggle.textContent = icons[nextTheme];
    els.themeToggle.title = labels[nextTheme];
    els.themeToggle.setAttribute("aria-label", `${labels[nextTheme]}. Activate next theme.`);
  }
  if (persist) localStorage.setItem(THEME_KEY, nextTheme);
}

function render() {
  board = getActiveBoard();
  normalizeOrders();
  renderBoardSwitcher();
  renderHeader();
  renderColumnOptions();
  renderLabelFilter();
  renderStats();
  renderBoard();
}

function renderHeader() {
  els.boardTitle.value = board.title;
  els.currentBoardTitle.textContent = board.title;
}

function renderBoardSwitcher() {
  els.boardSwitcher.replaceChildren(
    ...workspace.boards.map((item) => new Option(item.title, item.id, item.id === board.id, item.id === board.id))
  );
}

function renderBoard() {
  renderStats();
  renderLabelFilter();
  const fragment = document.createDocumentFragment();
  const visibleCards = getFilteredCards();

  board.columns.forEach((column) => {
    const columnCards = visibleCards
      .filter((card) => card.columnId === column.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);

    const columnEl = document.createElement("article");
    columnEl.className = "column";
    columnEl.style.setProperty("--column-accent", column.accent);
    columnEl.innerHTML = `
      <header class="column-header">
        <div class="column-title">
          <h3>${escapeHtml(column.title)}</h3>
          <span>${columnCards.length} ${columnCards.length === 1 ? "card" : "cards"}</span>
        </div>
        <div class="column-actions">
          <button class="icon-button small-icon" type="button" title="Add card" aria-label="Add card to ${escapeAttr(column.title)}" data-add-card="${column.id}">+</button>
          <button class="icon-button small-icon" type="button" title="Edit list" aria-label="Edit ${escapeAttr(column.title)}" data-edit-column="${column.id}">...</button>
        </div>
      </header>
      <div class="card-list" data-column-id="${column.id}"></div>
    `;

    const listEl = columnEl.querySelector(".card-list");
    bindDropZone(listEl);

    if (columnCards.length === 0) {
      listEl.innerHTML = `<div class="empty-state">Drop cards here or add a new one.</div>`;
    } else {
      columnCards.forEach((card) => listEl.appendChild(createCardElement(card)));
    }

    fragment.appendChild(columnEl);
  });

  els.board.replaceChildren(fragment);
  els.board.querySelectorAll("[data-add-card]").forEach((button) => {
    button.addEventListener("click", () => openCardDialog(null, button.dataset.addCard));
  });
  els.board.querySelectorAll("[data-edit-column]").forEach((button) => {
    button.addEventListener("click", () => openColumnDialog(button.dataset.editColumn));
  });
}

function createCardElement(card) {
  const cardEl = document.createElement("article");
  const doneCount = card.checklist.filter((item) => item.done).length;
  const totalCount = card.checklist.length;
  cardEl.className = "card";
  cardEl.tabIndex = 0;
  cardEl.role = "button";
  cardEl.ariaLabel = `Edit ${card.title}`;
  cardEl.draggable = true;
  cardEl.dataset.cardId = card.id;

  const labels = card.labels.map((label) => `<span class="label-chip">${escapeHtml(label)}</span>`).join("");
  const dueClass = isOverdue(card) ? "due overdue" : "due";

  cardEl.innerHTML = `
    <div class="card-top">
      <h4>${escapeHtml(card.title)}</h4>
      <span class="priority ${card.priority}">${priorityLabels[card.priority]}</span>
    </div>
    ${card.description ? `<p>${escapeHtml(card.description)}</p>` : ""}
    ${totalCount ? `<div class="mini-progress"><span style="width:${Math.round((doneCount / totalCount) * 100)}%"></span></div>` : ""}
    ${labels ? `<div class="labels">${labels}</div>` : ""}
    <div class="card-footer">
      ${totalCount ? `<span>${doneCount}/${totalCount} done</span>` : ""}
      ${card.dueDate ? `<span class="${dueClass}">Due ${formatDate(card.dueDate)}</span>` : ""}
      ${card.assignee ? `<span>${escapeHtml(card.assignee)}</span>` : ""}
    </div>
  `;

  cardEl.addEventListener("click", () => openCardDialog(card.id));
  cardEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCardDialog(card.id);
    }
  });
  cardEl.addEventListener("dragstart", (event) => {
    activeDragCardId = card.id;
    cardEl.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", card.id);
  });
  cardEl.addEventListener("dragend", () => {
    activeDragCardId = null;
    cardEl.classList.remove("dragging");
  });

  return cardEl;
}

function bindDropZone(listEl) {
  listEl.addEventListener("dragover", (event) => {
    event.preventDefault();
    const dragging = els.board.querySelector(".card.dragging");
    const afterElement = getDragAfterElement(listEl, event.clientY);
    listEl.classList.add("drag-over");

    if (dragging && dragging.parentElement !== listEl) {
      listEl.querySelector(".empty-state")?.remove();
    }

    if (!dragging) return;
    if (!afterElement) {
      listEl.appendChild(dragging);
    } else {
      listEl.insertBefore(dragging, afterElement);
    }
  });

  listEl.addEventListener("dragleave", () => {
    listEl.classList.remove("drag-over");
  });

  listEl.addEventListener("drop", (event) => {
    event.preventDefault();
    listEl.classList.remove("drag-over");
    const cardId = event.dataTransfer.getData("text/plain") || activeDragCardId;
    commitDraggedOrder(cardId, listEl);
  });
}

function getDragAfterElement(container, y) {
  const candidates = [...container.querySelectorAll(".card:not(.dragging)")];
  return candidates.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    }
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

function commitDraggedOrder(cardId, listEl) {
  const card = board.cards.find((item) => item.id === cardId);
  if (!card) return;

  const previousColumn = card.columnId;
  const nextColumn = listEl.dataset.columnId;
  card.columnId = nextColumn;
  [...listEl.querySelectorAll(".card")].forEach((cardNode, index) => {
    const item = board.cards.find((candidate) => candidate.id === cardNode.dataset.cardId);
    if (item) {
      item.columnId = nextColumn;
      item.order = index;
    }
  });

  board.columns.forEach((column) => renumberColumn(column.id));
  if (previousColumn !== nextColumn) {
    addActivity("Moved card", `${card.title} moved to ${columnTitle(nextColumn)}.`);
  } else {
    addActivity("Reordered card", `${card.title} reordered in ${columnTitle(nextColumn)}.`);
  }
  saveAndRender();
}

function openCardDialog(cardId = null, columnId = null) {
  const card = cardId ? board.cards.find((item) => item.id === cardId) : null;
  els.cardDialogTitle.textContent = card ? "Edit card" : "Add card";
  els.deleteCardBtn.hidden = !card;
  els.archiveCardBtn.hidden = !card;
  els.cardId.value = card?.id || "";
  els.cardTitle.value = card?.title || "";
  els.cardDescription.value = card?.description || "";
  els.cardColumn.value = card?.columnId || columnId || board.columns[0]?.id || "";
  els.cardPriority.value = card?.priority || "medium";
  els.cardDueDate.value = card?.dueDate || "";
  els.cardAssignee.value = card?.assignee || "";
  els.cardLabels.value = card?.labels.join(", ") || "";
  activeChecklist = structuredClone(card?.checklist || []);
  renderChecklistEditor();
  els.cardDialog.showModal();
  els.cardTitle.focus();
}

function saveCardFromForm(event) {
  event.preventDefault();
  const id = els.cardId.value || createId("card");
  const existing = board.cards.find((card) => card.id === id);
  const previousColumn = existing?.columnId;
  const selectedColumn = els.cardColumn.value;
  const card = {
    id,
    columnId: selectedColumn,
    title: els.cardTitle.value.trim(),
    description: els.cardDescription.value.trim(),
    priority: els.cardPriority.value,
    dueDate: els.cardDueDate.value,
    assignee: els.cardAssignee.value.trim(),
    labels: parseLabels(els.cardLabels.value),
    checklist: structuredClone(activeChecklist),
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
    order: existing && previousColumn === selectedColumn ? existing.order : nextOrderInColumn(selectedColumn)
  };

  if (existing) {
    Object.assign(existing, card);
    addActivity("Updated card", `${card.title} was edited.`);
    if (previousColumn !== selectedColumn) {
      addActivity("Moved card", `${card.title} moved to ${columnTitle(selectedColumn)}.`);
    }
  } else {
    board.cards.push(card);
    addActivity("Created card", `${card.title} was added to ${columnTitle(selectedColumn)}.`);
  }

  els.cardDialog.close();
  saveAndRender();
  showToast(existing ? "Card updated." : "Card added.");
}

function renderChecklistEditor() {
  els.checklistCount.textContent = `${activeChecklist.length} ${activeChecklist.length === 1 ? "item" : "items"}`;
  if (!activeChecklist.length) {
    els.checklistItems.innerHTML = `<div class="empty-state compact-empty">No checklist items yet.</div>`;
    return;
  }

  els.checklistItems.replaceChildren(
    ...activeChecklist.map((item) => {
      const row = document.createElement("div");
      row.className = "checklist-row";
      row.innerHTML = `
        <input type="checkbox" ${item.done ? "checked" : ""} aria-label="Toggle ${escapeAttr(item.text)}">
        <input class="input checklist-text" type="text" value="${escapeAttr(item.text)}" maxlength="120">
        <button class="icon-button small-icon" type="button" aria-label="Remove ${escapeAttr(item.text)}">×</button>
      `;
      row.querySelector("input[type='checkbox']").addEventListener("change", (event) => {
        item.done = event.target.checked;
      });
      row.querySelector(".checklist-text").addEventListener("input", (event) => {
        item.text = event.target.value;
      });
      row.querySelector("button").addEventListener("click", () => {
        activeChecklist = activeChecklist.filter((candidate) => candidate.id !== item.id);
        renderChecklistEditor();
      });
      return row;
    })
  );
}

function addChecklistItemFromInput() {
  const text = els.checklistInput.value.trim();
  if (!text) return;
  activeChecklist.push({ id: createId("check"), text, done: false });
  els.checklistInput.value = "";
  renderChecklistEditor();
}

function archiveActiveCard() {
  const id = els.cardId.value;
  const card = board.cards.find((item) => item.id === id);
  if (!card || !confirm("Archive this card?")) return;
  board.cards = board.cards.filter((item) => item.id !== id);
  board.archive.unshift({ ...card, archivedAt: Date.now() });
  addActivity("Archived card", `${card.title} moved to the archive.`);
  els.cardDialog.close();
  saveAndRender();
  showToast("Card archived.");
}

function deleteActiveCard() {
  const id = els.cardId.value;
  const card = board.cards.find((item) => item.id === id);
  if (!card || !confirm("Delete this card permanently?")) return;
  board.cards = board.cards.filter((item) => item.id !== id);
  addActivity("Deleted card", `${card.title} was permanently deleted.`);
  els.cardDialog.close();
  saveAndRender();
  showToast("Card deleted.");
}

function openColumnDialog(columnId = null) {
  const column = columnId ? board.columns.find((item) => item.id === columnId) : null;
  els.columnDialogTitle.textContent = column ? "Edit list" : "Add list";
  els.deleteColumnBtn.hidden = !column || board.columns.length <= 1;
  els.columnId.value = column?.id || "";
  els.columnTitle.value = column?.title || "";
  els.columnAccent.value = column?.accent || "#2f7df6";
  els.columnDialog.showModal();
  els.columnTitle.focus();
}

function saveColumnFromForm(event) {
  event.preventDefault();
  const id = els.columnId.value || createId("col");
  const existing = board.columns.find((column) => column.id === id);
  const column = {
    id,
    title: els.columnTitle.value.trim(),
    accent: els.columnAccent.value
  };

  if (existing) {
    Object.assign(existing, column);
    addActivity("Updated list", `${column.title} was edited.`);
  } else {
    board.columns.push(column);
    addActivity("Created list", `${column.title} was added.`);
  }

  els.columnDialog.close();
  saveAndRender();
  showToast(existing ? "List updated." : "List added.");
}

function deleteActiveColumn() {
  const id = els.columnId.value;
  const column = board.columns.find((item) => item.id === id);
  if (!column || board.columns.length <= 1) return;
  if (!confirm("Delete this list and archive all cards inside it?")) return;
  const removedCards = board.cards.filter((card) => card.columnId === id);
  board.archive.unshift(...removedCards.map((card) => ({ ...card, archivedAt: Date.now() })));
  board.columns = board.columns.filter((item) => item.id !== id);
  board.cards = board.cards.filter((card) => card.columnId !== id);
  addActivity("Deleted list", `${column.title} was deleted; ${removedCards.length} cards were archived.`);
  els.columnDialog.close();
  saveAndRender();
  showToast("List deleted.");
}

function openArchiveDialog() {
  renderArchive();
  els.archiveDialog.showModal();
}

function renderArchive() {
  if (!board.archive.length) {
    els.archiveList.innerHTML = `<div class="empty-state compact-empty">No archived cards yet.</div>`;
    return;
  }

  els.archiveList.replaceChildren(
    ...board.archive.map((card) => {
      const item = document.createElement("div");
      item.className = "archive-item";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(card.title)}</strong>
          <p>${card.archivedAt ? `Archived ${formatDateTime(card.archivedAt)}` : "Archived"}</p>
        </div>
        <button class="button" type="button">Restore</button>
      `;
      item.querySelector("button").addEventListener("click", () => restoreArchivedCard(card.id));
      return item;
    })
  );
}

function restoreArchivedCard(cardId) {
  const card = board.archive.find((item) => item.id === cardId);
  if (!card) return;
  const targetColumnId = board.columns.some((column) => column.id === card.columnId) ? card.columnId : board.columns[0].id;
  board.archive = board.archive.filter((item) => item.id !== cardId);
  board.cards.push({
    ...card,
    archivedAt: undefined,
    columnId: targetColumnId,
    order: nextOrderInColumn(targetColumnId)
  });
  addActivity("Restored card", `${card.title} was restored from the archive.`);
  saveAndRender();
  renderArchive();
  showToast("Card restored.");
}

function openActivityDialog() {
  renderActivity();
  els.activityDialog.showModal();
}

function renderActivity() {
  if (!board.activity.length) {
    els.activityList.innerHTML = `<div class="empty-state compact-empty">No activity yet.</div>`;
    return;
  }

  els.activityList.replaceChildren(
    ...board.activity.slice(0, 80).map((entry) => {
      const item = document.createElement("div");
      item.className = "activity-item";
      item.innerHTML = `
        <span></span>
        <div>
          <strong>${escapeHtml(entry.action)}</strong>
          <p>${escapeHtml(entry.detail)}</p>
          <time>${formatDateTime(entry.at)}</time>
        </div>
      `;
      return item;
    })
  );
}

function createNewBoard() {
  const title = prompt("Name the new board", "New Board");
  if (!title) return;
  const nextBoard = createBoard(title.trim());
  workspace.boards.push(nextBoard);
  workspace.activeBoardId = nextBoard.id;
  board = nextBoard;
  addActivity("Created board", `${nextBoard.title} was created.`);
  saveAndRender();
  showToast("Board created.");
}

function duplicateCurrentBoard() {
  const copy = structuredClone(board);
  const newId = createId("board");
  const columnMap = new Map();
  copy.id = newId;
  copy.title = `${board.title} Copy`;
  copy.createdAt = Date.now();
  copy.updatedAt = Date.now();
  copy.activity = [];
  copy.archive = [];
  copy.columns = copy.columns.map((column) => {
    const id = createId("col");
    columnMap.set(column.id, id);
    return { ...column, id };
  });
  copy.cards = copy.cards.map((card) => ({
    ...card,
    id: createId("card"),
    columnId: columnMap.get(card.columnId) || copy.columns[0].id,
    checklist: card.checklist.map((item) => ({ ...item, id: createId("check") })),
    createdAt: Date.now(),
    updatedAt: Date.now()
  }));
  workspace.boards.push(copy);
  workspace.activeBoardId = copy.id;
  board = copy;
  addActivity("Duplicated board", `${board.title} was created from ${workspace.boards.find((item) => item.id !== copy.id && item.title === copy.title.replace(/ Copy$/, ""))?.title || "another board"}.`);
  saveAndRender();
  showToast("Board duplicated.");
}

function getFilteredCards() {
  const term = els.searchInput.value.trim().toLowerCase();
  const priority = els.priorityFilter.value;
  const label = els.labelFilter.value;

  return board.cards.filter((card) => {
    const checklistText = card.checklist.map((item) => item.text).join(" ");
    const text = [card.title, card.description, card.assignee, checklistText, ...card.labels].join(" ").toLowerCase();
    const matchesTerm = !term || text.includes(term);
    const matchesPriority = priority === "all" || card.priority === priority;
    const matchesLabel = label === "all" || card.labels.includes(label);
    return matchesTerm && matchesPriority && matchesLabel;
  });
}

function renderColumnOptions() {
  els.cardColumn.replaceChildren(
    ...board.columns.map((column) => {
      const option = document.createElement("option");
      option.value = column.id;
      option.textContent = column.title;
      return option;
    })
  );
}

function renderLabelFilter() {
  const currentValue = els.labelFilter.value;
  const labels = [...new Set(board.cards.flatMap((card) => card.labels))].sort((a, b) => a.localeCompare(b));
  els.labelFilter.replaceChildren(new Option("All labels", "all"), ...labels.map((label) => new Option(label, label)));
  els.labelFilter.value = labels.includes(currentValue) ? currentValue : "all";
}

function renderStats() {
  const doneColumn = board.columns.find((column) => column.title.toLowerCase() === "done");
  const doneCards = doneColumn ? board.cards.filter((card) => card.columnId === doneColumn.id).length : 0;
  const totalCards = board.cards.length;
  els.statCards.textContent = totalCards;
  els.statDone.textContent = totalCards ? `${Math.round((doneCards / totalCards) * 100)}%` : "0%";
  els.statOverdue.textContent = board.cards.filter(isOverdue).length;
  els.statColumns.textContent = board.columns.length;
}

function exportWorkspace() {
  const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(board.title)}-workspace.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Workspace exported.");
}

function importWorkspace(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(reader.result);
      workspace = normalizeWorkspace(imported.boards ? imported : { activeBoardId: imported.id, boards: [imported] });
      board = getActiveBoard();
      addActivity("Imported workspace", `${file.name} was imported.`);
      saveAndRender();
      showToast("Import complete.");
    } catch {
      showToast("That file could not be imported.");
    } finally {
      els.importInput.value = "";
    }
  });
  reader.readAsText(file);
}

function resetBoard() {
  if (!confirm("Reset this board to the starter template? Other boards will stay intact.")) return;
  const index = workspace.boards.findIndex((item) => item.id === board.id);
  const replacement = createBoard("Product Roadmap");
  workspace.boards[index] = replacement;
  workspace.activeBoardId = replacement.id;
  board = replacement;
  addActivity("Reset board", `${board.title} was reset to the starter template.`);
  saveAndRender();
  showToast("Board reset.");
}

async function loadWorkspace() {
  if (location.protocol !== "file:") {
    try {
      const response = await fetch("/api/workspace", { headers: { "Accept": "application/json" } });
      if (response.ok && response.status !== 204) {
        storageMode = "sqlite";
        return normalizeWorkspace(await response.json());
      }
      if (response.status === 204) {
        storageMode = "sqlite";
      }
    } catch {
      storageMode = "local";
    }
  }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) return normalizeWorkspace(saved);
  } catch {
    // Fall through to legacy migration or seed workspace.
  }

  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    if (legacy) {
      const migrated = normalizeWorkspace({ activeBoardId: legacy.id, boards: [legacy] });
      migrated.boards[0].id = migrated.boards[0].id || createId("board");
      migrated.activeBoardId = migrated.boards[0].id;
      return migrated;
    }
  } catch {
    // Fall through to seed workspace.
  }

  const starter = createBoard("Product Roadmap");
  return { activeBoardId: starter.id, boards: [starter] };
}

function normalizeWorkspace(value) {
  const boards = Array.isArray(value?.boards) && value.boards.length ? value.boards.map(normalizeBoard) : [createBoard("Product Roadmap")];
  const activeBoardId = boards.some((item) => item.id === value?.activeBoardId) ? value.activeBoardId : boards[0].id;
  return { activeBoardId, boards };
}

function normalizeBoard(value) {
  const seeded = createBoard(value?.title || "Product Roadmap", false);
  const columns = Array.isArray(value?.columns) && value.columns.length ? value.columns : seeded.columns;
  const validColumnIds = new Set(columns.map((column) => column.id));
  const cards = Array.isArray(value?.cards) ? value.cards : seeded.cards;

  return {
    id: value?.id || createId("board"),
    title: typeof value?.title === "string" && value.title.trim() ? value.title : seeded.title,
    createdAt: Number(value?.createdAt) || Date.now(),
    updatedAt: Number(value?.updatedAt) || Date.now(),
    columns: columns.map((column) => ({
      id: column.id || createId("col"),
      title: column.title || "Untitled",
      accent: column.accent || "#2f7df6"
    })),
    cards: cards.map((card, index) => normalizeCard(card, validColumnIds, columns[0].id, index)),
    archive: Array.isArray(value?.archive) ? value.archive.map((card, index) => normalizeCard(card, validColumnIds, columns[0].id, index, true)) : [],
    activity: Array.isArray(value?.activity) ? value.activity.map(normalizeActivity).filter(Boolean) : []
  };
}

function normalizeCard(card, validColumnIds, fallbackColumnId, index, archived = false) {
  return {
    id: card.id || createId("card"),
    columnId: validColumnIds.has(card.columnId) ? card.columnId : fallbackColumnId,
    title: card.title || "Untitled card",
    description: card.description || "",
    priority: priorityOrder.includes(card.priority) ? card.priority : "medium",
    dueDate: card.dueDate || "",
    assignee: card.assignee || "",
    labels: Array.isArray(card.labels) ? card.labels.filter(Boolean).map(String) : [],
    checklist: Array.isArray(card.checklist)
      ? card.checklist.map((item) => ({ id: item.id || createId("check"), text: item.text || "", done: Boolean(item.done) })).filter((item) => item.text)
      : [],
    createdAt: Number(card.createdAt) || Date.now(),
    updatedAt: Number(card.updatedAt) || Date.now(),
    archivedAt: archived ? Number(card.archivedAt) || Date.now() : undefined,
    order: Number.isFinite(card.order) ? card.order : index
  };
}

function normalizeActivity(entry) {
  if (!entry || !entry.action || !entry.detail) return null;
  return {
    id: entry.id || createId("act"),
    action: String(entry.action),
    detail: String(entry.detail),
    at: Number(entry.at) || Date.now()
  };
}

function createBoard(title = "Product Roadmap", includeStarterCards = true) {
  const columns = seedColumns.map((column) => ({ ...column, id: createId("col") }));
  const board = {
    id: createId("board"),
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    columns,
    cards: [],
    archive: [],
    activity: []
  };

  if (includeStarterCards) {
    board.cards = [
      createCard(columns[0].id, "Gather customer feedback themes", "Review recent support notes and tag the strongest product opportunities.", "high", offsetDate(3), "Maya", ["Research", "Strategy"], ["Summarize support themes", "Pick top three opportunities"]),
      createCard(columns[1].id, "Sketch mobile board interactions", "Make drag states, quick-add behavior, and compact filtering feel natural on narrow screens.", "medium", offsetDate(6), "Nick", ["Design"], ["Draft narrow layout", "Review tap targets"]),
      createCard(columns[2].id, "Implement local persistence", "Persist board title, columns, card order, filters, and theme preference in the browser.", "urgent", offsetDate(1), "Sam", ["Frontend", "Core"], ["Save workspace", "Migrate old boards"]),
      createCard(columns[3].id, "Review launch checklist", "Confirm accessibility states, empty states, export flow, and reset safeguards.", "low", offsetDate(9), "Ari", ["QA", "Launch"], ["Keyboard pass", "Import/export pass"])
    ];
  }

  return board;
}

function createCard(columnId, title, description, priority, dueDate, assignee, labels, checklist) {
  return {
    id: createId("card"),
    columnId,
    title,
    description,
    priority,
    dueDate,
    assignee,
    labels,
    checklist: checklist.map((text) => ({ id: createId("check"), text, done: false })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    order: 0
  };
}

function getActiveBoard() {
  return workspace.boards.find((item) => item.id === workspace.activeBoardId) || workspace.boards[0];
}

function addActivity(action, detail) {
  board.activity.unshift({ id: createId("act"), action, detail, at: Date.now() });
  board.activity = board.activity.slice(0, 120);
  board.updatedAt = Date.now();
}

function saveAndRender() {
  board.updatedAt = Date.now();
  saveWorkspace();
  render();
}

function saveWorkspace() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  if (storageMode === "sqlite") {
    clearTimeout(serverSaveTimer);
    serverSaveTimer = setTimeout(saveWorkspaceToServer, 180);
  }
}

async function saveWorkspaceToServer() {
  try {
    const response = await fetch("/api/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workspace)
    });
    if (!response.ok) throw new Error(`Save failed: ${response.status}`);
  } catch {
    showToast("SQLite save failed. Local browser backup still updated.");
  }
}

function normalizeOrders() {
  board.columns.forEach((column) => renumberColumn(column.id));
}

function renumberColumn(columnId) {
  board.cards
    .filter((card) => card.columnId === columnId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt)
    .forEach((card, index) => {
      card.order = index;
    });
}

function nextOrderInColumn(columnId) {
  const orders = board.cards.filter((card) => card.columnId === columnId).map((card) => card.order ?? 0);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

function columnTitle(columnId) {
  return board.columns.find((column) => column.id === columnId)?.title || "another list";
}

function isOverdue(card) {
  if (!card.dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  const column = board.columns.find((item) => item.id === card.columnId);
  return card.dueDate < today && column?.title.toLowerCase() !== "done";
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function offsetDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseLabels(value) {
  return [...new Set(value.split(",").map((label) => label.trim()).filter(Boolean))];
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "kanban-board";
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
