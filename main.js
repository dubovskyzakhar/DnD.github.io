// Импортируем всё из наших модулей
import * as actions from './actions.js';
import * as ui from './ui-render.js';
import { combatants, updateCombatants, saveData } from './state.js';

// Все функции из actions.js будут доступны через dndActions.название()
window.dndActions = actions;
window.switchTab = ui.switchTab;
window.toggleStatusMenu = ui.toggleStatusMenu;
window.changeBackground = ui.changeBackground;
window.addMonsterManual = actions.addMonsterManual;

// Функции управления интерфейсом
window.changeBackground = ui.changeBackground;

// Если у тебя в index.html есть кнопки фильтрации или поиска:
window.displayHeroes = ui.displayHeroes;
window.displayMonsters = ui.displayMonsters;

/* 2. ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
*/
window.addEventListener('DOMContentLoaded', () => {
    console.log("Приложение D&D инициализировано");

    // Отрисовываем список бойцов из localStorage
    ui.renderCombatList();
  if (actions.loadMonsterLibrary) actions.loadMonsterLibrary();

    // Восстанавливаем фон, если он был сохранен
    const savedBg = localStorage.getItem('dnd_bg');
    if (savedBg) {
        const bgLayer = document.getElementById('main-bg');
        if (bgLayer) bgLayer.style.backgroundImage = `url(${savedBg})`;
    }

    // Здесь можно добавить слушатели событий, которые не зависят от onclick
    // Например, закрытие всех меню при клике мимо
    document.addEventListener('click', () => {
        document.querySelectorAll('.status-dropdown').forEach(m => m.style.display = 'none');
        document.querySelectorAll('.character-card').forEach(c => c.classList.remove('has-open-menu'));
    });
});

/* 3. ЭКСПОРТ (на случай, если другим модулям понадобится main)
*/
export { actions, ui };

function initSortable() {
    const list = document.getElementById('character-list');
    if (list && typeof Sortable !== 'undefined') {
        Sortable.create(list, {
            animation: 150,
            handle: '.card-header', // Тянем за заголовок
            onEnd: () => {
                const newOrder = [];
                document.querySelectorAll('.character-card').forEach(el => {
                    const idx = parseInt(el.id.split('-')[1]);
                    newOrder.push(combatants[idx]);
                });
                updateCombatants(newOrder);
            }
        });
    }
}

const originalRender = ui.renderCombatList;
ui.renderCombatList = function() {
    originalRender();
    initSortable();
};

