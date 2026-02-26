let combatants = JSON.parse(localStorage.getItem('dnd_combatants')) || [];
let fullMonsterDatabase = []; // Для хранения всех монстров из БД
let fullHeroDatabase = [];    // Для хранения всех героев из БД
const API_URL = "https://script.google.com/macros/s/AKfycbyWl5zL8k_cWPkXbc1O7E1YwEW9jaSFJ11Eya6IcSeXLSx724Bdw_I-ZIBluJhOv9NyLA/exec"; 

// Исправленная функция переключения вкладок
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId + '-tab').classList.add('active');
    
    if(tabId === 'settings') {
        loadHeroLibrary();    // Загрузка героев
        loadMonsterLibrary(); // Загрузка монстров
    }
}

function renderCombatList() {
    const list = document.getElementById('character-list');
    list.innerHTML = '';
    combatants.sort((a, b) => b.init - a.init);

    combatants.forEach((unit, index) => {
        const div = document.createElement('div');
        div.className = `character-card ${unit.type === 'monster' ? 'monster-card' : ''}`;
        div.innerHTML = `
            <img src="${unit.img || ''}" class="avatar">
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

function editInit(index) {
    let newVal = prompt("Инициатива:", combatants[index].init);
    if (newVal !== null) { combatants[index].init = parseInt(newVal); saveData(); renderCombatList(); }
}

function editHP(index) {
    let newVal = prompt("Текущее HP:", combatants[index].currentHp);
    if (newVal !== null) { combatants[index].currentHp = parseInt(newVal); saveData(); renderCombatList(); }
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

async function importCharacter() {
    const fileInput = document.getElementById('import-json');
    if (!fileInput.files[0]) return alert("Выбери файл JSON!");

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const raw = JSON.parse(e.target.result);
            let data = (raw.data && typeof raw.data === 'string') ? JSON.parse(raw.data) : (raw.data || raw);
            
            const nameFromJSON = (data.name?.value || data.name || "Герой").toString().trim();
            const resp = await fetch(`${API_URL}?sheet=Characters`);
            const db = await resp.json();
            
            const exists = db.find(row => Object.values(row).some(v => v?.toString().trim().toLowerCase() === nameFromJSON.toLowerCase()));

            const unit = {
                name: nameFromJSON,
                maxHp: exists ? (parseInt(exists["MaxHP"] || Object.values(exists)[1]) || 10) : (parseInt(data.vitality?.["hp-max"]?.value || data.hp) || 10),
                currentHp: exists ? (parseInt(exists["MaxHP"] || Object.values(exists)[1]) || 10) : (parseInt(data.vitality?.["hp-max"]?.value || data.hp) || 10),
                init: 0, // Установлено в 0
                img: exists ? (exists["Фото"] || Object.values(exists)[4] || "") : (data.avatar?.webp || data.avatar?.jpeg || ""),
                type: 'hero'
            };

            if (!exists) {
                await sendDataToSheets('Characters', 'add', [unit.name, unit.maxHp, unit.maxHp, unit.init, unit.img]);
                setTimeout(loadLibrary, 2000);
            }

            combatants.push(unit);
            saveData(); 
            renderCombatList(); 
            switchTab('battle');
        } catch (err) { console.error(err); alert("Ошибка JSON!"); }
    };
    reader.readAsText(fileInput.files[0]);
}

let selectedHeroData = null; // Переменная для хранения выбранного героя

// Закрывать список, если кликнули мимо
window.addEventListener('click', function(e) {
    if (!document.getElementById('library-select-container').contains(e.target)) {
        document.getElementById('library-options').classList.remove('active');
    }
});

async function importMonster() {
    const fileInput = document.getElementById('monster-json');
    if (!fileInput.files[0]) return alert("Выбери JSON файл монстра!");

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const raw = JSON.parse(e.target.result);
            
            // 1. Извлекаем данные из JSON
            const name = (raw.name || "Монстр").toString().trim();
            const hp = parseInt(raw.hp?.average || 10); // Хиты
            const ac = parseInt(raw.ac?.[0] || 10);     // КД (Класс Доспеха)
            const type = raw.type || "unknown";
            
            // 2. Логика формирования ссылки на фото (как в твоих примерах)
            // Ищем английское имя в скобках, например [Halaster Puppet]
            const englishNameMatch = name.match(/\[(.*?)\]/);
            const cleanName = englishNameMatch ? englishNameMatch[1] : name;
            
            // Переводим в нижний регистр и заменяем пробелы на подчеркивания
            // Было: "Halaster Puppet" -> Стало: "halaster_puppet"
            const formattedName = cleanName.toLowerCase().trim().replace(/\s+/g, '_');
            
            // Собираем ссылку на сервер img.ttg.club в формате webp
            const imgUrl = `https://img.ttg.club/tokens/round/${formattedName}.webp`;

            // 3. Проверяем, есть ли уже такой монстр в таблице Enemies
            const resp = await fetch(`${API_URL}?sheet=Enemies`);
            const db = await resp.json();
            const exists = db.find(row => Object.values(row).some(v => v?.toString().trim().toLowerCase() === name.toLowerCase()));

            // 4. Создаем объект юнита для боя
            const newMonster = {
                name: name,
                maxHp: hp,
                currentHp: hp,
                ac: ac,
                init: 0, // Всегда 0 при добавлении
                img: imgUrl, 
                type: 'monster',
                description: raw.trait?.[0]?.name || "" // Первая способность
            };

            // 5. Если монстра нет в базе Enemies — сохраняем его туда
            if (!exists) {
                console.log("Новый монстр! Добавляю в таблицу Enemies...");
                await sendDataToSheets('Enemies', 'add', [
                    newMonster.name, 
                    newMonster.maxHp, 
                    newMonster.ac, 
                    type, 
                    newMonster.img, 
                    newMonster.description
                ]);
            }

            // 6. Добавляем в локальный список бойцов и перерисовываем
            combatants.push(newMonster);
            saveData();
            renderCombatList();
            
            // Очищаем поле выбора и переходим на вкладку боя
            fileInput.value = "";
            switchTab('battle');

        } catch (err) {
            console.error("Ошибка парсинга JSON:", err);
            alert("Ошибка чтения JSON! Проверь формат файла.");
        }
    };
    reader.readAsText(fileInput.files[0]);
}

