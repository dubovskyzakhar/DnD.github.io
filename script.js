let combatants = JSON.parse(localStorage.getItem('dnd_combatants')) || [];
let fullMonsterDatabase = []; 
let fullHeroDatabase = [];   
const DND_STATUSES = [
    "Бессознательный", "Испуган", "Истощен", "Невидимый", "Недееспособен", 
    "Окаменевший", "Ослеплен", "Опутан", "Отравлен", "Очарован", 
    "Оглушен", "Ошеломлен", "Парализован", "Сбит с ног", "Схвачен"
];
const DND_SPELLS_DATA = {
    "Метка охотника": "🎯", "Порча": "💀", "Вынужденная дуэль": "🤺", 
    "Проклятие": "🌑", "Сглаз": "🧿", "Благословение": "✨", 
    "Огонь фей": "🧚", "Меткий удар": "🏹", "Клеймящая кара": "🔥", 
    "Гневная кара": "💢", "Ослепляющая кара": "☀️", "Раскалённый металл": "🌡️", 
    "Замедление": "⏳", "Ускорение": "⚡", "Подчинение личности": "🧠", 
    "Обет": "📜", "Изгнание": "🌀", "Щит веры": "🛡️", 
    "Опутывание": "🌿", "Паутина": "🕸️", "Страх": "😱"
};

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

