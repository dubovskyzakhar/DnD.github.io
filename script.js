let combatants = JSON.parse(localStorage.getItem('dnd_combatants')) || [];
let fullMonsterDatabase = []; 
let fullHeroDatabase = [];   


let spellCastingMode = null; // Хранит данные: кто колдует и что








// 2. ОТРИСОВКА СПИСКА БОЯ (ЕДИНАЯ ВЕРСИЯ)
// Функция переключения модификаторов


// Функция редактирования БАЗОВОГО AC






async function addMonsterToDB(monsterData) {
    const sheetName = 'Enemies';
    
    // Твой строгий порядок столбцов:
    // 1. Название | 2. Хиты | 3. КД | 4. Тип | 5. Фото | 6. Описание | 7. Доп КД | 8. Доп хиты
    const rowData = [
        monsterData.name,        // Название монстров
        monsterData.hp,          // Число хитов
        monsterData.ac,          // Класс доспеха
        monsterData.type,        // Тип
        monsterData.img,         // Фото
        monsterData.description, // Описание
        monsterData.acNote,      // Доп класс защиты
        monsterData.hpNote       // Доп хиты (формула)
    ];
    
    await sendDataToSheets(sheetName, 'add', rowData);
}


// 3. ФУНКЦИИ ГЕРОЕВ (БИБЛИОТЕКА)
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

function filterHeroes() {
    const query = document.getElementById('hero-search').value.toLowerCase();
    const filtered = fullHeroDatabase.filter(h => {
        const name = (h["Имя"] || Object.values(h)[0] || "").toString().toLowerCase();
        return name.includes(query);
    });
    displayHeroes(filtered);
}

function addHeroToCombat(name, hp, img, ac = 10) {
    const unit = {
        name: name,
        maxHp: hp,
        currentHp: hp,
        ac: ac,
        init: 0,
        img: img,
        type: 'hero',
        mods: { shield: false, cover: null }
    };
    combatants.push(unit);
    saveData();
    renderCombatList();
}

// 4. ФУНКЦИИ МОНСТРОВ (БИБЛИОТЕКА)
async function loadMonsterLibrary() {
    const container = document.getElementById('monster-library-list');
    if (!container) return;
    try {
        const response = await fetch(`${API_URL}?sheet=Enemies`);
        fullMonsterDatabase = await response.json();
        displayMonsters(fullMonsterDatabase);
    } catch (e) {
        container.innerHTML = 'Ошибка загрузки бестиария';
    }
}



function filterMonsters() {
    const query = document.getElementById('monster-search').value.toLowerCase();
    const filtered = fullMonsterDatabase.filter(m => {
        const name = (m["Имя"] || Object.values(m)[0] || "").toString().toLowerCase();
        return name.includes(query);
    });
    displayMonsters(filtered);
}

function addMonsterToCombat(name, hp, ac, img, hpNote = "", acNote = "") {
    const unit = {
        name: name,
        maxHp: parseInt(hp) || 10,
        currentHp: parseInt(hp) || 10,
        hpNote: hpNote, // Чистый текст (например: "пятикратный уровень следопыта")
        ac: parseInt(ac) || 10,
        acNote: acNote, // Чистый текст (например: "natural armor, бонус мастерства")
        init: 0,
        img: img,
        type: 'monster',
        mods: { shield: false, cover: null }
    };
    combatants.push(unit);
    saveData();
    renderCombatList();
}



// Специальная обертка для героев (для вызова из HTML)
function uploadHeroPhotoDirect(name, event) {
    uploadPhotoDirect(name, event, 'Characters');
}


// 1. Золотая рамка




function removeSpell(targetIdx, spellIdx) {
    // 1. Проверяем существование юнита и массива заклинаний
    if (combatants[targetIdx] && combatants[targetIdx].activeSpells) {
        
        // 2. Удаляем конкретное заклинание из массива по индексу
        combatants[targetIdx].activeSpells.splice(spellIdx, 1);
        
        // 3. Очищаем подсветку (на случай если мышка осталась над зоной)
        resetHighlights();
        
        // 4. Сохраняем и перерисовываем
        saveData();
        renderCombatList();
    }
}

// Подсветка кастера при наведении на заклинание



// 1. ПОЛНАЯ ОЧИСТКА (Все карточки)
function clearAllCombatants() {
    if (confirm("Вы уверены, что хотите полностью очистить поле боя?")) {
        combatants = []; // Обнуляем массив
        saveData();      // Сохраняем пустоту в LocalStorage
        renderCombatList(); // Перерисовываем
    }
}

// 2. ЗАВЕРШИТЬ БОЙ (Удалить только монстров)
function finishBattle() {
    if (confirm("Удалить всех противников? Герои останутся.")) {
        // Оставляем только героев, статусы НЕ трогаем
        combatants = combatants.filter(unit => unit.type === 'hero');
        
        // Сбрасываем только временные моды КД (щиты/укрытия), если нужно
        // Если хочешь оставить и их — просто удали цикл ниже
        combatants.forEach(hero => {
            hero.mods = { shield: false, cover: null };
        });

        saveData();
        renderCombatList();
    }
}

// 7. ЗАПУСК
window.onload = () => {
    const bg = localStorage.getItem('dnd_bg');
    if(bg) document.getElementById('main-bg').style.backgroundImage = `url(${bg})`;
    renderCombatList();

    if (typeof Sortable !== 'undefined') {
        new Sortable(document.getElementById('character-list'), {
            animation: 150,
            onEnd: function (evt) {
                if (evt.oldIndex === evt.newIndex) return;
                const movedItem = combatants.splice(evt.oldIndex, 1)[0];
                combatants.splice(evt.newIndex, 0, movedItem);
                
                const targetIndex = evt.newIndex;
                if (evt.newIndex < evt.oldIndex) {
                    const unitBelow = combatants[targetIndex + 1];
                    movedItem.init = unitBelow ? unitBelow.init + 1 : movedItem.init;
                } else {
                    const unitAbove = combatants[targetIndex - 1];
                    movedItem.init = unitAbove ? unitAbove.init - 1 : movedItem.init;
                }
                saveData(); renderCombatList();
            }
        });
    }
};

document.addEventListener('click', (e) => {
    if (!e.target.closest('.status-container')) {
        document.querySelectorAll('.status-dropdown').forEach(m => m.style.display = 'none');
        document.querySelectorAll('.character-card').forEach(c => c.classList.remove('has-open-menu'));
    }
});

// Внутри window.onload добавь:
window.addEventListener('scroll', clearConnectionLines, true);






































