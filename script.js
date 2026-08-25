lucide.createIcons();

let dirHandle = null;
let currentFileHandle = null;
let targetFileHandle = null;

let historyStack = [];
let redoStack = [];

const btnSelectFolder = document.getElementById('btnSelectFolder');
const btnNewFile = document.getElementById('btnNewFile');
const btnSave = document.getElementById('btnSave');
const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');
const btnCopyAll = document.getElementById('btnCopyAll');
const fileListEl = document.getElementById('fileList');
const blocksContainer = document.getElementById('blocksContainer');
const subtitlesList = document.getElementById('subtitlesList');
const docTitle = document.getElementById('docTitle');
const contextMenu = document.getElementById('contextMenu');

function saveState() {
  const state = [];
  document.querySelectorAll('.block-card').forEach(card => {
    state.push({
      subtitle: card.querySelector('.subtitle-input').value,
      content: card.querySelector('.block-content').innerHTML
    });
  });
  historyStack.push(JSON.stringify(state));
  redoStack = [];
}

function restoreState(jsonState) {
  blocksContainer.innerHTML = '';
  const data = JSON.parse(jsonState);
  data.forEach(b => createBlock(b.subtitle, b.content, null, false));
  updateSubtitlesNav();
}

btnUndo.addEventListener('click', () => {
  if (historyStack.length > 1) {
    redoStack.push(historyStack.pop());
    restoreState(historyStack[historyStack.length - 1]);
  }
});

btnRedo.addEventListener('click', () => {
  if (redoStack.length > 0) {
    const nextState = redoStack.pop();
    historyStack.push(nextState);
    restoreState(nextState);
  }
});

btnSelectFolder.addEventListener('click', async () => {
  try {
    dirHandle = await window.showDirectoryPicker();
    await loadFiles();
  } catch (err) {}
});

async function loadFiles() {
  fileListEl.innerHTML = '';
  if (!dirHandle) return;
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.txt')) {
      const cleanName = entry.name.replace('.txt', '');
      const item = document.createElement('div');
      item.className = 'file-item';
      if (currentFileHandle && currentFileHandle.name === entry.name) {
        item.classList.add('active');
      }
      item.innerHTML = `<i data-lucide="file-text" style="width:16px;height:16px;"></i> <span>${cleanName}</span>`;
      item.onclick = () => openFile(entry, item);
      item.oncontextmenu = (e) => showContextMenu(e, entry);
      fileListEl.appendChild(item);
    }
  }
  lucide.createIcons();
}

async function openFile(fileHandle, element) {
  currentFileHandle = fileHandle;
  document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
  if (element) element.classList.add('active');

  const file = await fileHandle.getFile();
  const rawText = await file.text();

  docTitle.value = fileHandle.name.replace('.txt', '');
  docTitle.disabled = false;
  blocksContainer.innerHTML = '';
  historyStack = [];
  redoStack = [];

  try {
    const data = JSON.parse(rawText);
    data.forEach(blockData => createBlock(blockData.subtitle, blockData.content, null, false));
  } catch (e) {
    createBlock("NUEVO SUBTÍTULO", rawText, null, false);
  }
  updateSubtitlesNav();
  saveState();
}

function updateSubtitlesNav() {
  subtitlesList.innerHTML = '';
  const blocks = document.querySelectorAll('.block-card');

  blocks.forEach((card, index) => {
    const input = card.querySelector('.subtitle-input');
    const titleText = input.value.trim() || `Subtítulo ${index + 1}`;

    const navItem = document.createElement('div');
    navItem.className = 'nav-sub-item';

    const textSpan = document.createElement('span');
    textSpan.textContent = titleText;

    const delBtn = document.createElement('button');
    delBtn.className = 'nav-delete-btn';
    delBtn.innerHTML = `<i data-lucide="trash-2" style="width:12px;height:12px;"></i>`;
    delBtn.title = "Eliminar cuadro";

    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (document.querySelectorAll('.block-card').length > 1) {
        card.remove();
        updateSubtitlesNav();
        saveState();
      }
    });

    navItem.appendChild(textSpan);
    navItem.appendChild(delBtn);

    navItem.addEventListener('click', () => {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightFocusedCard(card);
    });

    subtitlesList.appendChild(navItem);
  });
  lucide.createIcons();
}

function highlightFocusedCard(activeCard) {
  document.querySelectorAll('.block-card').forEach(c => c.classList.remove('focused'));
  activeCard.classList.add('focused');
}

function createBlock(subtitleText = "NUEVO SUBTÍTULO", contentText = "", afterElement = null, recordState = true) {
  const card = document.createElement('div');
  card.className = 'block-card';

  card.innerHTML = `
    <div class="block-header">
      <input type="text" class="subtitle-input" value="${subtitleText}" placeholder="SUBTÍTULO...">
    </div>
    <div class="block-content" contenteditable="true">${contentText}</div>
    <div class="block-actions">
      <button class="btn-block-action add" title="Añadir cuadro debajo">
        <i data-lucide="plus" style="width:14px;height:14px;"></i>
      </button>
    </div>
  `;

  const subInput = card.querySelector('.subtitle-input');

  subInput.addEventListener('focus', () => {
    if (subInput.value === "NUEVO SUBTÍTULO") {
      subInput.value = "";
    }
    highlightFocusedCard(card);
  });

  subInput.addEventListener('blur', () => {
    if (subInput.value.trim() === "") {
      subInput.value = "NUEVO SUBTÍTULO";
    }
    updateSubtitlesNav();
    saveState();
  });

  subInput.addEventListener('input', updateSubtitlesNav);

  card.querySelector('.block-content').addEventListener('focus', () => highlightFocusedCard(card));
  card.querySelector('.block-content').addEventListener('blur', saveState);

  card.querySelector('.btn-block-action.add').addEventListener('click', () => {
    createBlock("NUEVO SUBTÍTULO", "", card);
    updateSubtitlesNav();
  });

  if (afterElement && afterElement.nextSibling) {
    blocksContainer.insertBefore(card, afterElement.nextSibling);
  } else {
    blocksContainer.appendChild(card);
  }

  lucide.createIcons();
  updateSubtitlesNav();
  if (recordState) saveState();
}

