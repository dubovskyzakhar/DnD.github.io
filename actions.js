// 1. Правильные импорты
import { combatants, saveData, updateCombatants } from './state.js';
import { renderCombatList, switchTab } from './ui-render.js';
import { API_URL, DND_STATUSES } from './constants.js';

// --- 1. УПРАВЛЕНИЕ СПИСКОМ ---

export function deleteUnit(index) {
    if (confirm("Удалить этого бойца?")) { 
        combatants.splice(index, 1); 
        saveData(); 
        renderCombatList(); 
    }
}

export function cloneUnit(index) {
    const unit = combatants[index];
    const count = prompt(`Сколько клонов "${unit.name}" создать?`, "1");
    if (!count || isNaN(count)) return;

    for (let i = 0; i < parseInt(count); i++) {
        const baseName = unit.name.replace(/_\d+$/, "");
        const existingCount = combatants.filter(c => c.name.startsWith(baseName)).length;
        
        const clone = JSON.parse(JSON.stringify(unit));
        clone.name = `${baseName}_${existingCount + 1}`;
        clone.currentHp = clone.maxHp; 
        clone.mods = { shield: false, cover: null };
        
        combatants.push(clone);
    }
    saveData();
    renderCombatList();
}

export function quickAddUnit() {
    const newUnit = {
        name: "Новый боец",
        maxHp: 10,
        currentHp: 10,
        ac: 10,
        init: 0,
        type: "monster",
        img: "",
        statuses: [],
        activeSpells: [],
        mods: { shield: false, cover: null }
    };
    combatants.push(newUnit);
    saveData();
    renderCombatList();
}

export async function addMonsterManual() {
    const name = document.getElementById('monster-name')?.value;
    const hp = parseInt(document.getElementById('monster-hp')?.value);
    const ac = parseInt(document.getElementById('monster-ac')?.value) || 10;
    const img = document.getElementById('monster-img')?.value || "";

    if (!name || !hp) return alert("Введите имя и ОЗ монстра!");

    const rowData = [name, hp, ac, img];
    
    // Отправка в Google Sheets
    await sendDataToSheets('Enemies', 'add', rowData);
    
    alert(`Монстр ${name} добавлен в базу!`);
    
    // Очистка полей
    document.getElementById('monster-name').value = "";
    document.getElementById('monster-hp').value = "";
}

// --- 2. ИЗМЕНЕНИЕ ПАРАМЕТРОВ ---

export function editHP(index) {
    let newVal = prompt("Установить текущее HP:", combatants[index].currentHp);
    if (newVal !== null) { 
        combatants[index].currentHp = parseInt(newVal) || 0; 
        saveData(); 
        renderCombatList(); 
    }
}

export function changeHP(e, index) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    combatants[index].currentHp = Math.max(0, parseInt(combatants[index].currentHp) + delta);
    saveData(); 
    renderCombatList();
}

export function editInit(index) {
    let newVal = prompt("Установить инициативу:", combatants[index].init);
    if (newVal !== null) { 
        combatants[index].init = parseInt(newVal) || 0; 
        combatants.sort((a, b) => (b.init || 0) - (a.init || 0));
        saveData(); 
        renderCombatList(); 
    }
}

export function toggleStatus(index, status) {
    if (!combatants[index].statuses) combatants[index].statuses = [];
    const statusIndex = combatants[index].statuses.indexOf(status);
    statusIndex > -1 ? combatants[index].statuses.splice(statusIndex, 1) : combatants[index].statuses.push(status);
    saveData();
    renderCombatList();
}

export function toggleMod(index, modType) {
    const unit = combatants[index];
    if (!unit.mods) unit.mods = { shield: false, cover: null };

    if (modType === 'shield') unit.mods.shield = !unit.mods.shield;
    else unit.mods.cover = (unit.mods.cover === modType) ? null : modType;

    saveData();
    renderCombatList();
}

// --- 3. МАГИЯ ---

export function startSpellCasting(casterIndex, spellName) {
    window.spellCastingMode = { casterIndex, spellName };
    document.querySelectorAll('.character-card').forEach(c => {
        c.style.opacity = "0.5"; 
    });
    const casterEl = document.getElementById(`unit-${casterIndex}`);
    if (casterEl) {
        casterEl.classList.add('casting-source');
        casterEl.style.opacity = "1";
    }
}

export function applySpellEffect(casterIdx, targetIdx, spell) {
    const target = combatants[targetIdx];
    const caster = combatants[casterIdx];
    if (!target.activeSpells) target.activeSpells = [];
    target.activeSpells.push({
        name: spell,
        casterName: caster.name,
        casterImg: caster.img
    });
    saveData();
    renderCombatList();
}

// --- 4. ИМПОРТ И ФОТО ---

export async function importCharacter() {
    const fileInput = document.getElementById('import-json');
    if (!fileInput || !fileInput.files[0]) return alert("Выбери файл JSON!");
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const raw = JSON.parse(e.target.result);
            let data = (raw.data && typeof raw.data === 'string') ? JSON.parse(raw.data) : (raw.data || raw);
            
            const name = (data.name?.value || data.name || "Герой").toString();
            const hp = parseInt(data.vitality?.["hp-max"]?.value || data.hp) || 10;
            const img = data.avatar?.webp || data.avatar?.jpeg || "";
            const ac = parseInt(data.attributes?.ac?.value || data.ac) || 10;

            combatants.push({ 
                name, maxHp: hp, currentHp: hp, ac, init: 0, img, type: 'hero',
                statuses: [], activeSpells: [], mods: { shield: false, cover: null } 
            });
            saveData();
            renderCombatList();
            switchTab('battle');
        } catch (err) { alert("Ошибка чтения JSON!"); }
    };
    reader.readAsText(fileInput.files[0]);
}

export function updateUnitPhoto(event, index) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        combatants[index].img = e.target.result;
        saveData();
        renderCombatList();
    };
    reader.readAsDataURL(file);
}

// --- 5. ФИНАЛ БОЯ ---

export function finishBattle() {
    if (confirm("Завершить бой? Все монстры будут удалены, герои останутся.")) {
        const heroesOnly = combatants.filter(unit => unit.type === 'hero');
        updateCombatants(heroesOnly);
        renderCombatList();
    }
}

export function clearAllCombatants() {
    if (confirm("ПОЛНОСТЬЮ очистить поле боя?")) {
        updateCombatants([]);
        renderCombatList();
    }
}
