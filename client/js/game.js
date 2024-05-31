
// ************************************************************************************************************************


const ws = new WebSocket("ws://127.0.0.1:3000");
let isWebSocketSetup = false;
let isDiceButtonActive = false;
let lastRollDiceHandler = null;
let lastBuyHandler = null;
let lastCancelHandler = null;
let lastPayHandler = null;
let lastLayHandler = null;
let lastBuyBackHandler = null;
let lastBuildHandler = null;
let lastCancelBuildHandler = null;
let buildHandlers = [];
s();
// ---------------------------------------


async function sendMessage(text) {
    let userData = await getUserData();
    const urlParts = window.location.pathname.split('/');
    const gameId = urlParts[urlParts.length - 1]; // Получаем ID игры из URL
    ws.send(JSON.stringify({ type: 'chatMessage', gameId: gameId, text: text , nickname: userData.nickname}));
}

function displayChatMessage(text, from) {
    const chat = document.getElementById('chat-messages'); // Предполагается, что есть элемент с id='chat'
    const messageElement = document.createElement('div');
    messageElement.textContent = `${from}: ${text}`;
    chat.appendChild(messageElement); // Добавляем новое сообщение в конец списка
    // Прокрутка контейнера сообщений вниз после добавления нового сообщения
    chat.scrollTop = chat.scrollHeight;
}

function formatCurrency(amount) {
    return `${amount.toLocaleString('ru-RU')}р.`;
}

async function loadAndDisplayPlayersInfo(gameId) {
    const arr = {"red": "#771622", "blue":"#3232d473", "green": "#437730", "yellow":"rgba(255, 253, 0, 0.71)"}
    const response = await fetch(`/api/game/${gameId}/players`);
    if (!response.ok) {
        throw new Error('Не удалось загрузить информацию об игроках');
    }
    const players = await response.json();
    // players = JSON.parse(players);

    const playersInfoElement = document.getElementById('players-info');
    playersInfoElement.innerHTML = ''; // Очищаем текущую информацию

    players.forEach(player => {
        // Создаем новый элемент для каждого игрока
        const playerElement = document.createElement('div');
        playerElement.className = 'player';
        playerElement.innerHTML = `
        <div class="player-avatar"></div>
        <div class="player-details">
            <span class="player-name">${player.player_id}</span>
            <span class="player-money">₽${formatCurrency(player.balance)}</span>
            <span class="player-properties">₽${formatCurrency(player.properties_cost)}</span>
        </div>
    `;
        playerElement.style.backgroundColor = arr[player.color];
        playersInfoElement.appendChild(playerElement);
    });
    document.querySelectorAll('#players-info .player').forEach(player => {
        const colors = {'rgba(50, 50, 212, 0.45)': 'rgb(0, 0, 255)', 'rgb(119, 22, 34)': 'rgb(255, 0, 0)', 'rgb(67, 119, 48)': 'rgb(0, 128, 0)','rgba(255, 253, 0, 0.71)': 'rgb(255, 255, 0)',}//rgb(0, 0, 255)
        player.addEventListener('mouseenter', function() {
            const playerColor = getComputedStyle(player).backgroundColor;
            dimNonPlayerCells(colors[playerColor]);
        });
    
        player.addEventListener('mouseleave', function() {
            undimAllCells();
        });
    });
}

function dimNonPlayerCells(currentColor) {
    const cells = document.querySelectorAll('.cell, .cell-h, .cell-w');
    cells.forEach(cell => {
        const cellStyle = getComputedStyle(cell);
        const ownerColor = cellStyle.backgroundColor; // Получаем цвет фона
        // console.log(ownerColor === );

        if (ownerColor != currentColor) { // Сравниваем с цветом текущего игрока
            cell.classList.add('dimmed');
        } else {
            cell.classList.remove('dimmed');
        }
    });
}

function undimAllCells() {
    const cells = document.querySelectorAll('.cell, .cell-h, .cell-w');
    cells.forEach(cell => {
        cell.classList.remove('dimmed');
    });
}



async function getUserData() {
    try {
        const response = await fetch('/api/userinfo');
        if (!response.ok) {
            throw new Error('Не удалось загрузить информацию пользователя');
        }
        return await response.json();
    } catch (error) {
        console.error(error);
        return null; // или можно вернуть пустой объект {}, в зависимости от того, что предпочтительнее
    }
}

function requestRegistration(gameId, nickname){
    return ws.send(JSON.stringify({type:'requestRegistration', gameId:gameId, nickname:nickname }))
}

// ---------------------------------------------------------------------------

function s(){
    if (isWebSocketSetup) {
        return;
    } // Если WebSocket уже настроен, ничего не делаем
    isWebSocketSetup = true;

    ws.onopen = async () => {
        console.log('Соединение с сервером установлено');
        const urlParts = window.location.pathname.split('/');
        const gameId = urlParts[urlParts.length - 1];
        let userData = await getUserData();
        let {nickname} = userData;
        await loadAndDisplayPlayersInfo(gameId);
        requestRegistration(gameId, nickname);
    };

    ws.onmessage = function(event) {
        console.log("Получено сообщение: ", event.data);
        const message = JSON.parse(event.data);
        switch (message.type) {
            case 'chatMessage':
                displayChatMessage(message.text, message.from);
                break;
            case 'chatHistory':
                message.messages.forEach(msg => {
                    displayChatMessage(msg.message, msg.from_nickname);
                });
                break;
            case 'boardReady':
                createBoard();
                break;
            case 'getTurn':
                displayRollDiceButton();
                break;
            case 'diceRolled':
                rollDice(message.dice1.position, message.dice1.velocity, message.dice1.angularVelocity,
                        message.dice2.position, message.dice2.velocity, message.dice2.angularVelocity);
                break;
            case 'redrawBoard':
                const pos = message.position;
                const cellName = message.name;
                const cellCost = message.cost;
                const cellOwner = message.owner;
                const {fieldType} = message
                const whoo = message.nickname;
                const {oldPosition} = message;
                const {currentPlayerColor} = message;
                updateBoard(pos, cellName, cellCost, cellOwner, fieldType, whoo, oldPosition, currentPlayerColor);
                break;
            case 'fieldBought':
                afterBought()
                break;
            case 'jumpJail':
                const {color} = message;
                jumpJail(color);
                break;
            case 'Pay!':
                const { gameId } = message;
                const cellOwnerPay = message.cellOwner;
                const cellCostPay = message.cellCost;
                const {nickname} = message;
                console.log(nickname);
                displayPayButton(cellOwnerPay, cellCostPay, nickname);
                break;
            case 'House':
                afterHouse();
                break;
            default:
                console.error(`Неизвестный тип сообщения: ${message.type}`);
        }
    };
}


