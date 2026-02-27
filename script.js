let combatants = JSON.parse(localStorage.getItem('dnd_combatants')) || [];
let fullMonsterDatabase = []; 
let fullHeroDatabase = [];   


let spellCastingMode = null; // Хранит данные: кто колдует и что




function toggleStatusMenu(index) {
    const menu = document.getElementById(`status-menu-${index}`);
    const card = document.getElementById(`unit-${index}`);
    
    // Закрываем другие меню
    document.querySelectorAll('.status-dropdown').forEach(m => m.style.display = 'none');
    document.querySelectorAll('.character-card').forEach(c => c.classList.remove('has-open-menu'));

    if (menu.style.display === 'grid') {
        menu.style.display = 'none';
        card.classList.remove('has-open-menu');
    } else {
        menu.style.display = 'grid';
        card.classList.add('has-open-menu');
        
        // Генерируем содержимое меню (Обычные статусы + Заклинания)
const spellsArray = Object.keys(DND_SPELLS_DATA); // Получаем массив названий

menu.innerHTML = `
    <div class="status-section-title">Статусы</div>
    ${DND_STATUSES.map(s => `<div class="status-option" onclick="toggleStatus(${index}, '${s}')">${s}</div>`).join('')}
    <div class="status-section-title">Заклинания / Метки</div>
    ${spellsArray.map(s => `<div class="status-option spell-option" onclick="startSpellCasting(${index}, '${s}')">${DND_SPELLS_DATA[s]} ${s}</div>`).join('')}
`;
    }
}



// 2. ОТРИСОВКА СПИСКА БОЯ (ЕДИНАЯ ВЕРСИЯ)
// Функция переключения модификаторов


// Функция редактирования БАЗОВОГО AC


