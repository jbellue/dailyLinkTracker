let isEditMode = false;

const loadLinksFromStorage = () => {
    try {
        const raw = localStorage.getItem('daily_links_rotation');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
};

let links = loadLinksFromStorage();

const parseResetTime = (timeValue) => {
    const fallback = [0, 0];
    if (typeof timeValue !== 'string') return fallback;

    const match = timeValue.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return fallback;

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallback;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;

    return [hour, minute];
};

const processAutoResets = () => {
    const now = new Date();
    let stateChanged = false;

    links = links.map(link => {
        if (!link.opened || !link.lastChecked) return link;

        const lastCheckedDate = new Date(link.lastChecked);
        const [resetHour, resetMin] = parseResetTime(link.time);
        
        let resetDeadline = new Date(now.getFullYear(), now.getMonth(), now.getDate(), resetHour, resetMin, 0);

        if (now < resetDeadline) {
            resetDeadline.setDate(resetDeadline.getDate() - 1);
        }

        if (lastCheckedDate < resetDeadline) {
            stateChanged = true;
            return { ...link, opened: false, lastChecked: null };
        }
        return link;
    });

    if (stateChanged) saveToStorage();
};

const toggleMode = () => {
    isEditMode = !isEditMode;
    document.body.classList.toggle('mode-edit', isEditMode);
    const btn = document.getElementById('modeBtn');
    btn.textContent = isEditMode ? '💾' : '✏️';
    const buttonLabel = isEditMode ? 'Exit edit mode and save' : 'Enable edit mode';
    btn.setAttribute('aria-label', buttonLabel);
    btn.title = buttonLabel;
    btn.classList.toggle('editing', isEditMode);
    document.getElementById('headerTitle').textContent = isEditMode ? '⚙️ Manage List' : '🎮 Link Tracker';
    
    if (!isEditMode) resetForm();
    renderList();
};

const saveToStorage = () => {
    localStorage.setItem('daily_links_rotation', JSON.stringify(links));
};

const handleSubmit = () => {
    const urlIn = document.getElementById('urlInput');
    const nameIn = document.getElementById('nameInput');
    const timeIn = document.getElementById('timeInput');
    const editIdIn = document.getElementById('editId');

    let urlVal = urlIn.value.trim();
    let nameVal = nameIn.value.trim();
    let timeVal = timeIn.value || '00:00';

    if (!urlVal) return alert('Please enter a link URL.');
    if (!/^https?:\/\//i.test(urlVal)) urlVal = 'https://' + urlVal;

    try {
        const host = new URL(urlVal).hostname;
        if (!nameVal) {
            let cleaned = host.replace('www.', '').split('.')[0];
            nameVal = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        }

        if (editIdIn.value) {
            const targetId = parseInt(editIdIn.value);
            links = links.map(l => l.id === targetId ? { ...l, name: nameVal, url: urlVal, time: timeVal } : l);
        } else {
            links.push({ id: Date.now(), name: nameVal, url: urlVal, time: timeVal, opened: false, lastChecked: null });
        }

        saveToStorage();
        resetForm();
        renderList();
    } catch (e) {
        alert('Invalid URL format.');
    }
};

const resetForm = () => {
    document.getElementById('urlInput').value = '';
    document.getElementById('nameInput').value = '';
    document.getElementById('timeInput').value = '00:00';
    document.getElementById('editId').value = '';
    document.getElementById('submitBtn').textContent = '＋ Add';
};

const startInlineEdit = (id) => {
    const link = links.find(l => l.id === id);
    if (!link) return;

    document.getElementById('urlInput').value = link.url;
    document.getElementById('nameInput').value = link.name;
    document.getElementById('timeInput').value = link.time;
    document.getElementById('editId').value = link.id;
    document.getElementById('submitBtn').textContent = '💾 Update';
    document.getElementById('urlInput').focus();
};

const toggleCheck = (id) => {
    links = links.map(l => l.id === id ? { ...l, opened: !l.opened, lastChecked: !l.opened ? new Date().toISOString() : null } : l);
    saveToStorage();
    renderList();
};

const deleteLink = (id) => {
    links = links.filter(l => l.id !== id);
    saveToStorage();
    if(document.getElementById('editId').value == id) resetForm();
    renderList();
};

const handleOpenClick = (id) => {
    setTimeout(() => {
        links = links.map(l => l.id === id ? { ...l, opened: true, lastChecked: new Date().toISOString() } : l);
        saveToStorage();
        renderList();
    }, 300);
};

const normalizeExternalUrl = (rawUrl) => {
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
    } catch (e) {}
    return '#';
};

const renderList = () => {
    processAutoResets();
    const container = document.getElementById('linkContainer');
    container.innerHTML = '';

    if (links.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No link tracked';
        container.appendChild(empty);
        return;
    }

    links.forEach((link) => {
        const linkId = Number(link.id);
        if (!Number.isFinite(linkId)) return;

        const safeUrl = normalizeExternalUrl(link.url);
        let hostname = '';
        if (safeUrl !== '#') {
            try {
                hostname = new URL(safeUrl).hostname;
            } catch (e) {}
        }
        const faviconSrc = hostname
            ? `https://icons.duckduckgo.com/ip3/${encodeURIComponent(hostname)}.ico`
            : 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23888%22><rect width=%2224%22 height=%2224%22 rx=%224%22/></svg>';
        const displayName = typeof link.name === 'string' && link.name.trim() ? link.name : 'Untitled';
        const displayTime = typeof link.time === 'string' ? link.time : '00:00';

        const item = document.createElement('div');
        item.className = `link-item ${link.opened ? 'opened' : ''} ${isEditMode ? 'editing-row' : ''}`;
        item.setAttribute('draggable', isEditMode ? 'true' : 'false');
        item.setAttribute('data-id', String(linkId));

        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.textContent = '☰';
        item.appendChild(dragHandle);

        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'checkbox-container';
        const checkboxInput = document.createElement('input');
        checkboxInput.className = 'checkbox-input';
        checkboxInput.type = 'checkbox';
        checkboxInput.checked = Boolean(link.opened);
        checkboxInput.setAttribute('aria-label', link.opened ? 'Mark as not opened' : 'Mark as opened');
        checkboxInput.addEventListener('change', () => toggleCheck(linkId));
        checkboxContainer.appendChild(checkboxInput);
        item.appendChild(checkboxContainer);

        const icon = document.createElement('img');
        icon.className = 'link-icon';
        icon.src = faviconSrc;
        icon.alt = '';
        icon.addEventListener('error', () => {
            icon.src = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23888%22><rect width=%2224%22 height=%2224%22 rx=%224%22/></svg>';
        });
        item.appendChild(icon);

        const linkInfo = document.createElement('div');
        linkInfo.className = 'link-info';
        const linkTitle = document.createElement('div');
        linkTitle.className = 'link-title';
        linkTitle.textContent = displayName;
        const linkMeta = document.createElement('div');
        linkMeta.className = 'link-meta';
        linkMeta.textContent = `Resets at ${displayTime}`;
        linkInfo.appendChild(linkTitle);
        linkInfo.appendChild(linkMeta);
        item.appendChild(linkInfo);

        const openLink = document.createElement('a');
        openLink.className = 'open-link';
        openLink.textContent = 'OPEN ↗';
        if (safeUrl !== '#') {
            openLink.href = safeUrl;
            openLink.target = `LinkTracker_${linkId}`; // Reuse tab
            openLink.rel = 'noopener noreferrer';
            openLink.addEventListener('click', () => handleOpenClick(linkId));
        } else {
            openLink.classList.add('disabled');
            openLink.setAttribute('aria-disabled', 'true');
            openLink.tabIndex = -1;
        }
        item.appendChild(openLink);

        const rowActions = document.createElement('div');
        rowActions.className = 'row-actions';
        const editBtn = document.createElement('button');
        editBtn.className = 'inline-btn edit';
        editBtn.type = 'button';
        editBtn.textContent = '✏️';
        editBtn.setAttribute('aria-label', `Edit ${displayName}`);
        editBtn.addEventListener('click', () => startInlineEdit(linkId));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'inline-btn del';
        deleteBtn.type = 'button';
        deleteBtn.textContent = '🗑️';
        deleteBtn.setAttribute('aria-label', `Delete ${displayName}`);
        deleteBtn.addEventListener('click', () => deleteLink(linkId));

        rowActions.appendChild(editBtn);
        rowActions.appendChild(deleteBtn);
        item.appendChild(rowActions);

        if (isEditMode) {
            item.addEventListener('dragstart', () => item.classList.add('dragging'));
            item.addEventListener('dragend', () => { item.classList.remove('dragging'); reorderArray(); });
        }
        container.appendChild(item);
    });
};

const reorderArray = () => {
    links = [...document.querySelectorAll('.link-item')].map(row => links.find(g => g.id === parseInt(row.getAttribute('data-id')))).filter(Boolean);
    saveToStorage();
};

// Set up event listeners after DOM is ready
const init = () => {
    // Mode toggle button
    const modeBtn = document.getElementById('modeBtn');
    if (modeBtn) {
        modeBtn.addEventListener('click', toggleMode);
    }

    // Submit form
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', handleSubmit);
    }

    // Allow Enter key to submit
    const urlInput = document.getElementById('urlInput');
    if (urlInput) {
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            }
        });
    }

    const nameInput = document.getElementById('nameInput');
    if (nameInput) {
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            }
        });
    }

    // Drag and drop on container
    const container = document.getElementById('linkContainer');
    if (container) {
        container.addEventListener('dragover', e => {
            if (!isEditMode) return;
            e.preventDefault();
            const draggingElement = document.querySelector('.dragging');
            if (!draggingElement) return;
            const afterElement = [...container.querySelectorAll('.link-item:not(.dragging)')].reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = e.clientY - box.top - box.height / 2;
                return (offset < 0 && offset > closest.offset) ? { offset: offset, element: child } : closest;
            }, { offset: Number.NEGATIVE_INFINITY }).element;

            if (afterElement == null) container.appendChild(draggingElement);
            else container.insertBefore(draggingElement, afterElement);
        });
    }

    // Initial render
    renderList();
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
