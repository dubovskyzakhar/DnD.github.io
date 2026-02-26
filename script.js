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

function toggleLibrary() {
    document.getElementById('library-options').classList.toggle('active');
}

// Закрывать список, если кликнули мимо
window.addEventListener('click', function(e) {
    if (!document.getElementById('library-select-container').contains(e.target)) {
        document.getElementById('library-options').classList.remove('active');
    }
});

async function loadLibrary() {
    const optionsContainer = document.getElementById('library-options');
    const selectedText = document.getElementById('selected-text');
    if (!optionsContainer) return;

    try {
        const response = await fetch(`${API_URL}?sheet=Characters`);
        const data = await response.json();
        
        optionsContainer.innerHTML = '';
        
        data.forEach((item) => {
            const values = Object.values(item);
            const charName = item["Имя"] || item["name"] || values[0] || "Герой";
            const charImg = item["Фото"] || item["img"] || values[4] || "";

            // Создаем элемент опции
            const div = document.createElement('div');
            div.className = 'option-item';
            div.innerHTML = `
                <img src="${charImg}" onerror="this.src='https://i.imgur.com/83p7pId.png'">
                <span>${charName}</span>
            `;

            // Логика выбора
            div.onclick = () => {
                selectedHeroData = {
                    name: charName,
                    maxHp: parseInt(item["MaxHP"] || values[1]) || 10,
                    img: charImg
                };
                selectedText.innerHTML = `<img src="${charImg}" style="width:25px;height:25px;border-radius:50%;margin-right:10px;vertical-align:middle;"> ${charName}`;
                optionsContainer.classList.remove('active');
            };

            optionsContainer.appendChild(div);
        });
    } catch (e) {
        optionsContainer.innerHTML = '<div class="option-item">Ошибка загрузки БД</div>';
    }
}

function addFromLibrary() {
    if (!selectedHeroData) return alert("Сначала выберите героя!");

    const newUnit = {
        name: selectedHeroData.name,
        maxHp: selectedHeroData.maxHp,
        currentHp: selectedHeroData.maxHp,
        init: 0, // Установлено в 0
        img: selectedHeroData.img,
        type: 'hero'
    };

    combatants.push(newUnit);
    saveData();
    renderCombatList();
    
    selectedHeroData = null;
    document.getElementById('selected-text').innerText = "-- Выберите героя --";
    switchTab('battle');
}

async function addMonsterByUrl() {
    const urlInput = document.getElementById('monster-url');
    if (!urlInput.value) return alert("Вставь ссылку!");
    
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlInput.value)}`;
    
    try {
        const resp = await fetch(proxyUrl);
        const d = await resp.json();
        const doc = new DOMParser().parseFromString(d.contents, 'text/html');
        
        const name = doc.querySelector('h1')?.innerText || "Монстр";
        const hpMatch = d.contents.match(/(?:Хиты|Hit Points)\s*[:]?\s*(\d+)/i);
        const hp = hpMatch ? parseInt(hpMatch[1]) : 50;

        const newMonster = { 
            name, 
            maxHp: hp, 
            currentHp: hp, 
            init: 0, // Установлено в 0
            img: "", 
            type: 'monster' 
        };

        combatants.push(newMonster);
        saveData(); 
        renderCombatList(); 
        urlInput.value = ""; 
        switchTab('battle');
    } catch (e) { alert("Ошибка загрузки данных монстра!"); }
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

