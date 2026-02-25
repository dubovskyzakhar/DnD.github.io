// 1. ИНИЦИАЛИЗАЦИЯ ДАННЫХ
let characters = JSON.parse(localStorage.getItem('dnd_chars')) || [];
let monsters = [];
let statuses = JSON.parse(localStorage.getItem('dnd_statuses')) || [];

// ВАЖНО: Используй URL, который заканчивается на /exec
const API_URL = "https://script.google.com/macros/s/AKfycbyR6...ТВОЙ_ID.../exec"; 

// Переключение табов
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId + '-tab').classList.add('active');
}

// 2. РЕНДЕР ПЕРСОНАЖЕЙ И МОНСТРОВ
function renderCharacters() {
    const list = document.getElementById('character-list');
    list.innerHTML = '';
    characters.sort((a, b) => b.init - a.init);

    characters.forEach((char, index) => {
        const card = document.createElement('div');
        card.className = 'character-card';
        card.innerHTML = `
            <img src="${char.img || 'https://via.placeholder.com/60'}" class="avatar">
            <div>
                <strong>${char.name}</strong><br>
                <span>Инициатива: ${char.init}</span>
            </div>
            <div class="hp-box">
                HP: <span class="hp-value" onwheel="changeHP(event, 'char', ${index})">
                    ${char.currentHp}/${char.maxHp}
                </span>
            </div>
        `;
        list.appendChild(card);
    });
}

function renderMonsters() {
    const list = document.getElementById('monster-list');
    list.innerHTML = '';
    monsters.forEach((m, index) => {
        const card = document.createElement('div');
        card.className = 'character-card monster-theme';
        card.innerHTML = `
            <img src="${m.img || 'https://via.placeholder.com/60'}" class="avatar">
            <div>
                <strong>${m.name}</strong><br>
                <span>Инициатива: ${m.init}</span>
            </div>
            <div class="hp-box">
                HP: <span class="hp-value" onwheel="changeHP(event, 'monster', ${index})">
                    ${m.currentHp}/${m.maxHp}
                </span>
            </div>
        `;
        list.appendChild(card);
    });
}

// 3. ИЗМЕНЕНИЕ HP
function changeHP(e, type, index) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    if(type === 'char') {
        characters[index].currentHp = Math.max(0, parseInt(characters[index].currentHp) + delta);
    } else {
        monsters[index].currentHp = Math.max(0, parseInt(monsters[index].currentHp) + delta);
    }
    renderCharacters();
    renderMonsters();
    saveData();
}

// 4. ИМПОРТ ПЕРСОНАЖА (Long Story Short)
document.getElementById('import-json').addEventListener('change', function(e) {
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const raw = JSON.parse(event.target.result);
            const data = JSON.parse(raw.data); // Двойной парсинг для LSS

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
        } catch (err) {
            alert("Ошибка в формате файла Long Story Short");
        }
    };
    reader.readAsText(e.target.files[0]);
});

// 5. ПАРСИНГ МОНСТРА (ttg.club)
async function addMonsterByUrl() {
    const url = document.getElementById('monster-url').value;
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

        const newMonster = {
            name: name.trim(),
            maxHp: hp,
            currentHp: hp,
            init: Math.floor(Math.random() * 20) + 1,
            img: imgSrc
        };

        monsters.push(newMonster);
        renderMonsters();
        sendDataToSheets('Monsters', 'add', [newMonster.name, newMonster.maxHp, newMonster.currentHp, newMonster.init, newMonster.img]);
    } catch (e) {
        alert("Ошибка загрузки монстра");
    }
}

// 6. СИСТЕМНЫЕ ФУНКЦИИ
async function sendDataToSheets(sheet, action, data) {
    fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ sheet, action, data })
    });
}

function saveData() {
    localStorage.setItem('dnd_chars', JSON.stringify(characters));
}

// Инициализация Drag-and-Drop
new Sortable(document.getElementById('character-list'), {
    animation: 150,
    onEnd: (evt) => {
        const movedItem = characters.splice(evt.oldIndex, 1)[0];
        characters.splice(evt.newIndex, 0, movedItem);
        if (characters[evt.newIndex - 1]) characters[evt.newIndex].init = characters[evt.newIndex - 1].init - 1;
        renderCharacters();
        saveData();
    }
});

window.onload = () => {
    const savedBg = localStorage.getItem('dnd_bg');
    if(savedBg) document.getElementById('main-bg').style.backgroundImage = `url(${savedBg})`;
    renderCharacters();
    renderMonsters();
};
