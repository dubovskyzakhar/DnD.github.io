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
function renderCombatList() {
    const list = document.getElementById('character-list');
    if (!list) return;
    list.innerHTML = '';
    
    // Сортировка по инициативе (от большего к меньшему)
    combatants.sort((a, b) => b.init - a.init);

    combatants.forEach((unit, index) => {
        const div = document.createElement('div');
        div.className = `character-card ${unit.type === 'monster' ? 'monster-card' : ''}`;
        div.innerHTML = `
            <div style="position: relative;" class="avatar-container">
                <img src="${unit.img || 'https://i.imgur.com/83p7pId.png'}" class="avatar" 
                     onerror="this.src='https://i.imgur.com/83p7pId.png';">
                
                <label class="upload-badge" title="Загрузить фото">
                    📷
                    <input type="file" accept="image/*" style="display:none" onchange="updateUnitPhoto(event, ${index})">
                </label>

                ${unit.ac ? `<div class="ac-badge">${unit.ac}</div>` : ''}
            </div>
            <div>
                <strong>${unit.name}</strong><br>
                Инициатива: <span class="init-value" onclick="editInit(${index})">${unit.init}</span>
            </div>
            <div class="hp-box">
                HP: <span class="hp-value" onclick="editHP(${index})" onwheel="changeHP(event, ${index})">
                    ${unit.currentHp}/${unit.maxHp}
                </span>
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

function displayHeroes(heroes) {
    const container = document.getElementById('hero-library-list');
    container.innerHTML = '';
    heroes.forEach((item) => {
        const values = Object.values(item);
        const name = item["Имя"] || values[0];
        const hp = parseInt(item["MaxHP"] || values[1]) || 10;
        const img = item["Фото"] || values[4] || 'https://i.imgur.com/83p7pId.png';

        const div = document.createElement('div');
        div.className = 'library-item';
        div.innerHTML = `
            <div class="lib-info" onclick="addHeroToCombat('${name}', ${hp}, '${img}')">
                <img src="${img}" onerror="this.src='https://i.imgur.com/83p7pId.png'">
                <span>${name} <small>(HP: ${hp})</small></span>
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

function filterHeroes() {
    const query = document.getElementById('hero-search').value.toLowerCase();
    const filtered = fullHeroDatabase.filter(h => {
        const name = (h["Имя"] || Object.values(h)[0] || "").toString().toLowerCase();
        return name.includes(query);
    });
    displayHeroes(filtered);
}

function addHeroToCombat(name, hp, img) {
    combatants.push({ name, maxHp: hp, currentHp: hp, init: 0, img, type: 'hero' });
    saveData(); renderCombatList();
    alert(`${name} в строю!`);
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
        const name = item["Имя"] || values[0];
        const hp = item["MaxHP"] || values[1];
        const ac = item["AC"] || values[2];
        const img = item["Фото"] || values[4] || 'https://i.imgur.com/83p7pId.png';

        const div = document.createElement('div');
        div.className = 'library-item';
        div.innerHTML = `
            <div class="lib-info" onclick="addMonsterToCombat('${name}', ${hp}, ${ac}, '${img}')">
                <img src="${img}" onerror="this.src='https://i.imgur.com/83p7pId.png'">
                <span>${name} <small>(AC: ${ac})</small></span>
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

function filterMonsters() {
    const query = document.getElementById('monster-search').value.toLowerCase();
    const filtered = fullMonsterDatabase.filter(m => {
        const name = (m["Имя"] || Object.values(m)[0] || "").toString().toLowerCase();
        return name.includes(query);
    });
    displayMonsters(filtered);
}

function addMonsterToCombat(name, hp, ac, img) {
    combatants.push({ name, maxHp: hp, currentHp: hp, ac, init: 0, img, type: 'monster' });
    saveData(); renderCombatList();
    alert(`${name} добавлен в бой!`);
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
