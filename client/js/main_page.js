async function getUserData() {
    try {
        const response = await fetch('/api/userinfo');
        if (!response.ok) throw new Error('Не удалось загрузить информацию пользователя');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(error);
        return null; // или можно вернуть пустой объект {}, в зависимости от того, что предпочтительнее
    }
}
async function displayUserNickname() {
    const userData = await getUserData();
    if (userData) {
        document.getElementById('nickname-placeholder').textContent = userData.nickname;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    displayUserNickname()
});

console.log("JavaScript file is loaded");
function previewFile() {
    const fileChooser = document.getElementById('fileChooser');
    const profilePhoto = document.getElementById('profilePhoto');
    const file = fileChooser.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = function() {
            profilePhoto.src = reader.result;
        }
        reader.readAsDataURL(file);
    }
}
function toggleButtons() {
    const buttons = document.querySelector('.user-photo .buttons');
    buttons.style.display = (buttons.style.display === 'none') ? 'flex' : 'none';
}

function viewPhoto() {
    const photoSrc = document.getElementById('profilePhoto').src;
    // Открывает фотографию в новой вкладке или как вам удобно
    window.open(photoSrc, '_blank');
}


// ------------------------------------

const PORT = 3306; 
const ws = new WebSocket('wss://hsemonopoly-production.up.railway.app')
const userData = await getUserData();
s();
function s(){
    ws.onopen = async () => { // Обрати внимание на async
        console.log('Соединение с сервером установлено');
        const userData = await getUserData();
        const nicknameMessage = JSON.stringify({ type: 'register', nickname: userData.nickname });
        ws.send(nicknameMessage);
    };
}

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "HELLO"){
        requestGamesList(); // При установке соединения отправляем запрос на получение списка игр
    } 
// ---
    else if (message.type === "updateGamesOK"){
        requestGamesList();
    }

    else if (message.type === 'gamesList') {
        const gamesListElement = document.getElementById("games");
        gamesListElement.innerHTML = ''; // Очищаем список игр

        message.games.forEach((game) => {
            const gameElement = document.createElement("div");
            gameElement.innerHTML = `Игра ${game.id}: Карта: ${game.map}; Ставка: ${game.bet}; Игроки(${JSON.parse(game.players_id).length}/${game.players_count}): ${JSON.parse(game.players_id)}` ;
            console.log(`Игра ${game.id}: Карта: ${game.map}; Ставка: ${game.bet}; Игроки(${JSON.parse(game.players_id).length}/${game.players_count}): ${JSON.parse(game.players_id)}`)
            if (JSON.parse(game.players_id).includes(userData.nickname)){

                const leaveButton = document.createElement("button");
                leaveButton.innerText = "Выйти";
                leaveButton.addEventListener("click", function() { leaveGame(game.id); });
                gameElement.appendChild(leaveButton);
            } else {

                const joinButton = document.createElement("button");
                joinButton.innerText = "Присоединиться";
                joinButton.addEventListener("click", function() { joinGame(game.id); });
                gameElement.appendChild(joinButton);
            }
            gamesListElement.appendChild(gameElement);
        });
    } else if (message.type === "startGame"){
        window.location.href = `./main_page/${message.gameId}`;
    } else if (message.type === "reconnect"){
        window.location.href = `./main_page/${message.gameId}`;


// ---
    } else if( message.type === "add_error" || message.type === "create_game_error" || message.type === "wrong_numbers"){
        alert(message.message);
    } else if (message.type === "create_game_error"){
        alert(message.message);
    }
};
function joinGame(gameId) {
    ws.send(JSON.stringify({ type: 'joinGame', gameId: gameId, nickname : userData.nickname}));
}
function leaveGame(gameId){
    ws.send(JSON.stringify({ type:'leaveGame', gameId: gameId, nickname: userData.nickname }));
}


const send = (event) => {
    event.preventDefault();
    const password = document.getElementById("password").value;
    const players_count = document.getElementById("players_count").value;
    const map = document.getElementById("map").value;
    const bet = document.getElementById("bet").value;
    const nickname = userData.nickname;
    if (players_count < 2 || players_count > 4 ){
        ws.send(JSON.stringify({
            type: 'wrong_numbers'
        }));
        return false;
    } else {
        ws.send(JSON.stringify({
            type: 'createGame', // Убедись, что сервер обрабатывает этот тип сообщения
            password, 
            players_count, 
            map, 
            bet,
            nickname
        }));

        return false;
    }
};

const formEL = document.getElementById("create-game");
formEL.addEventListener('submit', send);

function requestGamesList() {
    // Отправляем запрос на получение списка игр
    ws.send(JSON.stringify({ type: 'getGamesList' }));
}

