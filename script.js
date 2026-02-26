let combatants = JSON.parse(localStorage.getItem('dnd_combatants')) || [];
let fullMonsterDatabase = []; 
let fullHeroDatabase = [];    
const API_URL = "https://script.google.com/macros/s/AKfycbyWl5zL8k_cWPkXbc1O7E1YwEW9jaSFJ11Eya6IcSeXLSx724Bdw_I-ZIBluJhOv9NyLA/exec"; 

// 1. УПРАВЛЕНИЕ ВКЛАДКАМИ
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId + '-tab').classList.add('active');
    
    if(tabId === 'settings') {
        loadHeroLibrary();    
        loadMonsterLibrary(); 
    }
}

// 2. ОТРИСОВКА СПИСКА БОЯ (ЕДИНАЯ ВЕРСИЯ)
// Функция переключения модификаторов
function toggleMod(index, modType) {
    const unit = combatants[index];
    
    // Инициализируем объект модов, если его нет
    if (!unit.mods) unit.mods = { shield: false, cover: null };

    if (modType === 'shield') {
        unit.mods.shield = !unit.mods.shield;
    } 
    else if (modType === '1/2') {
        unit.mods.cover = (unit.mods.cover === '1/2') ? null : '1/2';
    } 
    else if (modType === '3/4') {
        unit.mods.cover = (unit.mods.cover === '3/4') ? null : '3/4';
    }

    saveData();
    renderCombatList();
}

// Функция редактирования БАЗОВОГО AC
function editBaseAC(index) {
    let newVal = prompt("Базовый Класс Защиты:", combatants[index].ac || 10);
    if (newVal !== null) {
        combatants[index].ac = parseInt(newVal) || 0;
        saveData();
        renderCombatList();
    }
}

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

async function addMonsterManual() {
    const fileInput = document.getElementById('monster-json');
    const nameField = document.getElementById('monster-name');
    const hpField = document.getElementById('monster-hp');
    const acField = document.getElementById('monster-ac');

    // СЦЕНАРИЙ А: ЗАГРУЗКА ЧЕРЕЗ JSON
    if (fileInput && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const monsterData = JSON.parse(e.target.result);
                const fullName = monsterData.name || "Новый монстр";
                
                // --- 1. ЛОГИКА ФОТО ---
                let img = monsterData.img || "";
                if (!img) {
                    // Извлекаем английское имя из скобок [English Name]
                    const engNameMatch = fullName.match(/\[(.*?)\]/);
                    const nameToProcess = engNameMatch ? engNameMatch[1] : fullName;
                    const slug = nameToProcess
                        .toLowerCase()
                        .trim()
                        .replace(/\s+/g, '_')     // пробелы в _
                        .replace(/[^\w]/g, '');   // удаляем всё кроме букв и _
                    img = `https://img.ttg.club/tokens/round/${slug}.webp`;
                }

                // --- 2. ЛОГИКА ДОП ХИТОВ ---
                let hpFormula = monsterData.hp?.formula || "";
                let finalHpNote = "";
                // Если формула не является просто кубами (например, не "5d8+5")
                if (hpFormula && !/^\d+d\d+/.test(hpFormula)) {
                    if (hpFormula.includes('+')) {
                        // Сохраняем только ТЕКСТ после плюса
                        finalHpNote = hpFormula.substring(hpFormula.indexOf('+') + 1).trim();
                    }
                }

                // --- 3. ЛОГИКА КД (AC) И БОНУСА МАСТЕРСТВА ---
                let acVal = 10;
                let acNote = "";
                if (Array.isArray(monsterData.ac)) {
                    const firstAC = monsterData.ac[0];
                    if (typeof firstAC === 'object') {
                        acVal = firstAC.ac;
                        // Проверяем источники КД на наличие БМ
                        if (firstAC.from) {
                            acNote = firstAC.from.map(s => 
                                s.replace(/\{@bonus\s+pb\}/g, "бонус мастерства")
                                 .replace(/plus your Proficiency Bonus/gi, "бонус мастерства")
                            ).join(", ");
                        }
                        // Если в описании или типе есть намек на БМ (для призываемых существ)
                        if (JSON.stringify(monsterData).includes("Proficiency Bonus") && !acNote.includes("мастерства")) {
                            acNote += (acNote ? ", " : "") + "бонус мастерства";
                        }
                    } else {
                        acVal = firstAC;
                    }
                }

                const dbData = {
                    name: fullName,
                    hp: monsterData.hp?.average || 10,
                    ac: acVal,
                    type: monsterData.type || "unknown",
                    img: img,
                    description: monsterData.trait ? monsterData.trait[0].name : "JSON",
                    acNote: acNote,
                    hpNote: finalHpNote
                };

                // Добавляем в бой и в БД
                addMonsterToCombat(dbData.name, dbData.hp, dbData.ac, dbData.img, dbData.hpNote, dbData.acNote);
                await addMonsterToDB(dbData);
                
                alert(`Монстр ${fullName} успешно добавлен!`);
                fileInput.value = ''; 
            } catch (err) {
                console.error(err);
                alert("Ошибка при чтении файла!");
            }
        };
        reader.readAsText(fileInput.files[0]);
    } 
    // СЦЕНАРИЙ Б: РУЧНОЙ ВВОД
    else if (nameField && nameField.value.trim() !== "") {
        const dbData = {
            name: nameField.value,
            hp: parseInt(hpField.value) || 10,
            ac: parseInt(acField.value) || 10,
            type: "manual",
            img: 'https://i.imgur.com/83p7pId.png',
            description: "Вручную",
            acNote: "",
            hpNote: ""
        };
        addMonsterToCombat(dbData.name, dbData.hp, dbData.ac, dbData.img, "", "");
        await addMonsterToDB(dbData);
        nameField.value = ''; hpField.value = ''; acField.value = '';
    }
}

