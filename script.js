let characters = JSON.parse(localStorage.getItem('dnd_chars')) || [];
let monsters = [];
let statuses = JSON.parse(localStorage.getItem('dnd_statuses')) || [];
const API_URL = "https://script.googleusercontent.com/macros/echo?user_content_key=AY5xjrRh3FkvIKwn_HOEwXMwC5nqY70dmuCAz-yMwHkUqbqTeVHZb7UQTC3MbNXB8jdMtLK1S5iqsVOltRr9NGEOJmNyCvulRR3d-1SdvghmgxmEXZroHFTBHF2cB7hArL511erdA7XMW-tf39uQoBm30X2ja5OLYz_yaInGzrto9vkAhBcXQpZ3aeMec9aC4NenMM6LqwizKRWR92uathyJMSFFc1AYu4MeRwUZb8U-Ma_yq_7Z0qIXj-Bt-zprm7svgbwN19dsfuxrKmkWP81-wAxgM2Vlw3gwMS96df7E&lib=M2-HEIrDR4JygxZ_eSAhtnqM9Vk67ktfh"

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

async function addMonsterByUrl() {
    const url = document.getElementById('monster-url').value;
    if (!url) return;

    // Используем бесплатный прокси-сервер для обхода блокировок (CORS)
    const proxyUrl = "https://api.allorigins.win/get?url=" + encodeURIComponent(url);

    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();
        const html = data.contents; // Весь текст страницы dnd.su

        // Парсим имя (оно обычно в теге h1)
        const nameMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
        const name = nameMatch ? nameMatch[1].replace(/<[^>]*>?/gm, '').trim() : "Неизвестный монстр";

        // Парсим картинку (ищем первую большую картинку в блоке бестиария)
        const imgMatch = html.match(/<img[^>]+src="([^">]+(bestiary|img)[^">]+)"/);
        let imgSrc = imgMatch ? imgMatch[1] : "";
        if (imgSrc && !imgSrc.startsWith('http')) imgSrc = "https://dnd.su" + imgSrc;

        // Добавляем в массив монстров
        monsters.push({
            name: name,
            maxHp: 50, // По умолчанию (парсинг HP сложнее, требует RegExp)
            currentHp: 50,
            init: Math.floor(Math.random() * 20) + 1,
            img: imgSrc
        });

        renderMonsters(); // Функция отрисовки (добавь её в JS)
    } catch (error) {
        console.error("Ошибка парсинга:", error);
        alert("Не удалось загрузить данные. Проверь ссылку.");
    }
}

