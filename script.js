let combatants = JSON.parse(localStorage.getItem('dnd_combatants')) || [];
const API_URL = "https://script.google.com/macros/s/AKfycbyWl5zL8k_cWPkXbc1O7E1YwEW9jaSFJ11Eya6IcSeXLSx724Bdw_I-ZIBluJhOv9NyLA/exec"; 

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId + '-tab').classList.add('active');
    if(tabId === 'settings') loadLibrary();
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
    if (!fileInput.files[0]) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const raw = JSON.parse(e.target.result);
            let data = (raw.data && typeof raw.data === 'string') ? JSON.parse(raw.data) : (raw.data || raw);
            const name = data.name?.value || data.name || "Герой";

            // ПРОВЕРКА БД (Столбец A)
            const resp = await fetch(`${API_URL}?sheet=Characters`);
            const db = await resp.json();
            const exists = db.find(r => (r["Имя"] || r["name"] || r[0]) === name);

            const unit = {
                name: name,
                maxHp: exists ? (exists["MaxHP"] || 10) : (data.vitality?.["hp-max"]?.value || 10),
                currentHp: exists ? (exists["MaxHP"] || 10) : (data.vitality?.["hp-max"]?.value || 10),
                init: (Math.floor(Math.random() * 20) + 1) + (data.stats?.dex?.modifier || 0),
                img: exists ? (exists["Фото"] || "") : (data.avatar?.webp || ""),
                type: 'hero'
            };

            if (!exists) {
                await sendDataToSheets('Characters', 'add', [unit.name, unit.maxHp, unit.maxHp, unit.init, unit.img]);
            }

            combatants.push(unit);
            saveData(); renderCombatList(); switchTab('battle');
        } catch (err) { alert("Ошибка JSON!"); }
    };
    reader.readAsText(fileInput.files[0]);
}

async function loadLibrary() {
    const select = document.getElementById('db-character-select');
    try {
        const resp = await fetch(`${API_URL}?sheet=Characters`);
        const data = await resp.json();
        select.innerHTML = '<option value="">-- Выберите героя --</option>';
        data.forEach(item => {
            const opt = document.createElement('option');
            opt.value = JSON.stringify(item);
            opt.textContent = "👤 " + (item["Имя"] || item["name"]);
            select.appendChild(opt);
        });
    } catch (e) { select.innerHTML = '<option>Ошибка загрузки БД</option>'; }
}

function addFromLibrary() {
    const select = document.getElementById('db-character-select');
    if (!select.value) return;
    const data = JSON.parse(select.value);
    combatants.push({
        name: data["Имя"] || data["name"],
        maxHp: parseInt(data["MaxHP"] || 10),
        currentHp: parseInt(data["MaxHP"] || 10),
        init: Math.floor(Math.random() * 20) + 1,
        img: data["Фото"] || data["фото"] || "",
        type: 'hero'
    });
    saveData(); renderCombatList(); switchTab('battle');
}

async function addMonsterByUrl() {
    const urlInput = document.getElementById('monster-url');
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlInput.value)}`;
    try {
        const resp = await fetch(proxyUrl);
        const d = await resp.json();
        const doc = new DOMParser().parseFromString(d.contents, 'text/html');
        const name = doc.querySelector('h1')?.innerText || "Монстр";
        const hp = parseInt(d.contents.match(/(?:Хиты|Hit Points)\s*[:]?\s*(\d+)/i)?.[1] || 50);
        combatants.push({ name, maxHp: hp, currentHp: hp, init: Math.floor(Math.random() * 20) + 1, img: "", type: 'monster' });
        saveData(); renderCombatList(); urlInput.value = ""; switchTab('battle');
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
    const bg = localStorage.getItem('dnd_bg');
    if(bg) document.getElementById('main-bg').style.backgroundImage = `url(${bg})`;
    renderCombatList();
    new Sortable(document.getElementById('character-list'), { animation: 150, onEnd: () => {
        const items = Array.from(document.querySelectorAll('.character-card strong')).map(el => el.innerText);
        combatants.sort((a, b) => items.indexOf(a.name) - items.indexOf(b.name));
        saveData();
    }});
};
