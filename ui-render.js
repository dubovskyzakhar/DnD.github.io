import { combatants, spellCastingMode, setSpellMode } from './state.js';
import { DND_STATUSES, DND_SPELLS_DATA, DEFAULT_AVATAR } from './constants.js';

export function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const target = document.getElementById(tabId + '-tab');
    if (target) target.classList.add('active');
}

export function changeBackground(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const url = e.target.result;
            document.getElementById('main-bg').style.backgroundImage = `url(${url})`;
            localStorage.setItem('dnd_bg', url);
        };
        reader.readAsDataURL(file);
    }
}

export function renderCombatList() {
    const list = document.getElementById('character-list');
    if (!list) return;
    list.innerHTML = '';
    
    combatants.forEach((unit, index) => {
        if (!unit.mods) unit.mods = { shield: false, cover: null };
        if (!unit.statuses) unit.statuses = [];
        if (!unit.activeSpells) unit.activeSpells = [];

        const bonus = (unit.mods.shield ? 2 : 0) + 
                      (unit.mods.cover === '1/2' ? 2 : 0) + 
                      (unit.mods.cover === '3/4' ? 5 : 0);

        const div = document.createElement('div');
        div.className = `character-card ${unit.type === 'hero' ? 'hero-card' : 'monster-card'} ${unit.currentHp <= 0 ? 'unit-dead' : ''}`;
        div.id = `unit-${index}`;
        div.onclick = () => selectUnit(index);

        div.innerHTML = `
            <div class="card-header">
                <input type="text" value="${unit.name}" onchange="dndActions.updateName(${index}, this.value)">
                <div class="hp-container" onwheel="dndActions.changeHP(event, ${index})">
                    <span class="hp-current" onclick="dndActions.editHP(${index})">${unit.currentHp}</span>
                    <span class="hp-sep">/</span>
                    <span class="hp-max">${unit.maxHp}</span>
                </div>
            </div>

            <div class="card-body">
                <div class="avatar-container" onclick="document.getElementById('file-${index}').click()">
                    <img src="${unit.img || DEFAULT_AVATAR}" class="unit-avatar">
                    <input type="file" id="file-${index}" hidden onchange="dndActions.updateUnitPhoto(event, ${index})">
                    <div class="ac-badge" onclick="event.stopPropagation(); dndActions.editBaseAC(${index})">
                        🛡️ ${unit.ac + bonus}
                    </div>
                </div>

                <div class="controls">
                    <button class="mod-btn ${unit.mods.shield ? 'active' : ''}" onclick="event.stopPropagation(); dndActions.toggleMod(${index}, 'shield')">🛡️ Щит</button>
                    <button class="mod-btn ${unit.mods.cover === '1/2' ? 'active' : ''}" onclick="event.stopPropagation(); dndActions.toggleMod(${index}, '1/2')">½</button>
                    <button class="mod-btn ${unit.mods.cover === '3/4' ? 'active' : ''}" onclick="event.stopPropagation(); dndActions.toggleMod(${index}, '3/4')">¾</button>
                </div>

                <div class="init-badge" onclick="event.stopPropagation(); dndActions.editInit(${index})">
                    ⚡ ${unit.init || 0}
                </div>
            </div>

            <div class="card-footer">
                <div class="status-tokens">
                    ${unit.statuses.map(s => `<span class="status-dot" title="${s}">${s[0]}</span>`).join('')}
                    ${unit.activeSpells.map(s => `<span class="spell-dot" title="${s.name} (от ${s.casterName})">${DND_SPELLS_DATA[s.name] || '🪄'}</span>`).join('')}
                </div>
                <button class="menu-btn" onclick="event.stopPropagation(); toggleStatusMenu(${index})">⋮</button>
            </div>
            <div id="status-menu-${index}" class="status-dropdown"></div>
        `;
        list.appendChild(div);
    });
}

export function selectUnit(index) {
    if (spellCastingMode) {
        window.dndActions.applySpellEffect(spellCastingMode.casterIndex, index, spellCastingMode.spellName);
        setSpellMode(null);
        renderCombatList();
        return;
    }
    document.querySelectorAll('.character-card').forEach(card => card.classList.remove('selected'));
    const target = document.getElementById(`unit-${index}`);
    if (target) target.classList.add('selected');
}

export function toggleStatusMenu(index) {
    const menu = document.getElementById(`status-menu-${index}`);
    const card = document.getElementById(`unit-${index}`);
    const isVisible = menu.style.display === 'grid';

    document.querySelectorAll('.status-dropdown').forEach(m => m.style.display = 'none');
    document.querySelectorAll('.character-card').forEach(c => c.classList.remove('has-open-menu'));

    if (!isVisible) {
        menu.style.display = 'grid';
        card.classList.add('has-open-menu');
        menu.innerHTML = `
            <div class="status-section-title">Статусы</div>
            ${DND_STATUSES.map(s => `<div class="status-option" onclick="dndActions.toggleStatus(${index}, '${s}')">${s}</div>`).join('')}
            <div class="status-section-title">Магия</div>
            ${Object.keys(DND_SPELLS_DATA).map(s => `<div class="status-option spell-option" onclick="dndActions.startSpellCasting(${index}, '${s}')">${DND_SPELLS_DATA[s]} ${s}</div>`).join('')}
            <div class="status-section-title">Управление</div>
            <div class="status-option delete-option" onclick="dndActions.deleteUnit(${index})">Удалить</div>
            <div class="status-option clone-option" onclick="dndActions.cloneUnit(${index})">Клон</div>
        `;
    }
}