async function addMonsterToDB(monsterData) {
    const sheetName = 'Enemies';
    const rowData = [
        monsterData.name,        // 1. Название монстров
        monsterData.hp,          // 2. Число хитов
        monsterData.ac,          // 3. Класс доспеха
        monsterData.type,        // 4. Тип
        monsterData.img,         // 5. Фото
        monsterData.description, // 6. Описание
        monsterData.acNote,      // 7. Доп класс защиты
        monsterData.hpNote       // 8. Доп хиты
    ];
    
    await sendDataToSheets(sheetName, 'add', rowData);
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

function renderCombatList() {
    const list = document.getElementById('character-list');
    if (!list) return;
    list.innerHTML = '';
    
    combatants.forEach((unit, index) => {
        if (!unit.mods) unit.mods = { shield: false, cover: null };
        let bonus = (unit.mods.shield ? 2 : 0) + (unit.mods.cover === '1/2' ? 2 : 0) + (unit.mods.cover === '3/4' ? 5 : 0);
        const totalAC = (parseInt(unit.ac) || 0) + bonus;

        const div = document.createElement('div');
        div.className = `character-card ${unit.type === 'monster' ? 'monster-card' : ''}`;
        
        div.innerHTML = `
            <div class="avatar-container">
                <img src="${unit.img}" class="avatar" onerror="this.src='https://i.imgur.com/83p7pId.png';">
                <div class="ac-badge" onclick="editBaseAC(${index})">
                    ${totalAC}
                    ${unit.acNote && unit.acNote.includes('мастерства') ? '<span class="pb-label">+БМ</span>' : ''}
                </div>
            </div>

            <div class="unit-info">
                <strong>${unit.name}</strong><br>
                <small>Инист:</small> <span class="init-value" onclick="editInit(${index})">${unit.init}</span>
                ${unit.acNote ? `<div class="unit-note ac-note">${unit.acNote}</div>` : ''}
            </div>

            <div class="hp-heart-container" onclick="editHP(${index})" onwheel="changeHP(event, ${index})">
                <svg viewBox="0 0 32 32" class="hp-heart-svg">
                    <path d="M16,28.261c0,0-14-7.926-14-17.046c0-9.356,13.159-10.399,14,0.454c0.841-10.853,14-9.81,14-0.454 C30,20.335,16,28.261,16,28.261z" fill="#9e2121" stroke="#333" stroke-width="1"/>
                </svg>
                <div class="hp-text-overlay">
                    <span class="hp-current">${unit.currentHp}</span>
                    <span class="hp-divider">/</span>
                    <span class="hp-max">${unit.maxHp}</span>
                </div>
                ${unit.hpNote ? `<div class="unit-note hp-note">+ ${unit.hpNote}</div>` : ''}
            </div>

            <div class="mod-buttons">
                <button class="shield-btn ${unit.mods.shield ? 'active' : ''}" onclick="toggleMod(${index}, 'shield')">🛡️</button>
                <button class="shield-btn ${unit.mods.cover ? 'active' : ''}" onclick="toggleMod(${index}, '1/2')">½</button>
            </div>
            
            <button class="delete-btn" onclick="deleteUnit(${index})">🗑️</button>
        `;
        list.appendChild(div);
    });
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

function addHeroToCombat(name, hp, img) {
    const unit = {
        name: name || "Безымянный герой",
        maxHp: parseInt(hp) || 10, // Если пусто, даем 10 HP
        currentHp: parseInt(hp) || 10,
        init: 0,
        img: img || 'https://i.imgur.com/83p7pId.png', // Заглушка, если нет фото
        type: 'hero'
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
        // Индексы зависят от твоей таблицы (обычно: 0-Имя, 1-HP, 2-AC, 4-Фото, 6-AC Note, 7-HP Note)
        const name = (item["Имя"] || values[0] || "Монстр").replace(/'/g, "\\'");
        
        // Берем сырые данные (вместе с текстом), чтобы addMonsterToCombat их распарсила
        const hpRaw = item["MaxHP"] || values[1] || "10";
        const acRaw = item["AC"] || values[2] || "10";
        const img = item["Фото"] || values[4] || 'https://i.imgur.com/83p7pId.png';

        const div = document.createElement('div');
        div.className = 'library-item';
        div.innerHTML = `
            <div class="lib-info" onclick="addMonsterToCombat('${name}', '${hpRaw}', '${acRaw}', '${img}')">
                <img src="${img}" onerror="this.src='https://i.imgur.com/83p7pId.png'">
                <span>${name} <small>(AC: ${acRaw})</small></span>
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
        const hp = parseInt(item["MaxHP"] || values[1]) || 0;
        const img = item["Фото"] || values[4] || 'https://i.imgur.com/83p7pId.png';

        const div = document.createElement('div');
        div.className = 'library-item';
        div.innerHTML = `
            <div class="lib-info" onclick="addHeroToCombat('${name}', ${hp}, '${img}')">
                <img src="${img}" onerror="this.src='https://i.imgur.com/83p7pId.png'">
                <span>${name} ${hp > 0 ? `<small>(HP: ${hp})</small>` : ''}</span>
            </div>
            <div class="lib-actions">
                <label class="btn-lib-upload" title="Обновить фото">
                    📷
                    <input type="file" style="display:none" onchange="uploadHeroPhotoDirect('${name}', event)">
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

// 5. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (HP, ИНИЦИАТИВА, ФОТО)
function editInit(index) {
    let newVal = prompt("Инициатива:", combatants[index].init);
    if (newVal !== null) { combatants[index].init = parseInt(newVal) || 0; saveData(); renderCombatList(); }
}

function editHP(index) {
    let newVal = prompt("Текущее HP:", combatants[index].currentHp);
    if (newVal !== null) { combatants[index].currentHp = parseInt(newVal) || 0; saveData(); renderCombatList(); }
}

function changeHP(e, index) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    combatants[index].currentHp = Math.max(0, parseInt(combatants[index].currentHp) + delta);
    saveData(); renderCombatList();
}

function deleteUnit(index) {
    if (confirm("Удалить?")) { combatants.splice(index, 1); saveData(); renderCombatList(); }
}

function saveData() { localStorage.setItem('dnd_combatants', JSON.stringify(combatants)); }

async function sendDataToSheets(sheet, action, data) {
    try {
        await fetch(API_URL, { 
            method: 'POST', 
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sheet, action, data }) 
        });
    } catch (e) {
        console.error("Ошибка отправки в БД:", e);
    }
}

// Загрузка фото напрямую в БД (универсальная)
async function uploadPhotoDirect(name, event, sheet) {
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
            alert(`Фото для ${name} обновлено!`);
            sheet === 'Enemies' ? loadMonsterLibrary() : loadHeroLibrary();
        } catch (err) { alert("Ошибка связи с БД"); }
    };
    reader.readAsDataURL(file);
}