// Загрузка списка героев из Google Sheets
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

// Отрисовка героев в настройках
function displayHeroes(heroes) {
    const container = document.getElementById('hero-library-list');
    container.innerHTML = '';
    
    heroes.forEach((item) => {
        const values = Object.values(item);
        const name = item["Имя"] || values[0];
        const hp = item["MaxHP"] || values[1];
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

// Фильтр для поиска героев
function filterHeroes() {
    const query = document.getElementById('hero-search').value.toLowerCase();
    const filtered = fullHeroDatabase.filter(h => {
        const name = (h["Имя"] || Object.values(h)[0]).toString().toLowerCase();
        return name.includes(query);
    });
    displayHeroes(filtered);
}

// Быстрое добавление героя в бой
function addHeroToCombat(name, hp, img) {
    const unit = {
        name: name,
        maxHp: hp,
        currentHp: hp,
        init: 0,
        img: img,
        type: 'hero'
    };
    combatants.push(unit);
    saveData();
    renderCombatList();
    alert(`${name} добавлен в бой!`);
}

// Обновление фото героя напрямую в БД
async function uploadHeroPhotoDirect(heroName, event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Image = e.target.result;
        try {
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({
                    sheet: 'Characters',
                    action: 'updatePhoto',
                    name: heroName,
                    photo: base64Image
                })
            });
            alert(`Портрет ${heroName} обновлен в базе!`);
            loadHeroLibrary(); 
        } catch (err) {
            alert("Ошибка связи с БД");
        }
    };
    reader.readAsDataURL(file);
}

// Обновим функцию отрисовки, чтобы видеть AC
function renderCombatList() {
    const list = document.getElementById('character-list');
    list.innerHTML = '';
    combatants.sort((a, b) => b.init - a.init);

    combatants.forEach((unit, index) => {
        const div = document.createElement('div');
        div.className = `character-card ${unit.type === 'monster' ? 'monster-card' : ''}`;
        div.innerHTML = `
            <div style="position: relative;" class="avatar-container">
                <img src="${unit.img || ''}" class="avatar" id="avatar-${index}" 
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

async function sendDataToSheets(sheet, action, data) {
    fetch(API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ sheet, action, data }) });
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
                    <input type="file" style="display:none" onchange="uploadPhotoDirect('${name}', event)">
                </label>
            </div>
        `;
        container.appendChild(div);
    });
}

function filterMonsters() {
    const query = document.getElementById('monster-search').value.toLowerCase();
    const filtered = fullMonsterDatabase.filter(m => {
        const name = (m["Имя"] || Object.values(m)[0]).toLowerCase();
        return name.includes(query);
    });
    displayMonsters(filtered);
}

function saveData() { localStorage.setItem('dnd_combatants', JSON.stringify(combatants)); }

function changeBackground(event) {
    const reader = new FileReader();
    reader.onload = () => {
        document.getElementById('main-bg').style.backgroundImage = `url(${reader.result})`;
        localStorage.setItem('dnd_bg', reader.result);
    };
    reader.readAsDataURL(event.target.files[0]);
}