// **********************************************************************************************************************
// Функция для добавления ведущего нуля
function pad(value) {
    return value.toString().padStart(2, '0');
}
function getGameIdFromUrl() {
    const {pathname} = window.location; // Получаем путь текущего окна
    return pathname.split('/').pop();
}

// Функция для обновления таймера на странице
function updateTimerDisplay(hours, minutes, seconds) {
    const timerElement = document.getElementById('time');
    timerElement.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// Запуск таймера
function startTimer() {
    let seconds = 0;
    let minutes = 0;
    let hours = 0;

    // Восстанавливаем сохраненное время, если оно есть
    const savedTime = localStorage.getItem('savedTime');
    if (savedTime) {
        const savedSeconds = parseInt(savedTime);
        hours = Math.floor(savedSeconds / 3600);
        minutes = Math.floor((savedSeconds - (hours * 3600)) / 60);
        seconds = savedSeconds - (hours * 3600) - (minutes * 60);
    }

    // Обновляем таймер сразу после восстановления
    updateTimerDisplay(hours, minutes, seconds);

    // Функция, вызываемая каждую секунду
    const timerInterval = setInterval(() => {
        seconds++;
        if (seconds >= 60) {
            seconds = 0;
            minutes++;
            if (minutes >= 60) {
                minutes = 0;
                hours++;
            }
        }

        // Сохраняем время каждую секунду
        const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
        localStorage.setItem('savedTime', totalSeconds.toString());

        updateTimerDisplay(hours, minutes, seconds);
    }, 1000);
}


function formatCost(cost) {
    if (cost >= 1000 && cost < 1000000) {

      return `₽ ${(cost / 1000).toFixed(1)}K`; // Для тысяч
    } else if (cost >= 1000000) {
      return `₽ ${(cost / 1000000).toFixed(1)}M`; // Для миллионов
    } else {
      return `₽ $${cost}`; // Если число меньше 1000
    }
}


function parseColor(colorString) {
    // Выделяем числа из строки 'field.239,200,124' и преобразуем их в формат 'rgb(239,200,124)'
    const rgb = colorString.split('.')[1]; // Получаем '239,200,124'
    return `rgb(${rgb})`; // Возвращаем 'rgb(239,200,124)'
}

function getOwnerColor(owner) {
    // Если owner не None, то возвращаем значение цвета, иначе возвращаем пустую строку или дефолтный цвет
    return owner && owner !== 'None' ? owner : '';
}

function placeInitialTokens(Data, num_players) {
    const playerData = Data.reduce((obj, item) => {
        obj[item.color] = item; // Записываем объект игрока под ключом его цвета
        return obj;
    }, {});

    const playerColors = ['red', 'blue', 'green', 'yellow'].slice(0, num_players); // Цвета игроков

    playerColors.forEach(color => {
        if (playerData[color]) { // Проверяем, существуют ли данные для данного цвета
            const {position} = playerData[color];
            const token = document.createElement('div');
            token.className = 'player-token';
            token.style.backgroundColor = color;
            token.dataset.color = color; // Атрибут для идентификации фишки по цвету

            const playerPosition = document.querySelector(`.cell[data-position="${position}"]`);
            if (playerPosition) { // Проверяем, нашли ли мы элемент для данной позиции
                playerPosition.appendChild(token); // Размещаем фишку в стартовой позиции
            } else {
                const playerPosition = document.querySelector(`.cell-w[data-position="${position}"]`);
                playerPosition.appendChild(token); // Размещаем фишку в стартовой позиции
                // console.error(`No cell found for position ${position}`);
            }
        } else {
            console.error(`No data found for color ${color}`);
        }
    });
}


async function getBoardData(gameId) {
    const response = await fetch(`/api/game/${gameId}/board`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

async function createBoard() {
    const gameId = getGameIdFromUrl();
    const fullData = await getBoardData(gameId);  
    const boardData = fullData.board;
    const playersData = fullData.players;
    const gameBoard = document.getElementById('game-board');
    const topRow = gameBoard.querySelector('.top-row');
    const bottomRow = gameBoard.querySelector('.bottom-row');
    const leftColumn = gameBoard.querySelector('.left-column');
    const rightColumn = gameBoard.querySelector('.right-column');
    const topLC = gameBoard.querySelector('.top-left-corner');
    const topRC = gameBoard.querySelector('.top-right-corner');
    const bottomLC = gameBoard.querySelector('.bottom-left-corner');
    const bottomRC = gameBoard.querySelector('.bottom-right-corner');

    if (boardData.length > 43){
    // Создание верхней строки
    for (let i = 0; i < 28; i += 2) {
        const houseNum = boardData[i].houses;

        let cell = document.createElement('div');
        let priceBar = document.createElement('div'); // Элемент для верхней полосы с ценой
        let name = document.createElement('div'); // Элемент для имени
        let image = document.createElement('img'); // Элемент для изображения
    
        name.textContent = boardData[i].name; // Добавляем имя
        name.className = 'name'; // Класс для стилей имени
    
        // image.src = `/images/1_cell.jpg`; // Устанавливаем адрес изображения
        // image.className = 'cell-image'; // Класс для стилей изображения
    
        // Устанавливаем цвет владельца, если поле не служебное
        let ownerColor = getOwnerColor(boardData[i].owner);
        if (ownerColor) {
            cell.style.backgroundColor = ownerColor;
        }
        cell.setAttribute('data-position', Math.floor(i / 2));
        cell.setAttribute('housesNum', houseNum);
        if (i === 0 || i === 26) {
            cell.className = "cell corner-cell";
        } else {
            cell.className = 'cell cell-h';
            if (boardData[i].cost != -1) {
                let formattedCost = formatCost(boardData[i].cost);
                priceBar.textContent = formattedCost; // Устанавливаем текст цены
                if (boardData[i].type.split('.')[0] === 'field') {
                    priceBar.style.backgroundColor = parseColor(boardData[i].type); // Устанавливаем цвет фона для .price-bar
                }
                priceBar.className = 'price-bar-common'; // Класс для стилей верхней полосы
                cell.appendChild(priceBar); // Добавляем верхнюю полосу в ячейку
            }
        }
    
        cell.appendChild(image); // Добавляем изображение в ячейку
        cell.appendChild(name); // Добавляем имя в ячейку
    
        if (i === 0) {
            topLC.appendChild(cell);
        } else if (i === 26) {
            topRC.appendChild(cell);
        } else {
            topRow.appendChild(cell);
        }
    }
    


        for (let i = 28; i <= 42; i+=2) {
            let cell = document.createElement('div');
            let priceBar = document.createElement('div'); // Элемент для верхней полосы с ценой
            let name = document.createElement('div'); // Элемент для имени
        
            name.textContent = boardData[i].name; // Добавляем имя
            name.className = 'name'; // Класс для стилей имени
            let ownerColor = getOwnerColor(boardData[i].owner);
            if (ownerColor) {
                cell.style.backgroundColor = ownerColor;
            }
            cell.setAttribute('data-position', Math.floor(i/2));
            if (i === 42) {
                cell.className = "cell corner-cell";
            } else {
                cell.className = 'cell-w';
                if (boardData[i].cost != -1) {
                    let formattedCost = formatCost(boardData[i].cost);
                    priceBar.textContent = formattedCost; // Устанавливаем отформатированный текст цены
                    if (boardData[i].type.split('.')[0] === 'field') {
                        priceBar.style.backgroundColor = parseColor(boardData[i].type); // Устанавливаем цвет фона для .price-bar
                    }
                    priceBar.className = 'price-bar-right'; // Класс для стилей верхней полосы
                    
                    cell.appendChild(priceBar); // Добавляем верхнюю полосу в ячейку
                }
            }
        
            cell.appendChild(name); // Добавляем имя в ячейку
        
            if (i === 42) {
                bottomRC.appendChild(cell);
            } else {
                rightColumn.appendChild(cell);
            }
        }

        // Создание нижней строки
        for (let i = 68; i >= 44 ; i-=2) {
            let cell = document.createElement('div');
            let priceBar = document.createElement('div'); // Элемент для верхней полосы с ценой
            let name = document.createElement('div'); // Элемент для имени
            let ownerColor = getOwnerColor(boardData[i].owner);
            if (ownerColor) {
                cell.style.backgroundColor = ownerColor;
            }
            name.textContent = boardData[i].name; // Добавляем имя
            name.className = 'name'; // Класс для стилей имени
            cell.setAttribute('data-position', Math.floor(i/2));
            if (i === 68) {
                cell.className = "cell corner-cell";
            } else {
                cell.className = 'cell cell-h';
                if (boardData[i].cost != -1) {
                    let formattedCost = formatCost(boardData[i].cost);
                    priceBar.textContent = formattedCost; // Устанавливаем отформатированный текст цены
                    if (boardData[i].type.split('.')[0] === 'field') {
                        priceBar.style.backgroundColor = parseColor(boardData[i].type); // Устанавливаем цвет фона для .price-bar
                    }
                    priceBar.className = 'price-bar-common'; // Класс для стилей верхней полосы
                    cell.appendChild(priceBar); // Добавляем верхнюю полосу в ячейку
                }
            }
            
            cell.appendChild(name); // Добавляем имя в ячейку
            
            if (i === 68) {
                bottomLC.appendChild(cell);
            } else {
                bottomRow.appendChild(cell);
            }
        }
    // Создание левой колонны
        for (let i = 82; i >= 70; i-=2) {
            let cell = document.createElement('div');
            let priceBar = document.createElement('div'); // Элемент для боковой полосы с ценой
            let name = document.createElement('div'); // Элемент для имени
            let ownerColor = getOwnerColor(boardData[i].owner);
            if (ownerColor) {
                cell.style.backgroundColor = ownerColor;
            }
            name.textContent = boardData[i].name; // Добавляем имя
            name.className = 'name'; // Класс для стилей имени
            cell.className = 'cell-w';
            cell.setAttribute('data-position', Math.floor(i/2));
            if (boardData[i].cost != -1) {
                let formattedCost = formatCost(boardData[i].cost);
                priceBar.textContent = formattedCost; // Устанавливаем отформатированный текст цены
                if (boardData[i].type.split('.')[0] === 'field') {
                    priceBar.style.backgroundColor = parseColor(boardData[i].type); // Устанавливаем цвет фона для .price-bar
                }
                priceBar.className = 'price-bar-left'; // Класс для стилей боковой полосы
                cell.appendChild(priceBar); // Добавляем боковую полосу в ячейку
            }
            
            cell.appendChild(name); // Добавляем имя в ячейку
            leftColumn.appendChild(cell);
        }
        return ws.send(JSON.stringify({type:'board_is_ready', gameId:gameId }))
    } else{
        for (let i = 0; i < 14; i+=1) {
            const housesNum = boardData[i].houses;
            let cell = document.createElement('div');
            let priceBar = document.createElement('div'); // Элемент для верхней полосы с ценой
            let name = document.createElement('div'); // Элемент для имени
        
            name.textContent = boardData[i].name; // Добавляем имя
            name.className = 'name'; // Класс для стилей имени
                // Устанавливаем цвет владельца, если поле не служебное
            let ownerColor = getOwnerColor(boardData[i].owner);
            if (ownerColor) {
                cell.style.backgroundColor = ownerColor;
            }
            cell.setAttribute('data-position', i);
            cell.setAttribute('housesNum', housesNum);
            if (i === 0 || i === 13) {
                cell.className = "cell corner-cell";
            } else {
                cell.className = 'cell cell-h';
                if (boardData[i].cost != -1) {
                    let formattedCost = formatCost(boardData[i].cost);
                    priceBar.textContent = formattedCost; // Устанавливаем текст цены
                    if (boardData[i].type.split('.')[0] === 'field') {
                        priceBar.style.backgroundColor = parseColor(boardData[i].type); // Устанавливаем цвет фона для .price-bar
                    }
                    priceBar.className = 'price-bar-common'; // Класс для стилей верхней полосы
                    cell.appendChild(priceBar); // Добавляем верхнюю полосу в ячейку
                }
            }
            
            cell.appendChild(name); // Добавляем имя в ячейку
        
            if (i === 0){
                topLC.appendChild(cell);
            } else if (i === 13){
                topRC.appendChild(cell);
            } else {
                topRow.appendChild(cell);
            }
        }


        for (let i = 14; i <= 21; i+=1) {
            const housesNum = boardData[i].houses
            
            let cell = document.createElement('div');
            let priceBar = document.createElement('div'); // Элемент для верхней полосы с ценой
            let name = document.createElement('div'); // Элемент для имени
        
            name.textContent = boardData[i].name; // Добавляем имя
            name.className = 'name'; // Класс для стилей имени
            let ownerColor = getOwnerColor(boardData[i].owner);
            if (ownerColor) {
                cell.style.backgroundColor = ownerColor;
            }
            cell.setAttribute('housesNum', housesNum);
            cell.setAttribute('data-position', i);
        
            if (i === 21) {
                cell.className = "cell corner-cell";
            } else {
                cell.className = 'cell-w';
                if (boardData[i].cost != -1) {
                    let formattedCost = formatCost(boardData[i].cost);
                    priceBar.textContent = formattedCost; // Устанавливаем отформатированный текст цены
                    if (boardData[i].type.split('.')[0] === 'field') {
                        priceBar.style.backgroundColor = parseColor(boardData[i].type); // Устанавливаем цвет фона для .price-bar
                    }
                    priceBar.className = 'price-bar-right'; // Класс для стилей верхней полосы
                    
                    cell.appendChild(priceBar); // Добавляем верхнюю полосу в ячейку
                }
            }
        
            cell.appendChild(name); // Добавляем имя в ячейку
        
            if (i === 21) {
                bottomRC.appendChild(cell);
            } else {
                rightColumn.appendChild(cell);
            }
        }

        // Создание нижней строки
        for (let i = 34; i >= 22 ; i-=1) {
            let cell = document.createElement('div');
            let priceBar = document.createElement('div'); // Элемент для верхней полосы с ценой
            let name = document.createElement('div'); // Элемент для имени
            let ownerColor = getOwnerColor(boardData[i].owner);
            if (ownerColor) {
                cell.style.backgroundColor = ownerColor;
            }
            name.textContent = boardData[i].name; // Добавляем имя
            name.className = 'name'; // Класс для стилей имени
            cell.setAttribute('data-position', i);
            if (i === 34) {
                cell.className = "cell corner-cell";
            } else {
                cell.className = 'cell cell-h';
                if (boardData[i].cost != -1) {
                    let formattedCost = formatCost(boardData[i].cost);
                    priceBar.textContent = formattedCost; // Устанавливаем отформатированный текст цены
                    if (boardData[i].type.split('.')[0] === 'field') {
                        priceBar.style.backgroundColor = parseColor(boardData[i].type); // Устанавливаем цвет фона для .price-bar
                    }
                    priceBar.className = 'price-bar-common'; // Класс для стилей верхней полосы
                    cell.appendChild(priceBar); // Добавляем верхнюю полосу в ячейку
                }
            }
            const housesNum = boardData[i].houses
            cell.setAttribute('housesNum', housesNum);
            
            cell.appendChild(name); // Добавляем имя в ячейку
            
            if (i === 34) {
                bottomLC.appendChild(cell);
            } else {
                bottomRow.appendChild(cell);
            }
        }
    // Создание левой колонны
        for (let i = 41; i >= 35; i-=1) {
            let cell = document.createElement('div');
            let priceBar = document.createElement('div'); // Элемент для боковой полосы с ценой
            let name = document.createElement('div'); // Элемент для имени
            let ownerColor = getOwnerColor(boardData[i].owner);
            if (ownerColor) {
                cell.style.backgroundColor = ownerColor;
            }
            name.textContent = boardData[i].name; // Добавляем имя
            name.className = 'name'; // Класс для стилей имени
            cell.className = 'cell-w';
            cell.setAttribute('data-position', i);
            if (boardData[i].cost != -1) {
                let formattedCost = formatCost(boardData[i].cost);
                priceBar.textContent = formattedCost; // Устанавливаем отформатированный текст цены
                if (boardData[i].type.split('.')[0] === 'field') {
                    priceBar.style.backgroundColor = parseColor(boardData[i].type); // Устанавливаем цвет фона для .price-bar
                }
                priceBar.className = 'price-bar-left'; // Класс для стилей боковой полосы
                cell.appendChild(priceBar); // Добавляем боковую полосу в ячейку
            }
            const housesNum = boardData[i].houses
            cell.setAttribute('housesNum', housesNum);
            
            cell.appendChild(name); // Добавляем имя в ячейку
            leftColumn.appendChild(cell);
        }
        placeInitialTokens(playersData, playersData.length)
        INFORMATION();
        return ws.send(JSON.stringify({type:'board_is_ready', gameId:gameId }))
    }
}

function updateCells(boardData, gameId){
    console.log(boardData);
    boardData.forEach((cellData, index) => {
        const cellElement = document.querySelector(`.cell[data-position="${index}"], .cell-w[data-position="${index}"]`);
        if (cellElement) {
            const nameElement = cellElement.querySelector('.name');
            const priceBar = cellElement.querySelector('.price-bar-common, .price-bar-right, .price-bar-left');

            if (nameElement) {
                nameElement.textContent = cellData.name;
            }
            if (cellData.cost !== -1 && priceBar) {
                priceBar.textContent = formatCost(cellData.cost);
                priceBar.style.backgroundColor = parseColor(cellData.type);
            }
            let ownerColor = getOwnerColor(cellData.owner);
            if (ownerColor) {
                cellElement.style.backgroundColor = ownerColor;
            }
            cellElement.setAttribute('housesnum', cellData.houses);

        }
    });
    loadAndDisplayPlayersInfo(gameId);
}

async function jumpJail(color){
    const gameId = getGameIdFromUrl();
    const fullData = await getBoardData(gameId);
    const boardData = fullData.board;
    const playersData = fullData.players;

    playersData.forEach(player => {
        const existingToken = document.querySelector(`.player-token[data-color="${color}"]`);
        const newCell = document.querySelector(`.cell[data-position="${13}"]`);
        const new_wCell = document.querySelector(`.cell-w[data-position="${13}"]`);
        if (existingToken && newCell) {
            newCell.appendChild(existingToken); // Перемещение фишки игрока
        } else if (existingToken && new_wCell) {
            new_wCell.appendChild(existingToken); // Перемещение фишки игрока
        }
    });


    playersData.forEach(player =>{
        if (player.turn === 1){
            displayRollDiceButton();
        }
    })
}

async function afterBought(){
    const gameId = getGameIdFromUrl();
    const fullData = await getBoardData(gameId);
    const boardData = fullData.board;
    const playersData = fullData.players;
    updateCells(boardData, gameId);     // Обновление свойств ячеек

    playersData.forEach(player =>{
        if (player.turn === 1){
            displayRollDiceButton();
        }
    })
}

async function afterHouse(){
    const gameId = getGameIdFromUrl();
    const fullData = await getBoardData(gameId);
    const boardData = fullData.board;
    const playersData = fullData.players;
    updateCells(boardData, gameId);  
}


function Animacion(oldPosition, pos, existingToken, callback) {
    const steps = [];
    const totalCells = 42;
    for (let i = 1; i <= pos - oldPosition; i++) {
        steps.push((oldPosition + i) % totalCells);
    }
    let currentStep = 0;
    function animateStep() {
        if (currentStep < steps.length) {
            const nextCell = document.querySelector(`.cell[data-position="${steps[currentStep]}"], .cell-w[data-position="${steps[currentStep]}"]`);
            if (nextCell) {
                nextCell.appendChild(existingToken);
            }
            currentStep++;
            setTimeout(animateStep, 300);  // Задержка в 300 мс между шагами
        } else {
            if (callback) {
                callback();
            }
        }
    }
    animateStep();
}


async function updateBoard(pos, cellName, cellCost, cellOwner, fieldType, whoo, oldPosition, currentPlayerColor) {
    const gameId = getGameIdFromUrl();
    const fullData = await getBoardData(gameId);
    const boardData = fullData.board;
    const playersData = fullData.players;

    // Обновление свойств ячеек
    updateCells(boardData, gameId);

    // Обновление позиций фишек игроков
    const animations = playersData.map(player => {
        return new Promise(resolve => {
            const existingToken = document.querySelector(`.player-token[data-color="${player.color}"]`);
            if (existingToken && player.player_id === whoo) {
                Animacion(oldPosition, player.position, existingToken, resolve);
            } else {
                resolve();
            }
        });
    });

    await Promise.all(animations);
    console.log('currentPlayerColor', currentPlayerColor);
    // Обработка специальных полей
    if (cellOwner != 'white' && cellOwner != 'None' && cellOwner != currentPlayerColor){
        ws.send(JSON.stringify({ type: 'PayMessage', gameId: gameId, position: pos, nickname: whoo, cellCost:cellCost, cellOwner:cellOwner, currentPlayerColor:currentPlayerColor}));
    }else if (['start', 'lottery', 'jail', 'delay', 'casino', 'back', 'tax'].includes(fieldType)) {
        playersData.forEach(player => {
            if (player.turn === 1) {
                displayRollDiceButton();
            }
        });
    } else if (fieldType === "go_jail") {
        ws.send(JSON.stringify({ type: 'jail!', gameId: gameId, position: pos, nickname: whoo }));
    } else if ((cellOwner === "white") || (cellOwner === "None")) {
        // Отображение кнопки покупки
        displayBuyButton(pos, cellName, cellCost, cellOwner, fieldType, whoo);
    } else {
        playersData.forEach(player => {
            if (player.turn === 1) {
                displayRollDiceButton();
            }
        });
    }
}



async function getCurrentPlayerInfo(gameId) {
    try {
        const response = await fetch(`/api/game/${gameId}/currentTurn`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const { currentPlayer, currentColor} = await response.json();
        return {currentPlayer, currentColor};
    } catch (error) {
        console.error('Ошибка при получении информации о текущем игроке:', error);
        throw error;
    }
}

async function displayPayButton(cellOwner, cellCost, whoo){
    // console.log(whoo);
    const gameId = getGameIdFromUrl();
    const turn_info = await getCurrentPlayerInfo(gameId);
    const currentPlayerId = turn_info.currentPlayer;
    const currentColor = turn_info.currentColor;
    const userData = await getUserData();
    const {nickname} = userData;

    const popupContainer = document.getElementById('popupContainer');
    const payButton = document.getElementById('pay');
    const buyBack = document.getElementById('buyBack');
    const layButton = document.getElementById('lay');
    if (whoo === nickname) {  
        popupContainer.style.display = 'block';
        payButton.style.display = 'block';
        buyBack.style.display = 'block';
        layButton.style.display = 'block';
        popupContainer.style.zIndex = 1000;
    
        // Удаляем предыдущий обработчик, если он был
        if (lastPayHandler) {
            payButton.removeEventListener('click', lastPayHandler);
        }
    
        // Новый обработчик для текущего вызова
        const handlePayButtonClick = function() {
            popupContainer.style.display = 'none';
            payButton.style.display = 'none';
            layButton.style.display = 'none';
            buyBack.style.display = 'none';
            ws.send(JSON.stringify({type: 'Payed', cellOwner: cellOwner, cellCost: cellCost, nickname: whoo, gameId: gameId }));
        };
        payButton.addEventListener('click', handlePayButtonClick);
        lastPayHandler = handlePayButtonClick;  // Сохраняем обработчик
    
    } else {
        popupContainer.style.display = 'none';
    }
    
}

async function displayBuyButton(pos, cellName, cellCost, cellOwner, fieldType, whoo) {
    try {
        const gameId = getGameIdFromUrl();
        const turn_info = await getCurrentPlayerInfo(gameId);
        const currentPlayerId = turn_info.currentPlayer;
        const currentColor = turn_info.currentColor;
        const userData = await getUserData();
        const nickname = userData.nickname;

        const popupContainer = document.getElementById('popupContainer');
        const buyButton = document.getElementById('buy');
        const cancelButton = document.getElementById('cancel');
        const buyBack = document.getElementById('buyBack');

        if (whoo === nickname) {   
            popupContainer.style.display = 'block';
            buyButton.style.display = 'block';
            cancelButton.style.display = 'block';
            buyBack.style.display = 'block';
            popupContainer.style.zIndex = 1000;
            if (lastCancelHandler) {
                cancelButton.removeEventListener('click', lastCancelHandler);
            }
            
            const handleCancelButtonClick = function() {
                popupContainer.style.display = 'none';
                buyButton.style.display = 'none';
                cancelButton.style.display = 'none';
                buyBack.style.display = 'none';
                ws.send(JSON.stringify({type:'board_is_ready', gameId:gameId}));
                return; //----------------------------------------------------------------------------------------------------
            };
            
            // Добавляем новый обработчик для кнопки "отказ"
            cancelButton.addEventListener('click', handleCancelButtonClick);
            lastCancelHandler = handleCancelButtonClick;

            // Удаляем предыдущий обработчик, если он был
            if (lastBuyHandler) {
                buyButton.removeEventListener('click', lastBuyHandler);
            }

            // при нажатии кнопки купить
            const handleBuyButtonClick = function() {
                popupContainer.style.display = 'none';
                buyButton.style.display = 'none';
                cancelButton.style.display = 'none';
                buyBack.style.display = 'none';
                ws.send(JSON.stringify({ type: 'BuyField', gameId: gameId, position: pos, nickname: whoo }));
            };

            buyButton.addEventListener('click', handleBuyButtonClick);
            lastBuyHandler = handleBuyButtonClick;  // Сохраняем обработчик
        } else {
            popupContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('Ошибка при отображении кнопки покупки', error);
    }
}






const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 70);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(1350, 600);

document.getElementById('sceneContainer').appendChild(renderer.domElement);

// Свет
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(-10, 20, -10);
scene.add(light);

// Создаем физический мир Cannon.js
const world = new CANNON.World();
world.gravity.set(0, -18, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 40;

// Создаем материал для пола и стен
const groundMaterial = new CANNON.Material("groundMaterial");

// Размеры пола
const groundWidth = 12;
const groundLength = 12;
const groundThickness = 0.5;

// Физическое тело пола для Cannon.js
const groundShape = new CANNON.Box(new CANNON.Vec3(groundWidth / 2, groundThickness / 2, groundLength / 2));
const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
groundBody.addShape(groundShape);
groundBody.position.set(-5, groundThickness / 2, 0);
world.addBody(groundBody);

// Визуализация пола с помощью Three.js
// const groundGeometry = new THREE.BoxGeometry(groundWidth, groundThickness, groundLength);
// const groundMaterialVisual = new THREE.MeshBasicMaterial({ color: 0x444444 });
// const groundMesh = new THREE.Mesh(groundGeometry, groundMaterialVisual);
// groundMesh.position.copy(groundBody.position);
// scene.add(groundMesh);

// Функция для создания и добавления видимых стен
function addVisibleWall(position, size) {
    // Физическая стена в Cannon.js
    const wallShape = new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2));
    const wallBody = new CANNON.Body({ mass: 0, material: groundMaterial });
    wallBody.addShape(wallShape);
    wallBody.position.set(...position);
    world.addBody(wallBody);

    // Визуальная стена в Three.js
//     const wallGeometry = new THREE.BoxGeometry(...size);
//     const wallMaterialVisual = new THREE.MeshBasicMaterial({ color: 0x888888 });
//     const wallMesh = new THREE.Mesh(wallGeometry, wallMaterialVisual);
//     wallMesh.position.set(...position);
//     scene.add(wallMesh);
}

// Размеры и позиции стен
const wallHeight = 40;
const wallSizeFrontBack = [groundWidth, wallHeight, 0.2];
const wallSizeLeftRight = [0.2, wallHeight, groundLength];

addVisibleWall([-5, wallHeight / 2, groundLength / 2], wallSizeFrontBack); // Передняя стена
addVisibleWall([-5, wallHeight / 2, -groundLength / 2], wallSizeFrontBack); // Задняя стена
addVisibleWall([groundWidth / 2 - 5, wallHeight / 2, 0], wallSizeLeftRight); // Правая стена
addVisibleWall([-groundWidth / 2 - 5, wallHeight / 2, 0], wallSizeLeftRight); // Левая стена



// Функция для создания точек на гранях кубика
function createDiceMaterial(faceValue) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Заполняем фон белым
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Определяем центр и смещение для углов
    const center = 32;
    const offset = 16;

    const positions = {
        1: [[center, center]], // Одна центральная точка

        2: [[offset, offset], [64 - offset, 64 - offset]], // Две диагональные точки

        3: [[offset, offset], [center, center], [64 - offset, 64 - offset]], // Три точки (центр и диагонали)

        4: [[offset, offset], [offset, 64 - offset], [64 - offset, offset], [64 - offset, 64 - offset]], // Четыре угловые точки

        5: [[offset, offset], [offset, 64 - offset], [center, center], [64 - offset, offset], [64 - offset, 64 - offset]], // Пять точек (центр и углы)

        6: [[offset, offset], [offset, center], [offset, 64 - offset], [64 - offset, offset], [64 - offset, center], [64 - offset, 64 - offset]], // Шесть точек (по два ряда с каждой стороны)
    };

    // Отрисовываем точки на холсте
    ctx.fillStyle = 'black';
    for (const [x, y] of positions[faceValue]) {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
    }

    // Используем canvas как текстуру
    const texture = new THREE.CanvasTexture(canvas);
    return new THREE.MeshLambertMaterial({ map: texture });
}
// Функция создания кубика
function createDice(initialPosition) {
    // Определим шесть граней кубика
    const materials = [
        createDiceMaterial(1),
        createDiceMaterial(2),
        createDiceMaterial(3),
        createDiceMaterial(4),
        createDiceMaterial(5),
        createDiceMaterial(6),
    ];

    // Создаем кубик в Three.js
    const diceGeometry = new THREE.BoxGeometry(1, 1, 1);
    const diceMesh = new THREE.Mesh(diceGeometry, materials);
    diceMesh.position.set(...initialPosition);
    scene.add(diceMesh);

    // Создаем физическое тело кубика в Cannon.js
    const diceShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
    const diceBody = new CANNON.Body({
        mass: 50,
        position: new CANNON.Vec3(...initialPosition),
        shape: diceShape,
        material: new CANNON.Material("diceMaterial")
    });
    world.addBody(diceBody);

    return { mesh: diceMesh, body: diceBody };
}

const dice1 = createDice([-2, 5, 0]); // Задаем начальную позицию для первого кубика
const dice2 = createDice([2, 5, 0]);  // Задаем начальную позицию для второго кубика


// Камера расположена сверху, направлена вниз
camera.position.set(0, 16, 0);
camera.lookAt(new THREE.Vector3(0, 0, 0));

// Обновляем положение и поворот кубиков
function updateDice(dice) {
    dice.mesh.position.copy(dice.body.position);
    dice.mesh.quaternion.copy(dice.body.quaternion);
}
const physicsInterval = 1000 / 60; // 60 раз в секунду
setInterval(() => {
    world.step(1 / 60);
    updateDice(dice1, {});
    updateDice(dice2, {});
}, physicsInterval);





const rotationThreshold = 1; // Минимальная угловая скорость
const velocityThreshold = 1;
function isDiceCompletelyStopped(diceBody) {
    return Math.abs(diceBody.angularVelocity.x) < rotationThreshold &&
        Math.abs(diceBody.angularVelocity.y) < rotationThreshold &&
        Math.abs(diceBody.angularVelocity.z) < rotationThreshold &&
        Math.abs(diceBody.velocity.x) < velocityThreshold &&
        Math.abs(diceBody.velocity.y) < velocityThreshold &&
        Math.abs(diceBody.velocity.z) < velocityThreshold;
}


function getTopFaceValue(diceBody) {
    let maxDot = -Infinity;
    let topFaceValue = 1; // Пусть начальное предположение — первая грань

    diceFaces.forEach(face => {
        // Переводим нормаль грани в мировые координаты
        const worldNormal = new CANNON.Vec3();
        diceBody.quaternion.vmult(face.normal, worldNormal);

        // Скалярное произведение нормали грани и вектора (0, 1, 0)
        const dot = worldNormal.dot(new CANNON.Vec3(0, 1, 0));

        // Находим максимальное скалярное произведение
        if (dot > maxDot) {
            maxDot = dot;
            topFaceValue = face.value;
        }
    });

    return topFaceValue;
}



function startDiceCheckInterval(diceBody, callback) {
    const interval = setInterval(() => {
        if (isDiceCompletelyStopped(diceBody)) {
            clearInterval(interval);

            // Задержка в 1 секунду после остановки кубика
            setTimeout(() => {
                const topFace = getTopFaceValue(diceBody);
                callback(topFace);
            }, 800); // Ждать 1 секунду
        }
    }, 100); // Проверять каждые 100 миллисекунд
}
// Используйте функцию для двух кубиков
function checkAllDice(currentColor, nickname) {
    let diceValues = { dice1: 0, dice2: 0 }; // Инициализируем значения для обоих кубиков

    // Функция для обработки значения кубика с заданной перестановкой значений
    function processTopFace(topFace) {
        switch (topFace) {
            case 6: return 2;
            case 5: return 1;
            case 1: return 5;
            case 2: return 6;
            default: return topFace;
        }
    }

    // Создаем Promise для каждого кубика
    const dice1Promise = new Promise((resolve) => {
        startDiceCheckInterval(dice1.body, (topFace) => {
            topFace = processTopFace(topFace);
            resolve(topFace); // Завершаем Promise первого кубика
        });
    });

    const dice2Promise = new Promise((resolve) => {
        startDiceCheckInterval(dice2.body, (topFace) => {
            topFace = processTopFace(topFace);
            resolve(topFace); // Завершаем Promise второго кубика
        });
    });

    // Ждем завершения обоих Promise, перед тем как отправить результаты
    Promise.all([dice1Promise, dice2Promise]).then(([dice1, dice2]) => {
        diceValues.dice1 = dice1;
        diceValues.dice2 = dice2;

        // Отправляем результаты на сервер
        const rollId = crypto.randomUUID();

        // Отправляем результаты на сервер с UID
        const gameId = getGameIdFromUrl();
        ws.send(JSON.stringify({
            type: 'DiceResult',
            dice1: dice1,
            dice2: dice2,
            color: currentColor,
            nickname: nickname,
            rollId: rollId,
            gameId:gameId // Добавляем сгенерированный UID к сообщению
        }));    }).catch(error => {
        console.error('Ошибка при определении значений кубиков:', error);
    });
}



// Список нормалей для всех граней кубика
const diceFaces = [
    { value: 1, normal: new CANNON.Vec3(0, 0, 1) }, // Грань 1
    { value: 2, normal: new CANNON.Vec3(0, 0, -1) }, // Грань 2
    { value: 3, normal: new CANNON.Vec3(0, 1, 0) }, // Грань 3
    { value: 4, normal: new CANNON.Vec3(0, -1, 0) }, // Грань 4
    { value: 5, normal: new CANNON.Vec3(1, 0, 0) }, // Грань 5
    { value: 6, normal: new CANNON.Vec3(-1, 0, 0) } // Грань 6
];



// Бросок кубиков
function rollDice(position1, velocity1, angularVelocity1, position2, velocity2, angularVelocity2) {
    // Устанавливаем начальные параметры для первого кубика
    dice1.body.position.set(...position1);
    dice1.body.velocity.set(...velocity1);
    dice1.body.angularVelocity.set(...angularVelocity1);

    // Устанавливаем начальные параметры для второго кубика
    dice2.body.position.set(...position2);
    dice2.body.velocity.set(...velocity2);
    dice2.body.angularVelocity.set(...angularVelocity2);
    animate();
}



function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
async function displayRollDiceButton(showBuild = -1) {
    try {
        const gameId = getGameIdFromUrl();
        const turn_info = await getCurrentPlayerInfo(gameId);
        console.log("displayRollDiceButton, Ход:", turn_info );
        const currentPlayerId = turn_info.currentPlayer;
        const {currentColor} = turn_info;
        const userData = await getUserData();
        const {nickname} = userData;

        const popupContainer = document.getElementById('popupContainer');
        const rollDiceButton = document.getElementById('rollDiceButton');
        const buyBackButton = document.getElementById('buyBack');
        const buildButton = document.getElementById('build');

        if (currentPlayerId === nickname) {
            popupContainer.style.display = 'block';
            rollDiceButton.style.display = 'flex';
            buyBackButton.style.display = 'flex';
            if (showBuild === -1){
                buildButton.style.display = 'flex';
            }
            popupContainer.style.zIndex = 1000;

            // Удаляем предыдущий обработчик, если он был
            if (lastRollDiceHandler) {
                rollDiceButton.removeEventListener('click', lastRollDiceHandler);
            }

            // Новый обработчик для текущего вызова
            const handleRollDiceClick = function() {
                popupContainer.style.display = 'none';
                rollDiceButton.style.display = 'none';
                buyBackButton.style.display = 'none';
                buildButton.style.display = 'none';
                ws.send(JSON.stringify({ type: 'rollDice', gameId: gameId, color: currentColor, nickname: currentPlayerId }));
                checkAllDice(currentColor, currentPlayerId);
            };
            rollDiceButton.addEventListener('click', handleRollDiceClick);
            lastRollDiceHandler = handleRollDiceClick;  // Сохраняем обработчик

            const handleBuildClick = function() {
                popupContainer.style.display = 'none';
                rollDiceButton.style.display = 'none';
                buyBackButton.style.display = 'none';
                buildButton.style.display = 'none';
                dimNonPlayerCellsForBuild(currentColor); // Затемняем ячейки, не принадлежащие текущему игроку

                if (buildHandlers.length) {
                    buildHandlers.forEach(({cell, handler}) => {
                        cell.removeEventListener('click', handler);
                    });
                    buildHandlers = [];
                }

                const cells = document.querySelectorAll('.cell:not(.dimmed), .cell-w:not(.dimmed)');
                cells.forEach(cell => {
                    const handler = (event) => sendBuildMessage(event, nickname);
                    cell.addEventListener('click', handler);
                    buildHandlers.push({cell, handler});
                });
            };
            buildButton.addEventListener('click', handleBuildClick);
            lastBuildHandler = handleBuildClick;  // Сохраняем обработчик
        } else {
            popupContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('Ошибка при отображении кнопки броска кубиков:', error);
    }
}

function dimNonPlayerCellsForBuild(currentColor) {
    const colors = {
        'red': 'rgb(255, 0, 0)',
        'yellow': 'rgb(255, 255, 0)',
        'green': 'rgb(0, 128, 0)',
        'blue' : "rgb(0, 0, 255)"
    };
    const cellsH = document.querySelectorAll('.cell');
    const cellsW = document.querySelectorAll('.cell-w');
    const cells = [...cellsH, ...cellsW]; // Объединяем результаты

    cells.forEach(cell => {
        const cellStyle = getComputedStyle(cell);
        const ownerColor = cellStyle.backgroundColor; // Получаем цвет фона

        const houses = parseInt(cell.getAttribute('housesnum'), 10);

        if (ownerColor != colors[currentColor] || houses < 0 || houses > 4 || ownerColor === "rgb(79, 156, 147)") { // Сравниваем с цветом текущего игрока и проверяем количество домов
            cell.classList.add('dimmed');
        } else {
            cell.classList.remove('dimmed');
        }
    });
    displayCancelButton();
}

function sendBuildMessage(event, nickname){
    if (buildHandlers.length) {
        buildHandlers.forEach(({cell, handler}) => {
            cell.removeEventListener('click', handler);
        });
        buildHandlers = [];
    }

    const gameId = getGameIdFromUrl();
    const cell = event.currentTarget;
    const position = cell.getAttribute('data-position');
    const houseCount = parseInt(cell.getAttribute('housesnum'), 10);
    const popupContainer = document.getElementById('popupContainer');
    const cancelBuild = document.getElementById('buildcancel');
    popupContainer.style.display = 'none';
    cancelBuild.style.display = 'none';
    showAllFields();
    displayRollDiceButton(0);
    // Отправляем запрос на сервер для постройки дома
    ws.send(JSON.stringify({ type: 'buildHouse', gameId: gameId, position: position, houses: houseCount + 1, nickname: nickname }));
    // Обновляем housesnum на клиенте
    cell.setAttribute('housesnum', houseCount + 1);
}


function showAllFields(){
    if (buildHandlers.length) {
        buildHandlers.forEach(({cell, handler}) => {
            cell.removeEventListener('click', handler);
        });
        buildHandlers = [];
    }

    const cellsH = document.querySelectorAll('.cell');
    const cellsW = document.querySelectorAll('.cell-w');
    const cells = [...cellsH, ...cellsW];
    cells.forEach(cell =>{
        cell.classList.remove('dimmed');
    });
}


async function displayCancelButton(){

    const gameId = getGameIdFromUrl();
        const turn_info = await getCurrentPlayerInfo(gameId);
        console.log("displayRollDiceButton, Ход:", turn_info );
        const currentPlayerId = turn_info.currentPlayer;
        const {currentColor} = turn_info;
        const userData = await getUserData();
        const {nickname} = userData;

        const popupContainer = document.getElementById('popupContainer');
        const cancelBuild = document.getElementById('buildcancel');


        if (currentPlayerId === nickname) {
            popupContainer.style.display = 'block';
            cancelBuild.style.display = 'flex';
            popupContainer.style.zIndex = 1000;

            if (lastCancelBuildHandler) {
                rollDiceButton.removeEventListener('click', lastCancelBuildHandler);
            }

            // Новый обработчик для текущего вызова
            const handleCancelBuildClick = function() {
                popupContainer.style.display = 'none';
                cancelBuild.style.display = 'none';
                if (buildHandlers.length) {
                    buildHandlers.forEach(({cell, handler}) => {
                        cell.removeEventListener('click', handler);
                    });
                    buildHandlers = [];
                }

                showAllFields();
                displayRollDiceButton();
            };
            cancelBuild.addEventListener('click', handleCancelBuildClick);
            lastCancelBuildHandler = handleCancelBuildClick;  // Сохраняем обработчик
        }
}




document.addEventListener('DOMContentLoaded', startTimer);



document.getElementById('send-message').addEventListener('click', function() {
    const chatInput = document.getElementById('chat-input');
    const text = chatInput.value.trim(); // Получаем текст из поля ввода и удаляем пробелы по краям

    if (text) { // Проверяем, что текст не пустой
        sendMessage(text); // Вызываем функцию отправки сообщения
        chatInput.value = ''; // Очищаем поле ввода после отправки
    }
});




// Функция для показа всплывающего окна
function showTooltip(imageSrc, text) {
    const tooltip = document.getElementById('tooltip');
    const tooltipImage = document.getElementById('tooltipImage');
    const tooltipText = document.getElementById('tooltipText');
    
    tooltipImage.src = imageSrc;
    tooltipText.textContent = text;
    
    tooltip.style.display = 'block';
}

// Функция для скрытия всплывающего окна
function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.display = 'none';
}

async function INFORMATION() {
    const gameId = getGameIdFromUrl();
    const fullData = await getBoardData(gameId);
    const boardData = fullData.board;
    boardData.forEach((cellData, index) => {
        const cellElement = document.querySelector(`.cell[data-position="${index}"], .cell-w[data-position="${index}"]`);
        if (cellElement) {
            cellElement.addEventListener('click', event => {
                const position = index;
                const imageSrc = `/images/1_im${index}.jpg`; // Путь к изображению для данного поля
                const text = `Описание для поля ${index}`; // Описание для данного поля
                try {
                    showTooltip(imageSrc, text);
                } catch {
                    const imageSrc = `/images/test_photo.jpg`; // Путь к дефолтному изображению 
                    showTooltip(imageSrc, text);
                }
            });
        }
    });

    document.addEventListener('click', event => {
        const tooltip = document.getElementById('tooltip');
        const isClickInsideTooltip = tooltip.contains(event.target);
        const isClickInsideField = Array.from(document.querySelectorAll('.cell, .cell-w')).some(field => field.contains(event.target));

        if (!isClickInsideTooltip && !isClickInsideField) {
            hideTooltip();
        }
    });
}




// ************************************************************************************************************************

