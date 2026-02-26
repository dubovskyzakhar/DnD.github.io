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

function addMonsterManual() {
    // Получаем данные из полей ввода (убедись, что ID совпадают с твоим HTML)
    const nameInput = document.getElementById('monster-name');
    const hpInput = document.getElementById('monster-hp');
    const acInput = document.getElementById('monster-ac');
    const imgInput = document.getElementById('monster-img');

    // Если поля пустые, даем значения по умолчанию
    const name = nameInput ? nameInput.value : "Новый монстр";
    const hp = hpInput ? hpInput.value : "10";
    const ac = acInput ? acInput.value : "10";
    const img = (imgInput && imgInput.value) ? imgInput.value : 'https://i.imgur.com/83p7pId.png';

    // Вызываем нашу "умную" функцию добавления с парсером текста
    if (typeof addMonsterToCombat === "function") {
        addMonsterToCombat(name, hp, ac, img);
    } else {
        console.error("Ошибка: Функция addMonsterToCombat не найдена!");
    }

    // Очищаем поля после добавления
    if (nameInput) nameInput.value = '';
    if (hpInput) hpInput.value = '';
    if (acInput) acInput.value = '';
    if (imgInput) imgInput.value = '';
}

function renderCombatList() {
    const list = document.getElementById('character-list');
    if (!list) return;
    list.innerHTML = '';
    
    combatants.sort((a, b) => b.init - a.init);

    combatants.forEach((unit, index) => {
        // Проверяем наличие модов
        if (!unit.mods) unit.mods = { shield: false, cover: null };

        // Считаем итоговый AC
        let bonus = 0;
        if (unit.mods.shield) bonus += 2;
        if (unit.mods.cover === '1/2') bonus += 2;
        if (unit.mods.cover === '3/4') bonus += 5;
        
        const totalAC = (parseInt(unit.ac) || 0) + bonus;

        const div = document.createElement('div');
        div.className = `character-card ${unit.type === 'monster' ? 'monster-card' : ''}`;
        
        // Внутри combatants.forEach((unit, index) => { ...

div.innerHTML = `
    <div class="avatar-container">
        <img src="${unit.img}" class="avatar" onerror="this.src='https://i.imgur.com/83p7pId.png';">
        <div class="ac-badge" onclick="editBaseAC(${index})">${totalAC}</div>
    </div>

    <div style="flex-grow: 1; margin-left: 10px;">
        <strong>${unit.name}</strong><br>
        <small>Инициатива:</small> <span class="init-value" onclick="editInit(${index})">${unit.init}</span>
        ${unit.acNote ? `<div class="unit-note ac-note">${unit.acNote}</div>` : ''}
    </div>

    <div class="mod-buttons">
        <button class="shield-btn ${unit.mods.shield ? 'active' : ''}" onclick="toggleMod(${index}, 'shield')" title="+2 Щит">🛡️+</button>
        <button class="shield-btn ${unit.mods.cover === '1/2' ? 'active' : ''}" onclick="toggleMod(${index}, '1/2')">1/2</button>
        <button class="shield-btn ${unit.mods.cover === '3/4' ? 'active' : ''}" onclick="toggleMod(${index}, '3/4')">3/4</button>
    </div>

    <div class="hp-box">
        <span class="hp-value" onclick="editHP(${index})" onwheel="changeHP(event, ${index})">
            ${unit.currentHp}/${unit.maxHp}
        </span>
        ${unit.hpNote ? `<div class="unit-note hp-note">${unit.hpNote}</div>` : ''}
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
        // Защита: если поля нет в объекте, берем из массива значений или ставим дефолт
        const name = (item["Имя"] || values[0] || "Монстр").replace(/'/g, "\\'"); // Экранируем кавычки в именах
        const hp = parseInt(item["MaxHP"] || values[1]) || 0;
        const ac = parseInt(item["AC"] || values[2]) || 0;
        const img = item["Фото"] || values[4] || 'https://i.imgur.com/83p7pId.png';

        const div = document.createElement('div');
        div.className = 'library-item';
        // Передаем параметры как строки, чтобы избежать пустых мест в JS
        div.innerHTML = `
            <div class="lib-info" onclick="addMonsterToCombat('${name}', ${hp}, ${ac}, '${img}')">
                <img src="${img}" onerror="this.src='https://i.imgur.com/83p7pId.png'">
                <span>${name} ${ac > 0 ? `<small>(AC: ${ac})</small>` : ''}</span>
            </div>
            <div class="lib-actions">
                <label class="btn-lib-upload" title="Обновить фото">
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

function addMonsterToCombat(name, hpRaw, acRaw, img) {
    // Функция для разделения числа и текста
    const parseValue = (str) => {
        if (!str) return { val: 0, note: "" };
        const s = str.toString();
        // Ищем первое число в строке
        const match = s.match(/^(\d+)/);
        const val = match ? parseInt(match[1]) : 0;
        // Забираем всё, что идет после первого числа, и чистим от скобок
        let note = s.replace(/^\d+/, "").replace(/[()]/g, "").trim();
        return { val, note };
    };

    const hpData = parseValue(hpRaw);
    const acData = parseValue(acRaw);

    const unit = {
        name: name || "Монстр",
        maxHp: hpData.val,
        currentHp: hpData.val,
        hpNote: hpData.note, // Текст для столбца H
        ac: acData.val,
        acNote: acData.note, // Текст для столбца G
        init: 0,
        img: img || 'https://i.imgur.com/83p7pId.png',
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
    fetch(API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ sheet, action, data }) });
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





