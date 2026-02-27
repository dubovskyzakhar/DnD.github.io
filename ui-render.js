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
        const totalAC = (parseInt(unit.ac) || 0) + bonus;
        const isDead = (parseInt(unit.currentHp) <= 0);
        const isCaster = (spellCastingMode && spellCastingMode.casterIndex === index);

        const div = document.createElement('div');
        div.className = `character-card ${unit.type === 'monster' ? 'monster-card' : ''} ${isDead ? 'unit-dead' : ''} ${isCaster ? 'casting-source' : ''}`;
        div.id = `unit-${index}`;
        
        div.onclick = (e) => {
            if (!['BUTTON', 'INPUT', 'IMG'].includes(e.target.tagName) && !e.target.classList.contains('status-tag')) {
                selectUnit(index);
            }
        };

        const statusIcons = unit.statuses.map(s => 
            `<span class="status-tag" onclick="event.stopPropagation(); dndActions.toggleStatus(${index}, '${s}')">${s} ×</span>`
        ).join('');

        const spellIcons = unit.activeSpells.map((spell, sIdx) => `
            <div class="spell-badge" onclick="event.stopPropagation(); dndActions.removeSpell(${index}, ${sIdx});">
                <img src="${spell.casterImg || DEFAULT_AVATAR}" class="mini-caster-avatar">
                <span class="spell-name-text">${DND_SPELLS_DATA[spell.name] || '✨'} ${spell.name}</span>
            </div>`).join('');

        div.innerHTML = `
            <div class="avatar-container">
                <img src="${unit.img || DEFAULT_AVATAR}" class="avatar" onerror="this.src='${DEFAULT_AVATAR}';">
                <div class="ac-badge" onclick="event.stopPropagation(); dndActions.editBaseAC(${index})">
                    ${totalAC}
                </div>
            </div>
            <div class="unit-info">
                <strong>${unit.name}</strong>
                <span class="init-value" onclick="event.stopPropagation(); dndActions.editInit(${index})">${unit.init}</span>
                <div class="status-container">
                    <div class="active-statuses">${statusIcons}${spellIcons}</div>
                    <button class="add-status-btn" onclick="event.stopPropagation(); toggleStatusMenu(${index})">✚</button>
                    <div id="status-menu-${index}" class="status-dropdown" onclick="event.stopPropagation()"></div>
                </div>
            </div>
            <div class="right-controls-group">
                <div class="mod-buttons">
                    <button class="shield-btn ${unit.mods.shield ? 'active' : ''}" onclick="event.stopPropagation(); dndActions.toggleMod(${index}, 'shield')">🛡️</button>
                </div>
                <div class="hp-heart-container" onclick="event.stopPropagation(); dndActions.editHP(${index})" onwheel="dndActions.changeHP(event, ${index})">
                    <svg viewBox="0 0 32 32" class="hp-heart-svg"><path d="M16,28.261c0,0-14-7.926-14-17.046c0-9.356,13.159-10.399,14,0.454c0.841-10.853,14-9.81,14-0.454 C30,20.335,16,28.261,16,28.261z" fill="#9e2121"/></svg>
                    <div class="hp-text-overlay">${unit.currentHp}/${unit.maxHp}</div>
                </div>
                <button class="delete-btn" onclick="event.stopPropagation(); dndActions.deleteUnit(${index})">🗑️</button>
            </div>`;
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
        `;
    }
}
