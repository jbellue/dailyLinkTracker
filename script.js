let isEditMode = false;

const loadGamesFromStorage = () => {
    try {
        const raw = localStorage.getItem('daily_games_rotation');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
};

let games = loadGamesFromStorage();

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

    games = games.map(game => {
        if (!game.played || !game.lastChecked) return game;

        const lastCheckedDate = new Date(game.lastChecked);
        const [resetHour, resetMin] = parseResetTime(game.time);
        
        let resetDeadline = new Date(now.getFullYear(), now.getMonth(), now.getDate(), resetHour, resetMin, 0);

        if (now < resetDeadline) {
            resetDeadline.setDate(resetDeadline.getDate() - 1);
        }

        if (lastCheckedDate < resetDeadline) {
            stateChanged = true;
            return { ...game, played: false, lastChecked: null };
        }
        return game;
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
}

const saveToStorage = () => {
    localStorage.setItem('daily_games_rotation', JSON.stringify(games));
};

const handleSubmit = () => {
    const urlIn = document.getElementById('urlInput');
    const nameIn = document.getElementById('nameInput');
    const timeIn = document.getElementById('timeInput');
    const editIdIn = document.getElementById('editId');

    let urlVal = urlIn.value.trim();
    let nameVal = nameIn.value.trim();
    let timeVal = timeIn.value || '00:00';

    if (!urlVal) return alert('Please enter a game URL.');
    if (!/^https?:\/\//i.test(urlVal)) urlVal = 'https://' + urlVal;

    try {
        const host = new URL(urlVal).hostname;
        if (!nameVal) {
            let cleaned = host.replace('www.', '').split('.')[0];
            nameVal = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        }

        if (editIdIn.value) {
            const targetId = parseInt(editIdIn.value);
            games = games.map(g => g.id === targetId ? { ...g, name: nameVal, url: urlVal, time: timeVal } : g);
        } else {
            games.push({ id: Date.now(), name: nameVal, url: urlVal, time: timeVal, played: false, lastChecked: null });
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
    const game = games.find(g => g.id === id);
    if (!game) return;

    document.getElementById('urlInput').value = game.url;
    document.getElementById('nameInput').value = game.name;
    document.getElementById('timeInput').value = game.time;
    document.getElementById('editId').value = game.id;
    document.getElementById('submitBtn').textContent = '💾 Update';
    document.getElementById('urlInput').focus();
};

const toggleCheck = (id) => {
    games = games.map(g => g.id === id ? { ...g, played: !g.played, lastChecked: !g.played ? new Date().toISOString() : null } : g);
    saveToStorage();
    renderList();
};

const deleteGame = (id) => {
    games = games.filter(g => g.id !== id);
    saveToStorage();
    if(document.getElementById('editId').value == id) resetForm();
    renderList();
};

const handlePlayClick = (id) => {
    setTimeout(() => {
        games = games.map(g => g.id === id ? { ...g, played: true, lastChecked: new Date().toISOString() } : g);
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
    const container = document.getElementById('gameContainer');
    container.innerHTML = '';

    if (games.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No link tracked.';
        container.appendChild(empty);
        return;
    }

    games.forEach((game) => {
        const gameId = Number(game.id);
        if (!Number.isFinite(gameId)) return;

        const safeUrl = normalizeExternalUrl(game.url);
        let hostname = '';
        if (safeUrl !== '#') {
            try {
                hostname = new URL(safeUrl).hostname;
            } catch (e) {}
        }
        const faviconSrc = hostname
            ? `https://icons.duckduckgo.com/ip3/${encodeURIComponent(hostname)}.ico`
            : 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23888%22><rect width=%2224%22 height=%2224%22 rx=%224%22/></svg>';
        const displayName = typeof game.name === 'string' && game.name.trim() ? game.name : 'Untitled';
        const displayTime = typeof game.time === 'string' ? game.time : '00:00';

        const item = document.createElement('div');
        item.className = `game-item ${game.played ? 'played' : ''} ${isEditMode ? 'editing-row' : ''}`;
        item.setAttribute('draggable', isEditMode ? 'true' : 'false');
        item.setAttribute('data-id', String(gameId));

        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.textContent = '☰';
        item.appendChild(dragHandle);

        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'checkbox-container';
        const checkboxInput = document.createElement('input');
        checkboxInput.className = 'checkbox-input';
        checkboxInput.type = 'checkbox';
        checkboxInput.checked = Boolean(game.played);
        checkboxInput.setAttribute('aria-label', game.played ? 'Mark as not played' : 'Mark as played');
        checkboxInput.addEventListener('change', () => toggleCheck(gameId));
        checkboxContainer.appendChild(checkboxInput);
        item.appendChild(checkboxContainer);

        const icon = document.createElement('img');
        icon.className = 'game-icon';
        icon.src = faviconSrc;
        icon.alt = '';
        icon.addEventListener('error', () => {
            icon.src = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23888%22><rect width=%2224%22 height=%2224%22 rx=%224%22/></svg>';
        });
        item.appendChild(icon);

        const gameInfo = document.createElement('div');
        gameInfo.className = 'game-info';
        const gameTitle = document.createElement('div');
        gameTitle.className = 'game-title';
        gameTitle.textContent = displayName;
        const gameMeta = document.createElement('div');
        gameMeta.className = 'game-meta';
        gameMeta.textContent = `Resets at ${displayTime}`;
        gameInfo.appendChild(gameTitle);
        gameInfo.appendChild(gameMeta);
        item.appendChild(gameInfo);

        const playLink = document.createElement('a');
        playLink.className = 'play-link';
        playLink.textContent = 'OPEN ↗';
        if (safeUrl !== '#') {
            playLink.href = safeUrl;
            playLink.target = '_blank';
            playLink.rel = 'noopener noreferrer';
            playLink.addEventListener('click', () => handlePlayClick(gameId));
        } else {
            playLink.classList.add('disabled');
            playLink.setAttribute('aria-disabled', 'true');
            playLink.tabIndex = -1;
        }
        item.appendChild(playLink);

        const rowActions = document.createElement('div');
        rowActions.className = 'row-actions';
        const editBtn = document.createElement('button');
        editBtn.className = 'inline-btn edit';
        editBtn.type = 'button';
        editBtn.textContent = '✏️';
        editBtn.setAttribute('aria-label', `Edit ${displayName}`);
        editBtn.addEventListener('click', () => startInlineEdit(gameId));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'inline-btn del';
        deleteBtn.type = 'button';
        deleteBtn.textContent = '🗑️';
        deleteBtn.setAttribute('aria-label', `Delete ${displayName}`);
        deleteBtn.addEventListener('click', () => deleteGame(gameId));

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
    games = [...document.querySelectorAll('.game-item')].map(row => games.find(g => g.id === parseInt(row.getAttribute('data-id')))).filter(Boolean);
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
    const container = document.getElementById('gameContainer');
    if (container) {
        container.addEventListener('dragover', e => {
            if (!isEditMode) return;
            e.preventDefault();
            const draggingElement = document.querySelector('.dragging');
            if (!draggingElement) return;
            const afterElement = [...container.querySelectorAll('.game-item:not(.dragging)')].reduce((closest, child) => {
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
