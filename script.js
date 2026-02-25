let characters = JSON.parse(localStorage.getItem('dnd_chars')) || [];
let monsters = [];
let statuses = JSON.parse(localStorage.getItem('dnd_statuses')) || [];

// Переключение табов
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId + '-tab').classList.add('active');
}

// Рендер персонажей
function renderCharacters() {
    const list = document.getElementById('character-list');
    list.innerHTML = '';
    
    // Сортировка по инициативе
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
            <div class="char-statuses" id="char-status-${index}"></div>
        `;
        list.appendChild(card);
    });
}

// Изменение HP колесиком
function changeHP(e, type, index) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    if(type === 'char') {
        characters[index].currentHp += delta;
    } else {
        monsters[index].currentHp += delta;
    }
    renderCharacters();
    renderMonsters();
}

// Drag-and-drop инициатива
const sortable = new Sortable(document.getElementById('character-list'), {
    animation: 150,
    onEnd: (evt) => {
        // Логика: если перетащили, меняем инициативу
        // В реальном приложении тут нужно высчитать среднее между соседями
        const movedItem = characters.splice(evt.oldIndex, 1)[0];
        characters.splice(evt.newIndex, 0, movedItem);
        
        // Авто-коррекция инициативы
        if (characters[evt.newIndex - 1]) {
            characters[evt.newIndex].init = characters[evt.newIndex - 1].init - 1;
        } else {
            characters[evt.newIndex].init = characters[evt.newIndex + 1].init + 1;
        }
        renderCharacters();
    }
});

// Импорт JSON персонажа
document.getElementById('import-json').addEventListener('change', function(e) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const charData = JSON.parse(event.target.result);
        characters.push({
            name: charData.name,
            maxHp: charData.hp,
            currentHp: charData.hp,
            init: charData.initiative || 10,
            img: charData.img
        });
        saveData();
        renderCharacters();
    };
    reader.readAsText(e.target.files[0]);
});

// Сохранение фона
function changeBackground(event) {
    const reader = new FileReader();
    reader.onload = function(){
        const url = reader.result;
        document.getElementById('main-bg').style.backgroundImage = `url(${url})`;
        localStorage.setItem('dnd_bg', url);
    }
    reader.readAsDataURL(event.target.files[0]);
}

// При загрузке страницы
window.onload = () => {
    const savedBg = localStorage.getItem('dnd_bg');
    if(savedBg) document.getElementById('main-bg').style.backgroundImage = `url(${savedBg})`;
    renderCharacters();
};

function saveData() {
    localStorage.setItem('dnd_chars', JSON.stringify(characters));
}