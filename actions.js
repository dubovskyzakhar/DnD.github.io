// 1. Правильные импорты
import { combatants, saveData, updateCombatants } from './state.js';
import { renderCombatList, switchTab } from './ui-render.js';
import { API_URL, DND_STATUSES } from './constants.js';

// ПРЕДПОЛОЖЕНИЕ: Функция отправки в таблицы должна быть импортирована или объявлена
// import { sendDataToSheets } from './api-service.js';

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
    const countInput = prompt(`Сколько клонов "${unit.name}" создать?`, "1");
    const count = parseInt(countInput);
    
    if (!count || isNaN(count) || count <= 0) return;

    // Очищаем имя от старых индексов типа "_1", "_2"
    const baseName = unit.name.replace(/_\d+$/, "");

    for (let i = 0; i < count; i++) {
        // Находим все текущие номера для существ с таким же базовым именем
        const existingIndices = combatants
            .filter(c => c.name.startsWith(baseName))
            .map(c => {
                const match = c.name.match(/_(\d+)$/);
                return match ? parseInt(match[1]) : 0;
            });

        // Новый индекс — это максимальный существующий + 1
        const nextIndex = existingIndices.length > 0 ? Math.max(...existingIndices) + 1 : 1;

        // Используем structuredClone для глубокого копирования (современный стандарт)
        const clone = structuredClone(unit);
        clone.name = `${baseName}_${nextIndex}`;
        clone.currentHp = clone.maxHp; 
        clone.statuses = []; // Клоны обычно появляются без эффектов оригинала
        clone.activeSpells = [];
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
    const nameEl = document.getElementById('monster-name');
    const hpEl = document.getElementById('monster-hp');
    const acEl = document.getElementById('monster-ac');
    const imgEl = document.getElementById('monster-img');

    const name = nameEl?.value.trim();
    const hp = parseInt(hpEl?.value);
    const ac = parseInt(acEl?.value) || 10;
    const img = imgEl?.value || "";

    if (!name || isNaN(hp)) return alert("Введите корректное имя и ОЗ монстра!");

    const rowData = [name, hp, ac, img];
    
    try {
        // ВАЖНО: Убедитесь, что эта функция определена!
        if (typeof sendDataToSheets === 'function') {
            await sendDataToSheets('Enemies', 'add', rowData);
            alert(`Монстр ${name} добавлен в базу!`);
        } else {
            console.error("Функция sendDataToSheets не найдена");
        }
    } catch (err) {
        alert("Ошибка при сохранении в таблицу");
    }
    
    // Очистка полей
    if (nameEl) nameEl.value = "";
    if (hpEl) hpEl.value = "";
}

// --- 2. ИЗМЕНЕНИЕ ПАРАМЕТРОВ ---

export function editHP(index) {
    let newVal = prompt("Установить текущее HP:", combatants[index].currentHp);
    if (newVal !== null) { 
        const hp = parseInt(newVal);
        combatants[index].currentHp = isNaN(hp) ? combatants[index].currentHp : hp; 
        saveData(); 
        renderCombatList(); 
    }
}

export function changeHP(e, index) {
    e.preventDefault();
    // Добавил поддержку Shift для быстрого изменения по 10 единиц
    const step = e.shiftKey ? 10 : 1;
    const delta = e.deltaY < 0 ? step : -step;
    
    combatants[index].currentHp = Math.max(0, parseInt(combatants[index].currentHp) + delta);
    saveData(); 
    renderCombatList();
}

export function editInit(index) {
    let newVal = prompt("Установить инициативу:", combatants[index].init);
    if (newVal !== null) { 
        combatants[index].init = parseInt(newVal) || 0; 
        // Сортировка по инициативе (от большего к меньшему)
        combatants.sort((a, b) => (b.init || 0) - (a.init || 0));
        saveData(); 
        renderCombatList(); 
    }
}

export function toggleStatus(index, status) {
    if (!combatants[index].statuses) combatants[index].statuses = [];
    const statusIndex = combatants[index].statuses.indexOf(status);
    
    if (statusIndex > -1) {
        combatants[index].statuses.splice(statusIndex, 1);
    } else {
        combatants[index].statuses.push(status);
    }
    
    saveData();
    renderCombatList();
}

export function toggleMod(index, modType) {
    const unit = combatants[index];
    if (!unit.mods) unit.mods = { shield: false, cover: null };

    if (modType === 'shield') {
        unit.mods.shield = !unit.mods.shield;
    } else {
        unit.mods.cover = (unit.mods.cover === modType) ? null : modType;
    }

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
        id: Date.now(), // Добавили ID для возможности удаления заклинания
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
            // Обработка разных форматов JSON (из Foundry VTT или своих)
            let data = (raw.data && typeof raw.data === 'string') ? JSON.parse(raw.data) : (raw.data || raw);
            
            const name = (data.name?.value || data.name || "Герой").toString();
            const hp = parseInt(data.vitality?.["hp-max"]?.value || data.hp || data.system?.attributes?.hp?.max) || 10;
            const img = data.avatar?.webp || data.avatar?.jpeg || data.img || "";
            const ac = parseInt(data.attributes?.ac?.value || data.ac || data.system?.attributes?.ac?.value) || 10;

            combatants.push({ 
                name, maxHp: hp, currentHp: hp, ac, init: 0, img, type: 'hero',
                statuses: [], activeSpells: [], mods: { shield: false, cover: null } 
            });
            
            saveData();
            renderCombatList();
            switchTab('battle');
        } catch (err) { 
            console.error(err);
            alert("Ошибка чтения JSON! Проверьте формат файла."); 
        }
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
        saveData(); // Важно: перезаписываем хранилище
        renderCombatList();
    }
}

export function clearAllCombatants() {
    if (confirm("ПОЛНОСТЬЮ очистить поле боя?")) {
        updateCombatants([]);
        saveData(); // Важно: перезаписываем хранилище
        renderCombatList();
    }
}
