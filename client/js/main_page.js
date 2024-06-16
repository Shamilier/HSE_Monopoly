let docTitel = document.title;
window.addEventListener("blur", () =>{document.title = "Come Back :(";});
window.addEventListener("focus", () => {document.title = docTitel;});
const themes = [
    {
        background: "#1A1A2E",
        color: "#FFFFFF",
        primaryColor: "#0F3460"
    },
    {
        background: "#461220",
        color: "#FFFFFF",
        primaryColor: "#E94560"
    },
    {
        background: "#192A51",
        color: "#FFFFFF",
        primaryColor: "#967AA1"
    },
    {
        background: "#F7B267",
        color: "#000000",
        primaryColor: "#F4845F"
    },
    {
        background: "#F25F5C",
        color: "#000000",
        primaryColor: "#642B36"
    },
    {
        background: "#231F20",
        color: "#FFF",
        primaryColor: "#BB4430"
    }
];

const setTheme = (theme) => {
    const root = document.querySelector(":root");
    root.style.setProperty("--background", theme.background);
    root.style.setProperty("--color", theme.color);
    root.style.setProperty("--primary-color", theme.primaryColor);
    root.style.setProperty("--glass-color", theme.glassColor);
    // Сохраняем выбранную цветовую схему в localStorage
    localStorage.setItem("selectedTheme", JSON.stringify(theme));
};

const displayThemeButtons = () => {
    const btnContainer = document.querySelector(".theme-btn-container");
    themes.forEach((theme) => {
        const div = document.createElement("div");
        div.className = "theme-btn";
        div.style.cssText = `background: ${theme.background}; width: 25px; height: 25px`;
        btnContainer.appendChild(div);

        div.addEventListener("click", () => {
            setTheme(theme); // Применяем цветовую схему
        });
    });
};

// При загрузке страницы проверяем, есть ли сохраненная цветовая схема в localStorage
document.addEventListener("DOMContentLoaded", function() {
    const selectedTheme = localStorage.getItem("selectedTheme");
    if (selectedTheme) {
        const parsedTheme = JSON.parse(selectedTheme);
        setTheme(parsedTheme); // Применяем сохраненную цветовую схему при загрузке страницы
    }
});

displayThemeButtons();

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
    console.log(message);
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
            gameElement.classList.add("game");
            
            const gameInfoElement = document.createElement("div");
            gameInfoElement.classList.add("game-info");
            gameInfoElement.innerHTML = `Игра : Ставка: ${game.bet}; Игроки(${JSON.parse(game.players_id).length}/${game.players_count}): ${JSON.parse(game.players_id).join(", ")}` ;
            gameElement.appendChild(gameInfoElement);
    
            console.log(`Игра ${game.id}: Карта: ${game.map}; Ставка: ${game.bet}; Игроки(${JSON.parse(game.players_id).length}/${game.players_count}): ${JSON.parse(game.players_id).join(", ")}`)
    
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
    const players_count = document.getElementById("players_count").value;
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
            players_count, 
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