function changeBackground(event) {
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



async function addMonsterToDB(monsterData) {
    const sheetName = 'Enemies';
    
    // Твой строгий порядок столбцов:
    // 1. Название | 2. Хиты | 3. КД | 4. Тип | 5. Фото | 6. Описание | 7. Доп КД | 8. Доп хиты
    const rowData = [
        monsterData.name,        // Название монстров
        monsterData.hp,          // Число хитов
        monsterData.ac,          // Класс доспеха
        monsterData.type,        // Тип
        monsterData.img,         // Фото
        monsterData.description, // Описание
        monsterData.acNote,      // Доп класс защиты
        monsterData.hpNote       // Доп хиты (формула)
    ];
    
    await sendDataToSheets(sheetName, 'add', rowData);
}


// 3. ФУНКЦИИ ГЕРОЕВ (БИБЛИОТЕКА)
async function loadHeroLibrary() {
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

function filterHeroes() {
    const query = document.getElementById('hero-search').value.toLowerCase();
    const filtered = fullHeroDatabase.filter(h => {
        const name = (h["Имя"] || Object.values(h)[0] || "").toString().toLowerCase();
        return name.includes(query);
    });
    displayHeroes(filtered);
}

function addHeroToCombat(name, hp, img, ac = 10) {
    const unit = {
        name: name,
        maxHp: hp,
        currentHp: hp,
        ac: ac,
        init: 0,
        img: img,
        type: 'hero',
        mods: { shield: false, cover: null }
    };
    combatants.push(unit);
    saveData();
    renderCombatList();
}

// 4. ФУНКЦИИ МОНСТРОВ (БИБЛИОТЕКА)
async function loadMonsterLibrary() {
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

function displayMonsters(monsters) {
    const container = document.getElementById('monster-library-list');
    container.innerHTML = '';
    
    monsters.forEach((item) => {
        const values = Object.values(item);
        const name = (item["Имя"] || values[0] || "Монстр").replace(/'/g, "\\'");
        const hp = item["MaxHP"] || values[1] || "10";
        const ac = item["AC"] || values[2] || "10";
        const img = item["Фото"] || values[4] || 'https://i.imgur.com/83p7pId.png';
        const acNote = item["Доп КД"] || values[6] || ""; // Тянем заметки из БД
        const hpNote = item["Доп хиты"] || values[7] || "";

        const div = document.createElement('div');
        div.className = 'library-item';
        div.innerHTML = `
            <div class="lib-info" onclick="addMonsterToCombat('${name}', '${hp}', '${ac}', '${img}', '${hpNote}', '${acNote}')">
                <img src="${img}" onerror="this.src='https://i.imgur.com/83p7pId.png'">
                <span>${name} <small>(AC: ${ac})</small></span>
            </div>
            <div class="lib-actions">
                <label class="btn-lib-upload">
                    📷
                    <input type="file" style="display:none" onchange="uploadPhotoDirect('${name}', event, 'Enemies')">
                </label>
            </div>
        `;
        container.appendChild(div);
    });
}

function displayHeroes(heroes) {
    const container = document.getElementById('hero-library-list');
    container.innerHTML = '';
    
    heroes.forEach((item) => {
        const values = Object.values(item);
        const name = (item["Имя"] || values[0] || "Герой").replace(/'/g, "\\'");
        const hp = parseInt(item["MaxHP"] || values[1]) || 10;
        const img = item["Фото"] || values[4] || 'https://i.imgur.com/83p7pId.png';
        const ac = parseInt(item["КД"] || values[5]) || 10; // Берем из столбца F

        const div = document.createElement('div');
        div.className = 'library-item';
        div.innerHTML = `
            <div class="lib-info" onclick="addHeroToCombat('${name}', ${hp}, '${img}', ${ac})">
                <img src="${img}" onerror="this.src='https://i.imgur.com/83p7pId.png'">
                <span>${name} <small>(HP: ${hp}, AC: ${ac})</small></span>
            </div>
            <div class="lib-actions">
                <label class="btn-lib-upload" title="Обновить фото">
                    📷 <input type="file" style="display:none" onchange="uploadHeroPhotoDirect('${name}', event)">
                </label>
            </div>
        `;
        container.appendChild(div);
    });
}

function filterMonsters() {
    const query = document.getElementById('monster-search').value.toLowerCase();
    const filtered = fullMonsterDatabase.filter(m => {
        const name = (m["Имя"] || Object.values(m)[0] || "").toString().toLowerCase();
        return name.includes(query);
    });
    displayMonsters(filtered);
}

function addMonsterToCombat(name, hp, ac, img, hpNote = "", acNote = "") {
    const unit = {
        name: name,
        maxHp: parseInt(hp) || 10,
        currentHp: parseInt(hp) || 10,
        hpNote: hpNote, // Чистый текст (например: "пятикратный уровень следопыта")
        ac: parseInt(ac) || 10,
        acNote: acNote, // Чистый текст (например: "natural armor, бонус мастерства")
        init: 0,
        img: img,
        type: 'monster',
        mods: { shield: false, cover: null }
    };
    combatants.push(unit);
    saveData();
    renderCombatList();
}



// Специальная обертка для героев (для вызова из HTML)
function uploadHeroPhotoDirect(name, event) {
    uploadPhotoDirect(name, event, 'Characters');
}


// 1. Золотая рамка
function selectUnit(index) {
    if (spellCastingMode) {
        applySpellEffect(spellCastingMode.casterIndex, index, spellCastingMode.spellName);
        spellCastingMode = null; 
        
        // Возвращаем нормальную яркость всем карточкам
        document.querySelectorAll('.character-card').forEach(c => {
            c.classList.remove('casting-source');
            c.style.opacity = "1";
        });
        return;
    }
    
    document.querySelectorAll('.character-card').forEach(card => card.classList.remove('selected'));
    const target = document.getElementById(`unit-${index}`);
    if (target) target.classList.add('selected');
}



function removeSpell(targetIdx, spellIdx) {
    // 1. Проверяем существование юнита и массива заклинаний
    if (combatants[targetIdx] && combatants[targetIdx].activeSpells) {
        
        // 2. Удаляем конкретное заклинание из массива по индексу
        combatants[targetIdx].activeSpells.splice(spellIdx, 1);
        
        // 3. Очищаем подсветку (на случай если мышка осталась над зоной)
        resetHighlights();
        
        // 4. Сохраняем и перерисовываем
        saveData();
        renderCombatList();
    }
}

// Подсветка кастера при наведении на заклинание
function highlightCaster(targetIndex, spellIndex) {
    const spell = combatants[targetIndex].activeSpells[spellIndex];
    // Находим кастера по имени
    const casterIndex = combatants.findIndex(u => u.name === spell.casterName);
    
    if (casterIndex !== -1) {
        const casterEl = document.getElementById(`unit-${casterIndex}`);
        if (casterEl) {
            casterEl.classList.add('casting-source'); // Используем уже готовый класс свечения
        }
    }
}

// Убираем подсветку
function resetHighlights() {
    document.querySelectorAll('.character-card').forEach(c => {
        c.classList.remove('casting-source');
    });
}


// 1. ПОЛНАЯ ОЧИСТКА (Все карточки)
function clearAllCombatants() {
    if (confirm("Вы уверены, что хотите полностью очистить поле боя?")) {
        combatants = []; // Обнуляем массив
        saveData();      // Сохраняем пустоту в LocalStorage
        renderCombatList(); // Перерисовываем
    }
}

// 2. ЗАВЕРШИТЬ БОЙ (Удалить только монстров)
function finishBattle() {
    if (confirm("Удалить всех противников? Герои останутся.")) {
        // Оставляем только героев, статусы НЕ трогаем
        combatants = combatants.filter(unit => unit.type === 'hero');
        
        // Сбрасываем только временные моды КД (щиты/укрытия), если нужно
        // Если хочешь оставить и их — просто удали цикл ниже
        combatants.forEach(hero => {
            hero.mods = { shield: false, cover: null };
        });

        saveData();
        renderCombatList();
    }
}

// 7. ЗАПУСК
window.onload = () => {
    const bg = localStorage.getItem('dnd_bg');
    if(bg) document.getElementById('main-bg').style.backgroundImage = `url(${bg})`;
    renderCombatList();

    if (typeof Sortable !== 'undefined') {
        new Sortable(document.getElementById('character-list'), {
            animation: 150,
            onEnd: function (evt) {
                if (evt.oldIndex === evt.newIndex) return;
                const movedItem = combatants.splice(evt.oldIndex, 1)[0];
                combatants.splice(evt.newIndex, 0, movedItem);
                
                const targetIndex = evt.newIndex;
                if (evt.newIndex < evt.oldIndex) {
                    const unitBelow = combatants[targetIndex + 1];
                    movedItem.init = unitBelow ? unitBelow.init + 1 : movedItem.init;
                } else {
                    const unitAbove = combatants[targetIndex - 1];
                    movedItem.init = unitAbove ? unitAbove.init - 1 : movedItem.init;
                }
                saveData(); renderCombatList();
            }
        });
    }
};

document.addEventListener('click', (e) => {
    if (!e.target.closest('.status-container')) {
        document.querySelectorAll('.status-dropdown').forEach(m => m.style.display = 'none');
        document.querySelectorAll('.character-card').forEach(c => c.classList.remove('has-open-menu'));
    }
});

// Внутри window.onload добавь:
window.addEventListener('scroll', clearConnectionLines, true);





