function toggleStatus(index, status) {
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

function toggleStatusMenu(index) {
    const menu = document.getElementById(`status-menu-${index}`);
    const card = document.getElementById(`unit-${index}`);
    
    document.querySelectorAll('.status-dropdown').forEach(m => m.style.display = 'none');
    document.querySelectorAll('.character-card').forEach(c => c.classList.remove('has-open-menu'));

    if (menu.style.display === 'grid') {
        menu.style.display = 'none';
        card.classList.remove('has-open-menu');
    } else {
        menu.style.display = 'grid';
        card.classList.add('has-open-menu');
        
        // Оставляем только обычные статусы
        menu.innerHTML = `
            <div class="status-section-title">Статусы</div>
            ${DND_STATUSES.map(s => `<div class="status-option" onclick="toggleStatus(${index}, '${s}')">${s}</div>`).join('')}
        `;
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

    if (fileInput && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const monsterData = JSON.parse(e.target.result);
                const fullName = monsterData.name || "Новый монстр";
                
                // Обработка фото
                const engNameMatch = fullName.match(/\[(.*?)\]/);
                const nameToProcess = engNameMatch ? engNameMatch[1] : fullName;
                const slug = nameToProcess.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^\w]/g, '');
                let img = `https://img.ttg.club/tokens/round/${slug}.webp`;

                // ЛОГИКА ДОП ХИТОВ (Столбец H)
                let hpFormula = monsterData.hp?.formula || "";
                let finalHpNote = "";
                if (hpFormula && !/^\d+d\d+/.test(hpFormula)) {
                    finalHpNote = hpFormula.includes('+') ? hpFormula.substring(hpFormula.indexOf('+') + 1).trim() : hpFormula;
                }

                // ЛОГИКА КД И БМ (Столбец G)
                let acVal = 10;
                let acNote = "";
                if (Array.isArray(monsterData.ac)) {
                    const firstAC = monsterData.ac[0];
                    acVal = typeof firstAC === 'object' ? firstAC.ac : firstAC;
                    if (typeof firstAC === 'object' && firstAC.from) {
                        acNote = firstAC.from.map(s => s.replace(/\{@.*?\}/g, "")).join(", ");
                    }
                }
                
                // ЖЕСТКАЯ ПРОВЕРКА НА БМ (Бонус мастерства)
                const rawString = JSON.stringify(monsterData);
                if (rawString.includes("Proficiency Bonus") || rawString.includes("бонус мастерства") || rawString.includes("БМ")) {
                    acNote += (acNote ? " + " : "") + "бонус мастерства";
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

                addMonsterToCombat(dbData.name, dbData.hp, dbData.ac, dbData.img, dbData.hpNote, dbData.acNote);
                await addMonsterToDB(dbData);
                alert(`Монстр ${fullName} добавлен!`);
            } catch (err) { alert("Ошибка JSON!"); }
        };
        reader.readAsText(fileInput.files[0]);
    } else if (nameField && nameField.value.trim() !== "") {
        // Ручной ввод остается без изменений
        const dbData = { name: nameField.value, hp: parseInt(hpField.value) || 10, ac: parseInt(acField.value) || 10, type: "manual", img: 'https://i.imgur.com/83p7pId.png', description: "Вручную", acNote: "", hpNote: "" };
        addMonsterToCombat(dbData.name, dbData.hp, dbData.ac, dbData.img, "", "");
        await addMonsterToDB(dbData);
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

function renderCombatList() {
    const list = document.getElementById('character-list');
    if (!list) return;
    list.innerHTML = '';
    const DEFAULT_AVATAR = 'https://i.imgur.com/83p7pId.png';
    
    combatants.forEach((unit, index) => {
        // Инициализация всех необходимых полей
        if (!unit.mods) unit.mods = { shield: false, cover: null };
        if (!unit.statuses) unit.statuses = [];
        if (!unit.activeSpells) unit.activeSpells = []; // Новое: массив заклинаний

        let bonus = (unit.mods.shield ? 2 : 0) + 
                    (unit.mods.cover === '1/2' ? 2 : 0) + 
                    (unit.mods.cover === '3/4' ? 5 : 0);
        const totalAC = (parseInt(unit.ac) || 0) + bonus;

        const div = document.createElement('div');
        const isDead = (parseInt(unit.currentHp) <= 0);
        
        
        div.className = `character-card ${unit.type === 'monster' ? 'monster-card' : ''} ${isDead ? 'unit-dead' : ''}`;
        div.id = `unit-${index}`;
        
        div.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && !e.target.classList.contains('status-tag') && !e.target.closest('.spell-badge')) {
                selectUnit(index);
            }
        };

        // 1. Обычные статусы
        const statusIcons = unit.statuses.map(s => 
            `<span class="status-tag" onclick="event.stopPropagation(); toggleStatus(${index}, '${s}')">${s} <small>×</small></span>`
        ).join('');

        // 2. Магические метки (Заклинания) с аватаркой кастера
        const spellIcons = unit.activeSpells.map((spell, sIdx) => `
    <div class="spell-badge" onclick="event.stopPropagation(); toggleSpell(${index}, '${spell.name}');">
        <span class="spell-name-text">${DND_SPELLS_DATA[spell.name] || '✨'} ${spell.name}</span>
        <small style="margin-left: 4px; font-weight: bold;">×</small>
    </div>
`).join('');

        div.innerHTML = `
            <div class="avatar-container">
                <img src="${unit.img || DEFAULT_AVATAR}" class="avatar" onerror="this.src='${DEFAULT_AVATAR}';">
                <div class="ac-badge" onclick="event.stopPropagation(); editBaseAC(${index})" title="${unit.acNote || 'Базовая защита'}">
                    ${totalAC}
                    ${(unit.acNote && (unit.acNote.includes('мастерства') || unit.acNote.includes('БМ'))) ? '<span class="pb-label">БМ</span>' : ''}
                </div>
            </div>

            <div class="unit-info">
                <div class="name-row">
                    <strong>${unit.name}</strong>
                    <span class="init-value" onclick="event.stopPropagation(); editInit(${index})" title="Инициатива">${unit.init}</span>
                </div>
                
                <div class="status-container">
                    <div class="active-statuses">
                        ${statusIcons}
                        } </div>
                    <button class="add-status-btn" onclick="event.stopPropagation(); toggleStatusMenu(${index})">✚ Состояние</button>
                    <div id="status-menu-${index}" class="status-dropdown" onclick="event.stopPropagation()">
                        </div>
                </div>
            </div>

            <div class="right-controls-group">
                <div class="mod-buttons">
                    <button class="shield-btn ${unit.mods.shield ? 'active' : ''}" onclick="event.stopPropagation(); toggleMod(${index}, 'shield')" title="Щит (+2 КД)">🛡️</button>
                    <button class="shield-btn ${unit.mods.cover === '1/2' ? 'active' : ''}" onclick="event.stopPropagation(); toggleMod(${index}, '1/2')" title="Укрытие 1/2 (+2 КД)">½</button>
                    <button class="shield-btn ${unit.mods.cover === '3/4' ? 'active' : ''}" onclick="event.stopPropagation(); toggleMod(${index}, '3/4')" title="Укрытие 3/4 (+5 КД)">¾</button>
                </div>

                <div class="hp-heart-container" onclick="event.stopPropagation(); editHP(${index})" onwheel="changeHP(event, ${index})" title="${unit.hpNote || 'Здоровье'}">
                    <svg viewBox="0 0 32 32" class="hp-heart-svg">
                        <path d="M16,28.261c0,0-14-7.926-14-17.046c0-9.356,13.159-10.399,14,0.454c0.841-10.853,14-9.81,14-0.454 C30,20.335,16,28.261,16,28.261z" fill="#9e2121" stroke="#333" stroke-width="1"/>
                    </svg>
                    <div class="hp-text-overlay">
                        <span class="hp-current">${unit.currentHp}</span>
                        <span class="hp-divider-slash">/</span>
                        <span class="hp-max">${unit.maxHp}</span>
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button class="clone-btn" onclick="event.stopPropagation(); cloneUnit(${index})" title="Клонировать юнита">👯</button>
                    <button class="delete-btn" onclick="event.stopPropagation(); deleteUnit(${index})" title="Удалить из боя">🗑️</button>
                </div>
            </div>
        `;
        list.appendChild(div);
    });
}

