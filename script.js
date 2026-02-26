let combatants = JSON.parse(localStorage.getItem('dnd_combatants')) || [];
const API_URL = "https://script.google.com/macros/s/AKfycbyWl5zL8k_cWPkXbc1O7E1YwEW9jaSFJ11Eya6IcSeXLSx724Bdw_I-ZIBluJhOv9NyLA/exec"; 

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId + '-tab').classList.add('active');
    if(tabId === 'settings') loadLibrary();
}

function renderCombatList() {
    const list = document.getElementById('character-list');
    if (!list) return;
    list.innerHTML = '';
    
    combatants.sort((a, b) => b.init - a.init);

    combatants.forEach((unit, index) => {
        const div = document.createElement('div');
        // Добавляем класс monster-card если это монстр
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

function editInit(index) {
    let newVal = prompt("Установить инициативу:", combatants[index].init);
    if (newVal !== null && !isNaN(newVal)) {
        combatants[index].init = parseInt(newVal);
        saveData(); renderCombatList();
    }
}

function editHP(index) {
    let newVal = prompt("Текущее HP:", combatants[index].currentHp);
    if (newVal !== null && !isNaN(newVal)) {
        combatants[index].currentHp = parseInt(newVal);
        saveData(); renderCombatList();
    }
}

function changeHP(e, index) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    combatants[index].currentHp = Math.max(0, parseInt(combatants[index].currentHp) + delta);
    saveData(); renderCombatList();
}

function deleteUnit(index) {
    if (confirm("Удалить?")) {
        combatants.splice(index, 1);
        saveData(); renderCombatList();
    }
}

async function importCharacter() {
    const fileInput = document.getElementById('import-json');
    if (!fileInput.files[0]) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const raw = JSON.parse(e.target.result);
            let data = (raw.data && typeof raw.data === 'string') ? JSON.parse(raw.data) : (raw.data || raw);
            const charName = data.name?.value || data.name || "Герой";

            // Проверка дубликатов в Google Sheets
            const response = await fetch(`${API_URL}?sheet=Characters`);
            const dbData = await response.json();
            if (dbData.some(row => (row.Имя || row.name) === charName)) {
                alert(`Персонаж "${charName}" уже есть в БД!`);
                return;
            }

            const newChar = {
                name: charName,
                maxHp: data.vitality?.["hp-max"]?.value || 10,
                currentHp: data.vitality?.["hp-max"]?.value || 10,
                init: (Math.floor(Math.random() * 20) + 1) + (data.stats?.dex?.modifier || 0),
                img: data.avatar?.webp || "",
                type: 'hero'
            };

            combatants.push(newChar);
            saveData(); renderCombatList();
            await sendDataToSheets('Characters', 'add', [newChar.name, newChar.maxHp, newChar.currentHp, newChar.init, newChar.img]);
            loadLibrary();
        } catch (err) { alert("Ошибка JSON!"); }
    };
    reader.readAsText(fileInput.files[0]);
}

async function loadLibrary() {
    const select = document.getElementById('db-character-select');
    try {
        const response = await fetch(`${API_URL}?sheet=Characters`);
        const data = await response.json();
        select.innerHTML = '<option value="">-- Выберите героя --</option>';
        data.forEach(item => {
            const opt = document.createElement('option');
            opt.value = JSON.stringify(item);
            opt.textContent = item.Имя || item.name;
            select.appendChild(opt);
        });
    } catch (e) { select.innerHTML = '<option>Ошибка загрузки БД</option>'; }
}

function addFromLibrary() {
    const select = document.getElementById('db-character-select');
    if (!select.value) return;
    const data = JSON.parse(select.value);
    combatants.push({
        name: data.Имя || data.name,
        maxHp: parseInt(data.MaxHP || 10),
        currentHp: parseInt(data.MaxHP || 10),
        init: Math.floor(Math.random() * 20) + 1,
        img: data.Фото || data.img || "",
        type: 'hero'
    });
    saveData(); renderCombatList(); switchTab('battle');
}

async function addMonsterByUrl() {
    const urlInput = document.getElementById('monster-url');
    if(!urlInput.value) return;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlInput.value)}`;
    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();
        const doc = new DOMParser().parseFromString(data.contents, 'text/html');
        const name = doc.querySelector('h1')?.innerText || "Монстр";
        const hpMatch = data.contents.match(/(?:Хиты|Hit Points)\s*[:]?\s*(\d+)/i);
        const hp = hpMatch ? parseInt(hpMatch[1]) : 50;
        const newM = { name, maxHp: hp, currentHp: hp, init: Math.floor(Math.random() * 20) + 1, img: "", type: 'monster' };
        combatants.push(newM);
        saveData(); renderCombatList();
        await sendDataToSheets('Monsters', 'add', [newM.name, newM.maxHp, newM.currentHp, newM.init, ""]);
        urlInput.value = "";
    } catch (e) { alert("Ошибка!"); }
}

async function sendDataToSheets(sheet, action, data) {
    fetch(API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ sheet, action, data }) });
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

window.onload = () => {
    const savedBg = localStorage.getItem('dnd_bg');
    if(savedBg) document.getElementById('main-bg').style.backgroundImage = `url(${savedBg})`;
    renderCombatList();
    loadLibrary();
    new Sortable(document.getElementById('character-list'), { animation: 150, onEnd: () => {
        // Логика перемещения внутри массива combatants
        const listItems = document.querySelectorAll('.character-card');
        const newList = [];
        // В реальном времени синхронизируем массив с DOM
        // (Для упрощения можно оставить просто визуально, либо пересобрать массив здесь)
    }});
};