// Специальная обертка для героев (для вызова из HTML)
function uploadHeroPhotoDirect(name, event) {
    uploadPhotoDirect(name, event, 'Characters');
}

// Обновление фото конкретного юнита в бою
async function updateUnitPhoto(event, index) {
    const file = event.target.files[0];
    if (!file || file.size > 1024 * 1024) return alert("Файл отсутствует или слишком большой (>1MB)!");

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Image = e.target.result;
        combatants[index].img = base64Image;
        saveData(); renderCombatList();

        // Если это монстр или герой, пытаемся обновить и в БД
        const sheet = combatants[index].type === 'monster' ? 'Enemies' : 'Characters';
        fetch(API_URL, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ sheet, action: 'updatePhoto', name: combatants[index].name, photo: base64Image })
        });
    };
    reader.readAsDataURL(file);
}

// 6. ИМПОРТ ИЗ JSON
async function importCharacter() {
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

            const unit = { name, maxHp: hp, currentHp: hp, init: 0, img, type: 'hero' };
            combatants.push(unit);
            saveData(); renderCombatList();
            switchTab('battle');
            
            // Пытаемся сохранить в базу, если такого нет
            await sendDataToSheets('Characters', 'add', [name, hp, hp, 0, img]);
        } catch (err) { alert("Ошибка JSON!"); }
    };
    reader.readAsText(fileInput.files[0]);
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

















