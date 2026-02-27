import { combatants, saveData } from './state.js';
import { renderCombatList } from './ui-render.js';

import { combatants, saveData, sendDataToSheets, API_URL } from './state.js';
import { renderCombatList, switchTab } from './ui-render.js';
import { loadHeroLibrary, loadMonsterLibrary } from './main.js';

// --- 1. УПРАВЛЕНИЕ СПИСКОМ (Удаление, Клонирование, Добавление) ---

export function deleteUnit(index) {
    if (confirm("Удалить?")) { 
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
    const name = prompt("Имя юнита:");
    if (!name) return;
    
    const hp = parseInt(prompt("Максимальное HP:", "10")) || 10;
    const ac = parseInt(prompt("Класс доспеха (AC):", "10")) || 10;
    const isMonster = confirm("Это монстр? (ОК - Монстр, Отмена - Герой)");
    
    combatants.push({
        name, maxHp: hp, currentHp: hp, ac, init: 0,
        img: 'https://i.imgur.com/83p7pId.png',
        type: isMonster ? 'monster' : 'hero',
        mods: { shield: false, cover: null }
    });
    saveData();
    renderCombatList();
}

// --- 2. ИЗМЕНЕНИЕ ПАРАМЕТРОВ (HP, AC, Инициатива, Статусы) ---

export function editHP(index) {
    let newVal = prompt("Текущее HP:", combatants[index].currentHp);
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
    let newVal = prompt("Инициатива:", combatants[index].init);
    if (newVal !== null) { 
        combatants[index].init = parseInt(newVal) || 0; 
        combatants.sort((a, b) => b.init - a.init);
        saveData(); 
        renderCombatList(); 
    }
}

export function editBaseAC(index) {
    let newVal = prompt("Базовый Класс Защиты:", combatants[index].ac || 10);
    if (newVal !== null) {
        combatants[index].ac = parseInt(newVal) || 0;
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

// --- 3. МАГИЯ И ЭФФЕКТЫ ---

export function startSpellCasting(casterIndex, spellName) {
    window.spellCastingMode = { casterIndex, spellName };
    document.querySelectorAll('.character-card').forEach(c => {
        c.classList.remove('casting-source');
        c.style.opacity = "0.5"; 
    });
    const casterEl = document.getElementById(`unit-${casterIndex}`);
    casterEl.classList.add('casting-source');
    casterEl.style.opacity = "1";
    document.querySelectorAll('.status-dropdown').forEach(m => m.style.display = 'none');
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

// --- 4. ИМПОРТ И РАБОТА С ФОТО/БАЗОЙ ---

export async function addMonsterManual() {
    const fileInput = document.getElementById('monster-json');
    const nameField = document.getElementById('monster-name');

    if (fileInput?.files[0]) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const monsterData = JSON.parse(e.target.result);
                // ... (вся твоя логика парсинга JSON монстра)
                // В конце вызываем:
                // await sendDataToSheets('Enemies', 'add', rowData);
                // renderCombatList();
            } catch (err) { alert("Ошибка JSON монстра!"); }
        };
        reader.readAsText(fileInput.files[0]);
    }
    // ... (логика ручного ввода)
}

export async function importCharacter() {
    const fileInput = document.getElementById('import-json');
    if (!fileInput.files[0]) return alert("Выбери файл JSON!");
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const raw = JSON.parse(e.target.result);
            let data = (raw.data && typeof raw.data === 'string') ? JSON.parse(raw.data) : (raw.data || raw);
            
            const name = (data.name?.value || data.name || "Герой").toString().trim();
            const hp = parseInt(data.vitality?.["hp-max"]?.value || data.hp) || 10;
            const img = data.avatar?.webp || data.avatar?.jpeg || "";
            const ac = parseInt(data.attributes?.ac?.value || data.ac) || 10;

            combatants.push({ name, maxHp: hp, currentHp: hp, ac, init: 0, img, type: 'hero' });
            saveData();
            renderCombatList();
            await sendDataToSheets('Characters', 'add', [name, hp, hp, 0, img, ac]);
            switchTab('battle');
        } catch (err) { alert("Ошибка JSON героя!"); }
    };
    reader.readAsText(fileInput.files[0]);
}

export async function uploadPhotoDirect(name, event, sheet) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64Image = e.target.result;
        try {
            await fetch(API_URL, {
                method: 'POST', mode: 'no-cors',
                body: JSON.stringify({ sheet, action: 'updatePhoto', name, photo: base64Image })
            });
            alert(`Фото обновлено!`);
            sheet === 'Enemies' ? loadMonsterLibrary() : loadHeroLibrary();
        } catch (err) { alert("Ошибка связи с БД"); }
    };
    reader.readAsDataURL(file);
}

export async function updateUnitPhoto(event, index) {
    const file = event.target.files[0];
    if (!file || file.size > 1024 * 1024) return alert("Файл слишком большой!");

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Image = e.target.result;
        combatants[index].img = base64Image;
        saveData();
        renderCombatList();
        const sheet = combatants[index].type === 'monster' ? 'Enemies' : 'Characters';
        fetch(API_URL, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ sheet, action: 'updatePhoto', name: combatants[index].name, photo: base64Image })
        });
    };
    reader.readAsDataURL(file);
}

5. Очистка поля боя
import { combatants, updateCombatants, saveData } from './state.js';
import { renderCombatList } from './ui-render.js';

export function finishBattle() {
    if (confirm("Завершить бой? Все монстры будут удалены, герои останутся с текущими HP и статусами.")) {
        // Фильтруем список: оставляем только тех, у кого тип 'hero'
        const heroesOnly = combatants.filter(unit => unit.type === 'hero');
        
        // Обновляем состояние через функцию из state.js
        updateCombatants(heroesOnly);
        
        // Перерисовываем интерфейс
        renderCombatList();
        
        console.log("Бой завершен. Монстры удалены, герои сохранены.");
    }
}

export function clearAllCombatants() {
    if (confirm("Вы уверены, что хотите ПОЛНОСТЬЮ очистить поле боя?")) {
        updateCombatants([]);
        renderCombatList();
    }
}
