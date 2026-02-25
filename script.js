let characters = JSON.parse(localStorage.getItem('dnd_chars')) || [];
let monsters = [];

const API_URL = "https://script.google.com/macros/s/AKfycbyWl5zL8k_cWPkXbc1O7E1YwEW9jaSFJ11Eya6IcSeXLSx724Bdw_I-ZIBluJhOv9NyLA/exec"; 

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId + '-tab').classList.add('active');
}

function renderCharacters() {
    const list = document.getElementById('character-list');
    list.innerHTML = '';
    characters.sort((a, b) => b.init - a.init);
    characters.forEach((char, index) => {
        const div = document.createElement('div');
        div.className = 'character-card';
        div.innerHTML = `
            <img src="${char.img || ''}" class="avatar">
            <div><strong>${char.name}</strong><br>Инициатива: ${char.init}</div>
            <div class="hp-box">HP: <span class="hp-value" onwheel="changeHP(event, 'char', ${index})">${char.currentHp}/${char.maxHp}</span></div>
        `;
        list.appendChild(div);
    });
}

function renderMonsters() {
    const list = document.getElementById('monster-list');
    list.innerHTML = '';
    monsters.forEach((m, index) => {
        const div = document.createElement('div');
        div.className = 'character-card';
        div.style.borderLeft = "8px solid #a00"; // Выделяем монстров
        div.innerHTML = `
            <img src="${m.img || ''}" class="avatar">
            <div><strong>${m.name}</strong><br>Инициатива: ${m.init}</div>
            <div class="hp-box">HP: <span class="hp-value" onwheel="changeHP(event, 'monster', ${index})">${m.currentHp}/${m.maxHp}</span></div>
        `;
        list.appendChild(div);
    });
}

function changeHP(e, type, index) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    if(type === 'char') characters[index].currentHp = Math.max(0, parseInt(characters[index].currentHp) + delta);
    else monsters[index].currentHp = Math.max(0, parseInt(monsters[index].currentHp) + delta);
    renderCharacters();
    renderMonsters();
    saveData();
}

// ПРИЗВАТЬ ГЕРОЯ ИЗ JSON
async function importCharacter() {
    const fileInput = document.getElementById('import-json');
    if (!fileInput.files[0]) return alert("Выбери файл!");

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const raw = JSON.parse(e.target.result);
            const data = JSON.parse(raw.data); // Парсим вложенную строку 'data'

            const newChar = {
                name: data.name?.value || "Герой",
                maxHp: data.vitality?.["hp-max"]?.value || 10,
                currentHp: data.vitality?.["hp-max"]?.value || 10,
                init: (Math.floor(Math.random() * 20) + 1) + (data.stats?.dex?.modifier || 0),
                img: data.avatar?.webp || data.avatar?.jpeg || ""
            };

            characters.push(newChar);
            renderCharacters();
            saveData();
            sendDataToSheets('Characters', 'add', [newChar.name, newChar.maxHp, newChar.currentHp, newChar.init, newChar.img]);
            alert("Герой призван!");
        } catch (err) { alert("Ошибка JSON!"); }
    };
    reader.readAsText(fileInput.files[0]);
}

// ПРИЗВАТЬ МОНСТРА
async function addMonsterByUrl() {
    const url = document.getElementById('monster-url').value;
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
        if (imgSrc.includes('origin/')) imgSrc = "https://5e14.ttg.club/" + imgSrc.split('origin/')[1];

        const newM = { name, maxHp: hp, currentHp: hp, init: Math.floor(Math.random() * 20) + 1, img: imgSrc };
        monsters.push(newM);
        renderMonsters();
        sendDataToSheets('Monsters', 'add', [newM.name, newM.maxHp, newM.currentHp, newM.init, newM.img]);
    } catch (e) { alert("Ошибка загрузки!"); }
}

async function sendDataToSheets(sheet, action, data) {
    fetch(API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ sheet, action, data }) });
}

function saveData() { localStorage.setItem('dnd_chars', JSON.stringify(characters)); }

function changeBackground(event) {
    const reader = new FileReader();
    reader.onload = () => {
        const url = reader.result;
        document.getElementById('main-bg').style.backgroundImage = `url(${url})`;
        localStorage.setItem('dnd_bg', url);
    };
    reader.readAsDataURL(event.target.files[0]);
}

window.onload = () => {
    const savedBg = localStorage.getItem('dnd_bg');
    if(savedBg) document.getElementById('main-bg').style.backgroundImage = `url(${savedBg})`;
    renderCharacters();
    renderMonsters();
    
    new Sortable(document.getElementById('character-list'), {
        animation: 150,
        onEnd: (evt) => {
            const moved = characters.splice(evt.oldIndex, 1)[0];
            characters.splice(evt.newIndex, 0, moved);
            if (characters[evt.newIndex - 1]) characters[evt.newIndex].init = characters[evt.newIndex - 1].init - 1;
            renderCharacters();
            saveData();
        }
    });
};
