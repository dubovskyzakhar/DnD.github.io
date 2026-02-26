// Основной массив для всех участников боя
let combatants = JSON.parse(localStorage.getItem('dnd_combatants')) || [];

// ТВОЯ ССЫЛКА (убедись, что она актуальна и развернута как "Anyone")
const API_URL = "https://script.google.com/macros/s/AKfycbyWl5zL8k_cWPkXbc1O7E1YwEW9jaSFJ11Eya6IcSeXLSx724Bdw_I-ZIBluJhOv9NyLA/exec"; 

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId + '-tab').classList.add('active');
    if(tabId === 'settings') loadLibrary(); // Обновляем библиотеку при входе в настройки
}

// Рендер единого списка инициативы
function renderCombatList() {
    const list = document.getElementById('character-list'); // Используем один контейнер
    if (!list) return;
    
    list.innerHTML = '';
    
    // Сортировка по инициативе (от высшей к низшей)
    combatants.sort((a, b) => b.init - a.init);

    combatants.forEach((unit, index) => {
        const div = document.createElement('div');
        // Если монстр — добавляем специальный класс для красного цвета
        div.className = `character-card ${unit.type === 'monster' ? 'monster-card' : ''}`;
        
        div.innerHTML = `
            <img src="${unit.img || ''}" class="avatar">
            <div class="info">
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

// Изменение инициативы вручную
function editInit(index) {
    let newVal = prompt("Введите значение инициативы:", combatants[index].init);
    if (newVal !== null && !isNaN(newVal)) {
        combatants[index].init = parseInt(newVal);
        saveData();
        renderCombatList();
    }
}

// Изменение HP (клик или колесико)
function editHP(index) {
    let newVal = prompt("Текущее HP:", combatants[index].currentHp);
    if (newVal !== null && !isNaN(newVal)) {
        combatants[index].currentHp = parseInt(newVal);
        saveData();
        renderCombatList();
    }
}

function changeHP(e, index) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    combatants[index].currentHp = Math.max(0, parseInt(combatants[index].currentHp) + delta);
    saveData();
    renderCombatList();
}

// Удаление
function deleteUnit(index) {
    if (confirm("Удалить из боя?")) {
        combatants.splice(index, 1);
        saveData();
        renderCombatList();
    }
}

// ИМПОРТ ИЗ JSON С ПРОВЕРКОЙ
async function importCharacter() {
    const fileInput = document.getElementById('import-json');
    if (!fileInput.files[0]) return alert("Выбери файл!");

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const raw = JSON.parse(e.target.result);
            let data = (raw.data && typeof raw.data === 'string') ? JSON.parse(raw.data) : (raw.data || raw);
            const charName = data.name?.value || data.name || "Герой";

            // 1. Проверка в Google Sheets (через твой doGet)
            try {
                const response = await fetch(`${API_URL}?sheet=Characters`);
                const dbData = await response.json();
                const exists = dbData.some(row => (row.Имя || row.name) === charName);
                
                if (exists) {
                    alert(`Персонаж "${charName}" уже есть в базе данных! Используйте "Библиотеку" в настройках.`);
                    return;
                }
            } catch (err) { console.log("БД пуста или недоступна, продолжаем..."); }

            // 2. Создание объекта
            const newChar = {
                name: charName,
                maxHp: data.vitality?.["hp-max"]?.value || data.hp || 10,
                currentHp: data.vitality?.["hp-max"]?.value || data.hp || 10,
                init: (Math.floor(Math.random() * 20) + 1) + (data.stats?.dex?.modifier || 0),
                img: data.avatar?.webp || data.avatar?.jpeg || "",
                type: 'hero'
            };

            combatants.push(newChar);
            saveData();
            renderCombatList();

            // 3. Отправка в БД
            await sendDataToSheets('Characters', 'add', [newChar.name, newChar.maxHp, newChar.currentHp, newChar.init, newChar.img]);
            alert(`${charName} добавлен в бой и в базу!`);
            loadLibrary(); // Обновить список в меню

        } catch (err) { alert("Ошибка JSON!"); }
    };
    reader.readAsText(fileInput.files[0]);
}

// ЗАГРУЗКА БИБЛИОТЕКИ ИЗ ТАБЛИЦЫ
async function loadLibrary() {
    const select = document.getElementById('db-character-select');
    if (!select) return;

    try {
        const response = await fetch(`${API_URL}?sheet=Characters`);
        const data = await response.json();
        
        select.innerHTML = '<option value="">-- Выберите героя из БД --</option>';
        data.forEach(item => {
            const opt = document.createElement('option');
            // Сохраняем все данные в value в виде JSON строки
            opt.value = JSON.stringify(item);
            opt.textContent = item.Имя || item.name;
            select.appendChild(opt);
        });
    } catch (e) {
        select.innerHTML = '<option>Ошибка загрузки библиотеки</option>';
    }
}

// ДОБАВЛЕНИЕ ИЗ БИБЛИОТЕКИ В БОЙ
function addFromLibrary() {
    const select = document.getElementById('db-character-select');
    if (!select.value) return alert("Сначала выберите героя!");

    const data = JSON.parse(select.value);
    const newUnit = {
        name: data.Имя || data.name,
        maxHp: parseInt(data.MaxHP || data.maxHp || 10),
        currentHp: parseInt(data.MaxHP || data.maxHp || 10),
        init: Math.floor(Math.random() * 20) + 1, // Бросок инициативы при входе в бой
        img: data.Фото || data.img || "",
        type: 'hero'
    };

    combatants.push(newUnit);
    saveData();
    renderCombatList();
    switchTab('battle');
}

// ДОБАВЛЕНИЕ МОНСТРА (Всегда красный)
async function addMonsterByUrl() {
    const urlInput = document.getElementById('monster-url');
    const url = urlInput.value;
    if(!url) return;

    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();
        const doc = new DOMParser().parseFromString(data.contents, 'text/html');
        
        const name = doc.querySelector('h1')?.innerText || "Монстр";
        const hpMatch = data.contents.match(/(?:Хиты|Hit Points)\s*[:]?\s*(\d+)/i);
        const hp = hpMatch ? parseInt(hpMatch[1]) : 50;
        let imgSrc = doc.querySelector('.image-container img')?.src || "";
        
        const newM = { 
            name, 
            maxHp: hp, 
            currentHp: hp, 
            init: Math.floor(Math.random() * 20) + 1, 
            img: imgSrc,
            type: 'monster' 
        };
        
        combatants.push(newM);
        saveData();
        renderCombatList();
        
        await sendDataToSheets('Monsters', 'add', [newM.name, newM.maxHp, newM.currentHp, newM.init, newM.img]);
        urlInput.value = "";
    } catch (e) { alert("Ошибка загрузки монстра!"); }
}

async function sendDataToSheets(sheet, action, data) {
    try {
        await fetch(API_URL, { 
            method: 'POST', 
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sheet, action, data }) 
        });
    } catch (e) { console.error("Ошибка связи с таблицей"); }
}

function saveData() { localStorage.setItem('dnd_combatants', JSON.stringify(combatants)); }

window.onload = () => {
    const savedBg = localStorage.getItem('dnd_bg');
    if(savedBg) document.getElementById('main-bg').style.backgroundImage = `url(${savedBg})`;
    
    renderCombatList();
    loadLibrary();

    // Настройка перетаскивания (Sortable)
    new Sortable(document.getElementById('character-list'), {
        animation: 150,
        onEnd: (evt) => {
            const moved = combatants.splice(evt.oldIndex, 1)[0];
            combatants.splice(evt.newIndex, 0, moved);
            // При ручном перемещении можно подправить инициативу, чтобы она была между соседями
            saveData();
        }
    });
};