async function updateUnitPhoto(event, index) {
    const file = event.target.files[0];
    if (!file) return;

    // Ограничение 1МБ, чтобы ячейка таблицы не переполнилась
    if (file.size > 1024 * 1024) return alert("Файл слишком большой!");

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Image = e.target.result;
        const unit = combatants[index];

        // 1. Обновляем визуально в браузере сразу
        unit.img = base64Image;
        saveData();
        renderCombatList();

        // 2. Отправляем в БД для перезаписи столбца E
        if (unit.type === 'monster') {
            console.log("Перезаписываю фото в БД для:", unit.name);
            
            // Используем fetch БЕЗ 'no-cors', чтобы увидеть ответ от сервера
            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        sheet: 'Enemies',
                        action: 'updatePhoto',
                        name: unit.name, // Например: "Кукла Халастера [Halaster Puppet]"
                        photo: base64Image
                    })
                });
                const result = await response.json();
                console.log("Результат обновления:", result.status);
            } catch (err) {
                console.log("Запрос отправлен (в режиме фонового обновления)");
            }
        }
    };
    reader.readAsDataURL(file);
}

// Дополни этот вызов в существующую функцию switchTab
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId + '-tab').classList.add('active');
    if(tabId === 'settings') {
        loadLibrary();        // Загрузка героев
        loadMonsterLibrary(); // Загрузка монстров
    }
}

async function loadMonsterLibrary() {
    const container = document.getElementById('monster-library-list');
    if (!container) return;

    try {
        const response = await fetch(`${API_URL}?sheet=Enemies`);
        fullMonsterDatabase = await response.json(); // Сохраняем всех монстров
        displayMonsters(fullMonsterDatabase); // Отображаем всех
    } catch (e) {
        container.innerHTML = 'Ошибка загрузки бестиария';
    }
}

// Функция добавления в бой прямо из списка настроек
function addMonsterToCombat(name, hp, ac, img) {
    const unit = {
        name: name,
        maxHp: hp,
        currentHp: hp,
        ac: ac,
        init: 0,
        img: img,
        type: 'monster'
    };
    combatants.push(unit);
    saveData();
    renderCombatList();
    alert(`${name} добавлен в бой!`);
}

// Функция загрузки фото напрямую в БД из списка настроек
async function uploadPhotoDirect(monsterName, event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Image = e.target.result;
        
        // Отправляем в Google Sheets (используем тот же action: updatePhoto)
        try {
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({
                    sheet: 'Enemies',
                    action: 'updatePhoto',
                    name: monsterName,
                    photo: base64Image
                })
            });
            alert(`Фото для ${monsterName} обновлено в базе данных!`);
            loadMonsterLibrary(); // Перезагружаем список, чтобы увидеть новую иконку
        } catch (err) {
            alert("Ошибка связи с БД");
        }
    };
    reader.readAsDataURL(file);
}

window.onload = () => {
    const bg = localStorage.getItem('dnd_bg');
    if(bg) document.getElementById('main-bg').style.backgroundImage = `url(${bg})`;
    
    renderCombatList();

    new Sortable(document.getElementById('character-list'), {
        animation: 150,
        onEnd: function (evt) {
            if (evt.oldIndex === evt.newIndex) return;

            // Извлекаем перемещаемый объект из массива
            const movedItem = combatants.splice(evt.oldIndex, 1)[0];
            // Вставляем его в новую позицию в массиве, чтобы правильно вычислить соседей
            combatants.splice(evt.newIndex, 0, movedItem);

            let newInit;
            const targetIndex = evt.newIndex;

            if (evt.newIndex < evt.oldIndex) {
                // ПЕРЕМЕЩЕНИЕ ВВЕРХ
                // Берем юнита под ним (index + 1) и добавляем 1
                const unitBelow = combatants[targetIndex + 1];
                newInit = unitBelow ? unitBelow.init + 1 : movedItem.init;
                console.log(`Перенос вверх: берем у нижнего (${unitBelow.init}) + 1`);
            } else {
                // ПЕРЕМЕЩЕНИЕ ВНИЗ
                // Берем юнита над ним (index - 1) и вычитаем 1
                // (Если прибавить 1, он снова станет выше него и сортировка вернет его назад)
                const unitAbove = combatants[targetIndex - 1];
                newInit = unitAbove ? unitAbove.init - 1 : movedItem.init;
                console.log(`Перенос вниз: берем у верхнего (${unitAbove.init}) - 1`);
            }

            // Присваиваем новую инициативу
            movedItem.init = newInit;

            // Сохраняем и перерисовываем
            saveData();
            renderCombatList();
        }
    });
};











