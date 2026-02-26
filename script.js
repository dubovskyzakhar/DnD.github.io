let characters = JSON.parse(localStorage.getItem('dnd_chars')) || [];
let monsters = [];

// ВСТАВЬТЕ СЮДА СВОЮ ССЫЛКУ ПОСЛЕ ОБНОВЛЕНИЯ РАЗВЕРТЫВАНИЯ
const API_URL = "https://script.google.com/macros/s/...ВАШ_ID.../exec"; 

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
            <div class="hp-box">
                HP: <span class="hp-value" onclick="editHP('char', ${index})" onwheel="changeHP(event, 'char', ${index})">
                    ${char.currentHp}/${char.maxHp}
                </span>
            </div>
            <button class="delete-btn" onclick="deleteItem('char', ${index})">🗑️</button>
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
        div.style.borderLeft = "8px solid #a00";
        div.innerHTML = `
            <img src="${m.img || ''}" class="avatar">
            <div><strong>${m.name}</strong><br>Инициатива: ${m.init}</div>
            <div class="hp-box">
                HP: <span class="hp-value" onclick="editHP('monster', ${index})" onwheel="changeHP(event, 'monster', ${index})">
                    ${m.currentHp}/${m.maxHp}
                </span>
            </div>
            <button class="delete-btn" onclick="deleteItem('monster', ${index})">🗑️</button>
        `;
        list.appendChild(div);
    });
}

function changeHP(e, type, index) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    let target = (type === 'char') ? characters[index] : monsters[index];
    target.currentHp = Math.max(0, parseInt(target.currentHp) + delta);
    renderCharacters(); renderMonsters(); saveData();
}

function editHP(type, index) {
    let target = (type === 'char') ? characters[index] : monsters[index];
    let newVal = prompt("Введите текущее HP:", target.currentHp);
    if (newVal !== null && !isNaN(newVal)) {
        target.currentHp = parseInt(newVal);
        renderCharacters(); renderMonsters(); saveData();
    }
}

function deleteItem(type, index) {
    if (confirm("Удалить персонажа?")) {
        if (type === 'char') characters.splice(index, 1);
        else monsters.splice(index, 1);
        renderCharacters(); renderMonsters(); saveData();
    }
}

async function importCharacter() {
    const fileInput = document.getElementById('import-json');
    if (!fileInput.files[0]) return alert("Выбери файл!");

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const raw = JSON.parse(e.target.result);
            let data = (raw.data && typeof raw.data === 'string') ? JSON.parse(raw.data) : (raw.data || raw);

            const newChar = {
                name: data.name?.value || data.name || "Герой",
                maxHp: data.vitality?.["hp-max"]?.value || data.hp || 10,
                currentHp: data.vitality?.["hp-max"]?.value || data.hp || 10,
                init: (Math.floor(Math.random() * 20) + 1) + (data.stats?.dex?.modifier || 0),
                img: data.avatar?.webp || data.avatar?.jpeg || ""
            };

            characters.push(newChar);
            renderCharacters(); saveData();
            
            // Отправка данных
            await sendDataToSheets('Characters', 'add', [newChar.name, newChar.maxHp, newChar.currentHp, newChar.init, newChar.img]);
            
            fileInput.value = "";
        } catch (err) { alert("Ошибка JSON!"); }
    };
    reader.readAsText(fileInput.files[0]);
}

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
        
        const newM = { name, maxHp: hp, currentHp: hp, init: Math.floor(Math.random() * 20) + 1, img: imgSrc };
        monsters.push(newM);
        renderMonsters();
        
        await sendDataToSheets('Monsters', 'add', [newM.name, newM.maxHp, newM.currentHp, newM.init, newM.img]);
        urlInput.value = "";
    } catch (e) { alert("Ошибка загрузки!"); }
}

async function sendDataToSheets(sheet, action, data) {
    try {
        await fetch(API_URL, { 
            method: 'POST', 
            mode: 'no-cors', // Важно для работы с Google из браузера
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sheet, action, data }) 
        });
        console.log("Данные успешно отправлены в " + sheet);
    } catch (e) {
        console.error("Ошибка отправки в таблицу:", e);
    }
}

function saveData() { localStorage.setItem('dnd_chars', JSON.stringify(characters)); }

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
    renderCharacters(); renderMonsters();
    
    new Sortable(document.getElementById('character-list'), {
        animation: 150,
        onEnd: (evt) => {
            const moved = characters.splice(evt.oldIndex, 1)[0];
            characters.splice(evt.newIndex, 0, moved);
            if (characters.length > 1) {
                if (evt.newIndex === 0) characters[0].init = parseInt(characters[1].init) + 1;
                else characters[evt.newIndex].init = parseInt(characters[evt.newIndex - 1].init) - 1;
            }
            renderCharacters(); saveData();
        }
    });
};