// 3. ФУНКЦИИ ГЕРОЕВ (БИБЛИОТЕКА)
async function loadHeroLibrary() {
    const container = document.getElementById('hero-library-list');
    if (!container) return;

    // 1. Пытаемся взять данные из кэша
    const cachedHeroes = localStorage.getItem('dnd_cache_heroes');
    if (cachedHeroes) {
        fullHeroDatabase = JSON.parse(cachedHeroes);
        displayHeroes(fullHeroDatabase);
    }

    // 2. Параллельно (или если кэша нет) обновляем из сети
    try {
        const response = await fetch(`${API_URL}?sheet=Characters`);
        const data = await response.json();
        fullHeroDatabase = data;
        
        // Сохраняем свежие данные в память
        localStorage.setItem('dnd_cache_heroes', JSON.stringify(data));
        displayHeroes(fullHeroDatabase);
    } catch (e) {
        if (!cachedHeroes) container.innerHTML = 'Ошибка загрузки героев';
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

    const cachedMonsters = localStorage.getItem('dnd_cache_monsters');
    if (cachedMonsters) {
        fullMonsterDatabase = JSON.parse(cachedMonsters);
        displayMonsters(fullMonsterDatabase);
    }

    try {
        const response = await fetch(`${API_URL}?sheet=Enemies`);
        const data = await response.json();
        fullMonsterDatabase = data;
        
        localStorage.setItem('dnd_cache_monsters', JSON.stringify(data));
        displayMonsters(fullMonsterDatabase);
    } catch (e) {
        if (!cachedMonsters) container.innerHTML = 'Ошибка загрузки бестиария';
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

// 5. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (HP, ИНИЦИАТИВА, ФОТО)
function editInit(index) {
    let newVal = prompt("Инициатива:", combatants[index].init);
    if (newVal !== null) { 
        combatants[index].init = parseInt(newVal) || 0; 
        
        // СОРТИРОВКА: по убыванию (от большего к меньшему)
        combatants.sort((a, b) => b.init - a.init);
        
        saveData(); 
        renderCombatList(); 
    }
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
// ИСПРАВЛЕННЫЙ ИМПОРТ ГЕРОЯ
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
            // Извлекаем КД (AC) из JSON, если он есть
            const ac = parseInt(data.attributes?.ac?.value || data.ac) || 10;

            // Добавляем в локальный массив (для вкладки Бой)
            const unit = { 
                name, maxHp: hp, currentHp: hp, 
                ac: ac, init: 0, img, type: 'hero' 
            };
            combatants.push(unit);
            saveData();
            renderCombatList();
            
            // ОТПРАВЛЯЕМ В ТАБЛИЦУ Characters
            // Столбцы: A:Имя | B:MaxHP | C:CurrHP | D:Init | E:Фото | F:КД (AC)
            await sendDataToSheets('Characters', 'add', [name, hp, hp, 0, img, ac]);
            
            switchTab('battle');
        } catch (err) { alert("Ошибка JSON героя!"); }
    };
    reader.readAsText(fileInput.files[0]);
}

function selectUnit(index) {
    const unit = combatants[index];
    if (!unit) return;

    // 1. Визуальное выделение карточки
    document.querySelectorAll('.character-card').forEach(card => card.classList.remove('selected'));
    const target = document.getElementById(`unit-${index}`);
    if (target) target.classList.add('selected');

    // 2. Работа с панелью информации
    const panel = document.getElementById('info-panel');
    const frame = document.getElementById('info-frame');
    const title = document.getElementById('info-title');

    if (unit.type === 'monster') {
        // Генерируем ссылку
        const slug = nameToSlug(unit.name);
        const url = `https://5e14.ttg.club/bestiary/${slug}`;
        
        frame.src = url;
        title.innerText = unit.name;
        panel.classList.add('active');
    } else {
        // Для героев можно либо закрывать, либо ничего не делать
        // closeInfoPanel(); 
    }

    localStorage.setItem('dnd_last_selected_monster', index);
}

function closeInfoPanel() {
    const panel = document.getElementById('info-panel');
    panel.classList.remove('active');
    document.getElementById('info-frame').src = 'about:blank';
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

// 2. Быстрое добавление (кнопка +)
function quickAddUnit() {
    const name = prompt("Имя юнита:");
    if (!name) return;
    
    const hp = parseInt(prompt("Максимальное HP:", "10")) || 10;
    const ac = parseInt(prompt("Класс доспеха (AC):", "10")) || 10;
    const isMonster = confirm("Это монстр? (ОК - Монстр, Отмена - Герой)");
    
    const newUnit = {
        name: name,
        maxHp: hp,
        currentHp: hp,
        ac: ac,
        init: 0,
        img: 'https://i.imgur.com/83p7pId.png',
        type: isMonster ? 'monster' : 'hero',
        mods: { shield: false, cover: null }
    };

    combatants.push(newUnit);
    saveData();
    renderCombatList();
}

// 3. Клонирование
function cloneUnit(index) {
    const unit = combatants[index];
    const count = prompt(`Сколько клонов "${unit.name}" создать?`, "1");
    if (!count || isNaN(count)) return;

    for (let i = 0; i < parseInt(count); i++) {
        const baseName = unit.name.replace(/_\d+$/, "");
        // Считаем сколько уже есть таких имен в бою
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

function nameToSlug(name) {
    // Извлекаем текст из скобок [Draconic Spirit] -> Draconic Spirit
    const engMatch = name.match(/\[(.*?)\]/);
    let targetName = engMatch ? engMatch[1] : name;

    return targetName
        .toLowerCase()
        .trim()
        // Заменяем пробелы на подчеркивания
        .replace(/\s+/g, '_')
        // Удаляем всё, что не буквы, цифры или подчеркивания
        .replace(/[^\wа-яё]/gi, ''); 
}

function refreshLibraries() {
    localStorage.removeItem('dnd_cache_heroes');
    localStorage.removeItem('dnd_cache_monsters');
    location.reload(); // Перезагрузит страницу и скачает всё заново
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

const lastIdx = localStorage.getItem('dnd_last_selected_monster');
if (lastIdx !== null && combatants[lastIdx]) {
    selectUnit(parseInt(lastIdx));
}
};

document.addEventListener('click', (e) => {
    if (!e.target.closest('.status-container')) {
        document.querySelectorAll('.status-dropdown').forEach(m => m.style.display = 'none');
        document.querySelectorAll('.character-card').forEach(c => c.classList.remove('has-open-menu'));
    }
});













































