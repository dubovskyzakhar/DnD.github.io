import { renderCombatList, displayHeroes, displayMonsters, resetHighlights } from './ui-render.js';
import { saveData, API_URL, sendDataToSheets } from './state.js';
import * as actions from './actions.js';

// --- 1. СОСТОЯНИЕ (STATE) ---
export let combatants = JSON.parse(localStorage.getItem('dnd_combatants')) || [];
let fullMonsterDatabase = []; 
let fullHeroDatabase = [];   
export let spellCastingMode = null;

// Позволяем другим модулям менять режим магии
export const setSpellMode = (val) => { spellCastingMode = val; };

// --- 2. ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ---

window.onload = () => {
    // Установка фона
    const bg = localStorage.getItem('dnd_bg');
    if(bg) document.getElementById('main-bg').style.backgroundImage = `url(${bg})`;
    
    // Первый рендер
    renderCombatList();

    // Подключение Sortable (Drag-and-drop)
    if (typeof Sortable !== 'undefined') {
        new Sortable(document.getElementById('character-list'), {
            animation: 150,
            onEnd: function (evt) {
                if (evt.oldIndex === evt.newIndex) return;
                const movedItem = combatants.splice(evt.oldIndex, 1)[0];
                combatants.splice(evt.newIndex, 0, movedItem);
                
                // Динамическая коррекция инициативы при перетаскивании
                const targetIndex = evt.newIndex;
                if (evt.newIndex < evt.oldIndex) {
                    const unitBelow = combatants[targetIndex + 1];
                    movedItem.init = unitBelow ? unitBelow.init + 1 : movedItem.init;
                } else {
                    const unitAbove = combatants[targetIndex - 1];
                    movedItem.init = unitAbove ? unitAbove.init - 1 : movedItem.init;
                }
                saveData(); 
                renderCombatList();
            }
        });
    }

    // Загружаем библиотеки сразу
    loadHeroLibrary();
    loadMonsterLibrary();
};

// Глобальные клики (закрытие меню)
document.addEventListener('click', (e) => {
    if (!e.target.closest('.status-container')) {
        document.querySelectorAll('.status-dropdown').forEach(m => m.style.display = 'none');
        document.querySelectorAll('.character-card').forEach(c => c.classList.remove('has-open-menu'));
    }
});

// --- 3. РАБОТА С БИБЛИОТЕКАМИ (ЗАГРУЗКА И ФИЛЬТРЫ) ---

export async function loadHeroLibrary() {
    const container = document.getElementById('hero-library-list');
    if (!container) return;
    try {
        const response = await fetch(`${API_URL}?sheet=Characters`);
        fullHeroDatabase = await response.json(); 
        displayHeroes(fullHeroDatabase);
    } catch (e) {
        container.innerHTML = '<div class="library-item">Ошибка загрузки базы героев</div>';
    }
}

export async function loadMonsterLibrary() {
    const container = document.getElementById('monster-library-list');
    if (!container) return;
    try {
        const response = await fetch(`${API_URL}?sheet=Enemies`);
        fullMonsterDatabase = await response.json();
        displayMonsters(fullMonsterDatabase);
    } catch (e) {
        container.innerHTML = 'Ошибка загрузки бестиария';
    }
}

export function filterHeroes() {
    const query = document.getElementById('hero-search').value.toLowerCase();
    const filtered = fullHeroDatabase.filter(h => {
        const name = (h["Имя"] || Object.values(h)[0] || "").toString().toLowerCase();
        return name.includes(query);
    });
    displayHeroes(filtered);
}

export function filterMonsters() {
    const query = document.getElementById('monster-search').value.toLowerCase();
    const filtered = fullMonsterDatabase.filter(m => {
        const name = (m["Имя"] || Object.values(m)[0] || "").toString().toLowerCase();
        return name.includes(query);
    });
    displayMonsters(filtered);
}

// --- 4. ДОБАВЛЕНИЕ ИЗ БИБЛИОТЕК В БОЙ ---

export function addHeroToCombat(name, hp, img, ac = 10) {
    combatants.push({
        name, maxHp: hp, currentHp: hp, ac, init: 0, img,
        type: 'hero', mods: { shield: false, cover: null }
    });
    saveData();
    renderCombatList();
}

export function addMonsterToCombat(name, hp, ac, img, hpNote = "", acNote = "") {
    combatants.push({
        name, 
        maxHp: parseInt(hp) || 10, 
        currentHp: parseInt(hp) || 10,
        hpNote, ac: parseInt(ac) || 10, acNote,
        init: 0, img, type: 'monster', mods: { shield: false, cover: null }
    });
    saveData();
    renderCombatList();
}

// --- 5. УПРАВЛЕНИЕ БАЗОЙ ДАННЫХ (SHEETS) ---

export async function addMonsterToDB(monsterData) {
    const rowData = [
        monsterData.name, monsterData.hp, monsterData.ac, monsterData.type,
        monsterData.img, monsterData.description, monsterData.acNote, monsterData.hpNote
    ];
    await sendDataToSheets('Enemies', 'add', rowData);
}

export function uploadHeroPhotoDirect(name, event) {
    actions.uploadPhotoDirect(name, event, 'Characters');
}

// --- 6. УТИЛИТЫ БОЯ (ОЧИСТКА, ЗАВЕРШЕНИЕ) ---

export function removeSpell(targetIdx, spellIdx) {
    if (combatants[targetIdx]?.activeSpells) {
        combatants[targetIdx].activeSpells.splice(spellIdx, 1);
        resetHighlights();
        saveData();
        renderCombatList();
    }
}

export function clearAllCombatants() {
    if (confirm("Вы уверены, что хотите полностью очистить поле боя?")) {
        combatants.length = 0; // Очистка массива с сохранением ссылки
        saveData();
        renderCombatList();
    }
}

export function finishBattle() {
    if (confirm("Удалить всех противников? Герои останутся.")) {
        // Фильтруем, оставляя только героев
        const heroes = combatants.filter(unit => unit.type === 'hero');
        combatants.length = 0;
        combatants.push(...heroes);

        combatants.forEach(hero => {
            hero.mods = { shield: false, cover: null };
        });

        saveData();
        renderCombatList();
    }
}