async function syncTitleFile() {
  if (!dirHandle) return;

  let title = docTitle.value.trim();

  if (!title) {
    const firstSub = document.querySelector('.subtitle-input');
    if (firstSub && firstSub.value.trim() && firstSub.value !== "NUEVO SUBTÍTULO") {
      title = firstSub.value.trim();
    } else {
      title = "Sin_titulo";
    }
    docTitle.value = title;
  }

  const newFileName = `${title}.txt`;

  if (currentFileHandle && currentFileHandle.name !== newFileName) {
    const oldName = currentFileHandle.name;
    const documentData = getDocumentContentData();

    currentFileHandle = await dirHandle.getFileHandle(newFileName, { create: true });
    const writable = await currentFileHandle.createWritable();
    await writable.write(JSON.stringify(documentData, null, 2));
    await writable.close();

    await dirHandle.removeEntry(oldName);
  } else if (!currentFileHandle) {
    currentFileHandle = await dirHandle.getFileHandle(newFileName, { create: true });
    const documentData = getDocumentContentData();
    const writable = await currentFileHandle.createWritable();
    await writable.write(JSON.stringify(documentData, null, 2));
    await writable.close();
  }

  await loadFiles();
}

function getDocumentContentData() {
  const documentData = [];
  document.querySelectorAll('.block-card').forEach(card => {
    documentData.push({
      subtitle: card.querySelector('.subtitle-input').value,
      content: card.querySelector('.block-content').innerHTML
    });
  });
  return documentData;
}

docTitle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    docTitle.blur();
  }
});

docTitle.addEventListener('blur', syncTitleFile);

btnNewFile.addEventListener('click', () => {
  if (!dirHandle) return alert('Selecciona una carpeta primero.');

  currentFileHandle = null;
  docTitle.value = '';
  docTitle.disabled = false;
  docTitle.placeholder = "Título del Documento...";
  blocksContainer.innerHTML = '';

  document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));

  createBlock("NUEVO SUBTÍTULO", "");
  docTitle.focus();
});

btnSave.addEventListener('click', async () => {
  if (!dirHandle) return alert('Selecciona una carpeta primero.');
  await syncTitleFile();

  const documentData = getDocumentContentData();
  const writable = await currentFileHandle.createWritable();
  await writable.write(JSON.stringify(documentData, null, 2));
  await writable.close();

  alert('¡Documento guardado con éxito!');
});

// Copiar todo el documento al portapapeles
btnCopyAll.addEventListener('click', async () => {
  let fullText = "";

  const title = docTitle.value.trim();
  if (title) {
    fullText += `${title.toUpperCase()}\n\n`;
  }

  document.querySelectorAll('.block-card').forEach((card) => {
    const subtitle = card.querySelector('.subtitle-input').value.trim();
    const contentEl = card.querySelector('.block-content');
    const content = contentEl.innerText.trim();

    if (subtitle && subtitle !== "NUEVO SUBTÍTULO") {
      fullText += `--- ${subtitle} ---\n`;
    }

    if (content) {
      fullText += `${content}\n\n`;
    }
  });

  if (!fullText.trim()) {
    alert('No hay contenido para copiar.');
    return;
  }

  try {
    await navigator.clipboard.writeText(fullText.trim());
    const originalHTML = btnCopyAll.innerHTML;
    btnCopyAll.innerHTML = `<i data-lucide="check" style="width:16px;height:16px;"></i> ¡Copiado!`;
    lucide.createIcons();

    setTimeout(() => {
      btnCopyAll.innerHTML = originalHTML;
      lucide.createIcons();
    }, 2000);
  } catch (err) {
    console.error('Error al copiar: ', err);
    alert('No se pudo copiar el texto al portapapeles.');
  }
});

function showContextMenu(e, fileHandle) {
  e.preventDefault();
  targetFileHandle = fileHandle;
  contextMenu.style.top = `${e.clientY}px`;
  contextMenu.style.left = `${e.clientX}px`;
  contextMenu.style.display = 'block';
}

document.addEventListener('click', () => contextMenu.style.display = 'none');

document.getElementById('ctxDelete').addEventListener('click', async () => {
  if (targetFileHandle) {
    await dirHandle.removeEntry(targetFileHandle.name);
    if (currentFileHandle && currentFileHandle.name === targetFileHandle.name) {
      blocksContainer.innerHTML = '';
      subtitlesList.innerHTML = '';
      docTitle.value = '';
      docTitle.disabled = true;
      currentFileHandle = null;
    }
    await loadFiles();
  }
});

document.getElementById('ctxRename').addEventListener('click', async () => {
  if (!targetFileHandle) return;
  const oldName = targetFileHandle.name.replace('.txt', '');
  docTitle.value = oldName;
  docTitle.focus();
});

document.getElementById('ctxDuplicate').addEventListener('click', async () => {
  if (!targetFileHandle) return;
  const file = await targetFileHandle.getFile();
  const content = await file.text();
  const copyName = `Copia_${targetFileHandle.name}`;

  const copyHandle = await dirHandle.getFileHandle(copyName, { create: true });
  const writable = await copyHandle.createWritable();
  await writable.write(content);
  await writable.close();

  await loadFiles();
});