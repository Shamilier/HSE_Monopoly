const mysql = require('mysql2');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const { Server } = require("ws");
const { v4: uuid } = require("uuid");
const bcrypt = require('bcryptjs');
const fs = require('fs');
const https = require('https');
require('dotenv').config();

const gamedb = mysql.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT
});

// Настройка Express
const app = express();
const PORT = process.env.PORT || 3000;
app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
});


function generateRandomDiceValues() {
    // Фиксированные начальные позиции для обоих кубиков
    const initialPosition1 = [-7, 10, 0];
    const initialPosition2 = [-5, 10, 0];
    
    // Генерация скоростей с меньшим подъемом вверх
    const randomVelocity = () => [
        Math.random() * 5 - 1, // Небольшой наклон влево-вправо
        Math.random() * -8 - 5, // Сильное падение вниз, слегка подлетающее вверх
        Math.random() * 5 - 1 // Небольшой наклон вперед-назад
    ];
    
    // Генерация углового вращения с интенсивным кручением
    const randomAngular = () => [
        Math.random() * 30 - 20, // Вращение вокруг оси X
        Math.random() * 30 - 20, // Вращение вокруг оси Y
        Math.random() * 30 - 20  // Вращение вокруг оси Z
    ];

    return {
        dice1: {
            position: initialPosition1,
            velocity: randomVelocity(),
            angularVelocity: randomAngular()
        },
        dice2: {
            position: initialPosition2,
            velocity: randomVelocity(),
            angularVelocity: randomAngular()
        }
    };
}



function sendToGame(gameId, message) {
    const players = GamesWithPlayers[gameId] || [];
    players.forEach(playerNickname => {
        const playerSocket = ClientConnections[playerNickname];
        if (playerSocket) {
            console.log(message)
            playerSocket.send(JSON.stringify(message));
        }
    });
}

function checkMonopoly(playerProperties, gameId, color, fieldType, position, nickname) {
    return new Promise((resolve, reject) => {
        console.log('Зашел в check monopoly', playerProperties, gameId, color, fieldType, position, nickname);

        const query = "SELECT num FROM fields WHERE field_id = ?";
        gamedb.query(query, [color], (error, results) => {
            if (error) {
                console.error("Ошибка при проверке монополии:", error);
                return reject(false);
            }

            if (results.length > 0) {
                const propertiesNeeded = results[0].num;
                if (fieldType != "special") {
                    const res = (playerProperties[color] === propertiesNeeded);
                    if (res === true) {
                        type = `${fieldType}.${color}`;
                        const query = "UPDATE game_cells SET houses = 0 WHERE id = ? AND  type = ?";
                        gamedb.query(query, [gameId, type], (error) => {
                            if (error) {
                                console.log("Ошибка при обновлении домов", error);
                                return reject(false);
                            } else {
                                const query1 = `UPDATE state SET monopolies = CASE WHEN monopolies = '0' THEN ? ELSE CONCAT(monopolies, ', ', ?) END WHERE id = ? AND player_id = ?`;
                                gamedb.query(query1, [color, color, gameId, nickname], (error) => {
                                    if (error) {
                                        console.log("Ошибка при обновлении монополий", error);
                                        return reject(false);
                                    } else {
                                        return resolve(true);
                                    }
                                });
                            }
                        });
                    } else {
                        console.log("Монополии нет", playerProperties[color], propertiesNeeded);
                        return resolve(false);
                    }
                } else {
                    return resolve(false);
                }
            } else {
                return resolve(false);
            }
        });
    });
}





app.use(bodyParser.json());
app.use(express.static('client')); 
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
}));
app.use('/images', express.static(path.join(__dirname, "..", 'client', 'images')));
// Маршруты
// Маршрут обработки POST-запроса на "/register"
app.post('/register', async (req, res) => {
    try {
        const { email, nickname, password } = req.body;

        // Проверяем, что все необходимые данные переданы
        if (!email || !nickname || !password) {
            console.log(email, nickname, password);
            return res.status(400).send('Missing required fields.');

        }

        // Хешируем пароль
        const hashedPassword = password;
        // Проверяем, существует ли уже пользователь с таким email
        const userExists = await new Promise((resolve, reject) => {
             gamedb.query('SELECT * FROM users WHERE nickname = ? OR email = ?', [nickname, email], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results.length > 0);
                }
            });
        });

        if (userExists) {
            return res.status(409).send('this email or nickname already exists. Try again');
        } else {
            // Регистрируем нового пользователя
            await new Promise((resolve, reject) => {
                 gamedb.query('INSERT INTO users (email, nickname, password) VALUES (?, ?, ?)', [email, nickname, hashedPassword], (error, results) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });

            return res.status(201).send('User registered successfully.');
        }
    } catch (error) {
        console.error('Ошибка при выполнении запроса к базе данных:', error);
        return res.status(500).send('Internal Server Error');
    }
});


app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Запрос к базе данных для поиска пользователя по email
     gamedb.query('SELECT * FROM users WHERE email = ?', [email], async (error, results) => {
        if (error) {
            console.error('Ошибка при выполнении запроса к базе данных:', error);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length > 0) {
            // Пользователь найден, сравниваем пароли
            const user = results[0];

            if (password === user.password) {
                // Пароли совпадают, установка сессии
                req.session.user = { id: user.id, nickname: user.nickname, currentGame : -1};
                res.redirect('/main_page.html'); // Или другая страница, на которую нужно перенаправить пользователя
            } else {
                // Пароли не совпадают
                res.status(401).send('Login failed. Please check your email and password.');
            }
        } else {
            // Пользователь не найден
            res.status(404).send('User not found. Please check your email and password.');
        }
    });
});
// Маршрут для обработки GET-запроса на "/"
const { error } = require('console');
const { tmpdir } = require('os');

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'login.html')); // Отправляем файл login.html при запросе "/"
});
app.get('/css/login.css', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'css', 'login.css'), { "Content-Type": "text/css" });
});

// Маршрут для обработки GET-запроса на файл JavaScript
app.get('/js/login.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'js', 'login.js'), { "Content-Type": "application/javascript" });
});
// ------------------------------------------------------------------------------
// Маршрут для обработки GET-запроса на "/register.html"
app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'register.html'));
});
app.get('/css/register.css', (req, res) => {
    console.log(__dirname);
    res.sendFile(path.join(__dirname, '..', 'client', 'css', 'register.css'), { "Content-Type": "text/css" });
});
app.get('/js/register.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'js', 'register.js'), { "Content-Type": "application/javascript" });
});
// ------------------------------------------------------------------
app.get('/main_page.html', (req, res) => {
    if (req.session.user){
        res.sendFile(path.join(__dirname, '..', 'client', 'main_page.html'));
    } else{
        res.status(401).send('Пожалуйста, войдите в систему');
    }
});
app.get('/css/main_page.css', (req, res) => {
    console.log(__dirname);
    res.sendFile(path.join(__dirname, '..', 'client', 'css', 'main_page.css'), { "Content-Type": "text/css" });
});
app.get('/js/main_page.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'js', 'main_page.js'), { "Content-Type": "application/javascript" });
});
app.get('/images/default_photo.jpg', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'images', 'default_photo.jpg'), { "Content-Type": "image/jpeg" });
});
// --------------------------------------------------------------------
app.get('/main_page/:gameId', (req, res) => {
    if (req.session.user) {
        // Путь к вашему файлу HTML страницы игры
        const gamePagePath = path.join(__dirname, '..', 'client', 'game.html');
        res.sendFile(gamePagePath);
    } else {
        // Если пользователь не авторизован, отправляем его на страницу логина
        res.redirect('/login.html');
    }
});

app.get('/css/game.css', (req, res) => {
    console.log(__dirname);
    res.sendFile(path.join(__dirname, '..', 'client', 'css', 'game.css'), { "Content-Type": "text/css" });
});
app.get('/js/game.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..',  'client', 'js', 'game.js'), { "Content-Type": "application/javascript" });
});
// --------------------------------------------------------------------
app.get('/api/userinfo', (req, res) => {
    if (req.session.user) {
        res.json({ nickname: req.session.user.nickname, currentGame: req.session.user.currentGame });
    } else {
        res.status(401).json({ message: 'Не авторизован' });
    }
});




app.get('/api/game/:gameId/players', async (req, res) => {
    try {
        const { gameId } = req.params;
        const query = 'SELECT * FROM state WHERE id = ?';
        const playersData = await new Promise((resolve, reject) => {
            gamedb.query(query, [gameId], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
        res.json(playersData);
    } catch (error) {
        console.error('Ошибка при выполнении запроса к базе данных:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/game/:gameId/board', async (req, res) => {
    try {
        const { gameId } = req.params;
        // Запрос к базе данных для получения информации о полях
        const queryCells = 'SELECT * FROM `game_cells` WHERE id = ? ORDER BY `position` ASC';
        const queryPlayers = 'SELECT * FROM state WHERE id = ?';

        // Выполнение первого запроса для получения данных о ячейках
        const boardData = await new Promise((resolve, reject) => {
            gamedb.query(queryCells, [gameId], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });

        // Выполнение второго запроса для получения данных о позициях игроков
        const playerPositions = await new Promise((resolve, reject) => {
            gamedb.query(queryPlayers, [gameId], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });

        // Отправка объединённых данных о доске и игроках
        res.json({
            board: boardData,
            players: playerPositions
        });
    } catch (error) {
        console.error('Ошибка при выполнении запроса к базе данных:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/game/:gameId/currentTurn', (req, res) => {
    try {
        const { gameId } = req.params;

        // Обновлённый запрос, чтобы получить player_id и color
        const query = 'SELECT player_id, color FROM state WHERE turn = 1 AND id = ?';
        gamedb.query(query, [gameId], (error, results, fields) => {
            if (error) {
                console.error('Ошибка при выполнении запроса к базе данных:', error);
                return res.status(500).send('Internal Server Error');
            }

            if (results.length === 0) {
                return res.status(404).send('Игрок с текущим ходом не найден');
            }

            // Теперь results[0] содержит и player_id, и color
            const currentPlayer = results[0];
            res.json({ currentPlayer: currentPlayer.player_id, currentColor: currentPlayer.color });
        });
    } catch (error) {
        console.error('Ошибка при выполнении запроса к базе данных:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ----------------------------------------------------------------------
// WebSocket сервер на том же порту, что и Express
const expressServer = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const wss = new Server({ server: expressServer });

let ClientConnections = {};
let ClientGames = {};
let userCurrentGame = {}; // Словарь для хранения текущей игры пользователя: { 'nickname': 'gameId', ... }
let GamesWithPlayers = {} // словарь типа {'gameId': [player1, player2]}
s();


function broadcastGamesList() {
    const query = 'SELECT * FROM cre WHERE status = -1'; // Получаем игры, которые ищут игроков
    gamedb.query(query, [], (error, results) => {
        if (error) {
            console.error('Ошибка получения списка игр:', error);
            return;
        }
        console.log(results);
        const gamesList = JSON.stringify({ type: 'gamesList', games: results });
        Object.values(ClientConnections).forEach(ws => {
            ws.send(gamesList);
        });
    });
    return;
}

function checkFullness(gameId){
    const query = 'SELECT * FROM cre WHERE id = ?';
    gamedb.query(query, [gameId], (error, results) => {
        if (error) {
            console.error('Ошибка получения списка игр:', error);
            return;
        }
        
        let game = results[0];
        let status = 0;
        let tmpGameId = game.id;
        let colors = ['red', 'blue', 'green', 'yellow'];
        const query = 'UPDATE cre SET status = ? WHERE id = ?';
        let players_id = game.players_id;
        players_id.forEach((player_id, index) => {
            // Выбираем цвет для игрока
            let color = colors[index]; 
            let turn = 0;
            // Вставляем состояние игрока в таблицу state
            if (color === 'red'){
                turn = 1
            }
            gamedb.query('INSERT INTO state (id, player_id, color, turn) VALUES (?, ?, ?, ?)', [gameId, player_id, color, turn], (error, insertResults) => {
                if (error) {
                    console.error('Ошибка добавления состояния игрока:', error);
                }
            });
        })
        gamedb.query(query, [status, tmpGameId], (error, results) => {
            if (error) {
                console.error('Ошибка получения списка игр:', error);
                return;
            }
            players_id.forEach(playerNickname => {
                if (ClientConnections[playerNickname]) {
                    userCurrentGame[playerNickname] = gameId;
                    ClientConnections[playerNickname].send(JSON.stringify({ type: 'startGame', gameId: gameId }));
                }
            })
        });

    });
    broadcastGamesList()
}

function deleteGame(gameId){
    const query = 'DELETE FROM cre WHERE id = ?';
    gamedb.query(query, [gameId], (error, results) =>{
        if (error) {
            console.error('Ошибка получения списка игр:', error);
            return;
        }
    });
    broadcastGamesList();
    return;
}

function sendMessage(text, nickname, gameId){
    const query = 'INSERT INTO chat_messages (gameId, from_nickname, message) VALUES (?, ?, ?)';
    gamedb.query(query, [gameId, nickname, text], (error, results) => {
        if (error) {
            console.error('Ошибка при добавлении сообщения в базу данных:', error);
            return;
        }
        // Отправляем сообщение всем участникам игры
        GamesWithPlayers[gameId].forEach(playerNickname => {
            if (ClientConnections[playerNickname]) {
                ClientConnections[playerNickname].send(JSON.stringify({ type: 'chatMessage', text: text, from: nickname }));
            }
        });
    });
}

function updateTurn(nextPlayerColor, gameId){
    const updateTurnQuery = `
    UPDATE state
    SET turn = CASE
        WHEN color = ? THEN 1 
        ELSE 0 
    END
    WHERE id = ?`;

gamedb.query(updateTurnQuery, [nextPlayerColor, gameId], (error, results) => {
    if (error) {
        console.error('Ошибка при обновлении хода:', error);
        return;
    }
    console.log(`Ход передан игроку с цветом ${nextPlayerColor}`);
    });
}
function updatePlayerBalance(gameId, nickname, summ){
    query = "UPDATE state SET balance = balance + ? WHERE id = ? AND player_id = ?";
    gamedb.query(query, [summ,gameId, nickname], (error)=>{
        if (error){
            console.log('черепаха', error);
        }
        return;
    });
}

function updatePosition(dice1, dice2, gameId, nickname, nextPlayerColor, currentPlayerColor){
    const diceTotal = dice1 + dice2;
    const updatePositionQuery = `
        UPDATE state
        SET position = (position + ?) % 42
        WHERE id = ? AND player_id = ?`;

    gamedb.query(updatePositionQuery, [diceTotal, gameId, nickname], (error, results) => {
        if (error) {
            console.error('Ошибка при обновлении позиции:', error);
            return;
        }
        console.log(`Позиция игрока ${nickname} обновлена`);
        const getCellDataQuery = "SELECT name, position, cost, owner, type FROM game_cells WHERE position = (SELECT position FROM state WHERE player_id = ? AND id = ?) AND id = ?";
        gamedb.query(getCellDataQuery, [nickname, gameId, gameId], (error, cellResults) => {
            if (error) {
                console.error('Ошибка при получении данных о клетке:', error);
                return;
            }
            if (cellResults.length > 0 & (dice1 != 0 & dice2 != 0)) {
                const cellData = cellResults[0];
                if ((dice1 != dice2 || cellData.position === 34) & (dice1 != 0 & dice2 != 0)){
                    updateTurn(nextPlayerColor, gameId);
                } if (cellData.position == 21){
                    updatePlayerBalance(gameId, nickname, 350000);
                } if ((cellData.position > 0 && cellData.position <= 12) && (cellData.position - diceTotal < 0) ){
                    updatePlayerBalance(gameId, nickname, 200000);
                } if(cellData.position === 0){
                    updatePlayerBalance(gameId, nickname, 400000);
                }
                // } if (cellData.position === 2 || cellData.position === 23 || cellData.position === 40) {
                //     PayTaxes();
                // }
                GamesWithPlayers[gameId].forEach(playerNickname => {
                    if (ClientConnections[playerNickname]) {
                        ClientConnections[playerNickname].send(JSON.stringify({ 
                            type: 'redrawBoard',
                            position: cellData.position,
                            name: cellData.name,
                            cost: cellData.cost,
                            owner: cellData.owner,
                            fieldType: cellData.type.split('.')[0].split(',')[0],
                            nickname: nickname,
                            oldPosition: cellData.position - diceTotal,
                            currentPlayerColor: currentPlayerColor
                        }));
                    }
                });
            } else if (dice1 === 0 & dice2 === 0){
                GamesWithPlayers[gameId].forEach(playerNickname => {
                    if (ClientConnections[playerNickname]) {
                        ClientConnections[playerNickname].send(JSON.stringify({ type: 'getTurn'}));
                    }
                })
                return;
            }
        });
    });
}



function s(){
    wss.on("connection", (ws) => {
        console.log(`New connection -_-`);
    // 
        ws.on("message", (rawMessage) => {

            let message;
            try {
                // Преобразуем rawMessage в строку, если это необходимо
                const messageStr = typeof rawMessage === 'string' ? rawMessage : rawMessage.toString('utf8');
                // Парсим строку в объект JavaScript
                message = JSON.parse(messageStr);
            } catch (error) {
                console.error("Ошибка при парсинге сообщения:", error);
                // Обрабатываем ошибку, например, отправляем сообщение об ошибке обратно через WebSocket
                return;
            }

            console.log(message);
    // ---

            if (message.type === "register" && message.nickname) {
                const nickname = message.nickname;
                console.log(`Hi, ${nickname}`);
                ws.nickname = nickname;
                ClientConnections[nickname] = ws;
                if (userCurrentGame[nickname]) {
                    return ws.send(JSON.stringify({ type: 'reconnect', gameId: userCurrentGame[nickname] }));
                }
                return ws.send(JSON.stringify({ type: "HELLO", message: " "}))
            };
            const { type, password, players_count, map, bet } = message;
            console.log(message);
    // ---  
            if (type === 'getGamesList') {
                // Если пришел запрос на получение списка игр, отправляем его
                broadcastGamesList();
                return;
            }
    // ---
            else if (type === 'wrong_numbers'){
                return ws.send(JSON.stringify({ type: 'wrong_numbers', message: 'В игре не может быть меньше 2 или больше 4 человек' }));
            }
    // ---

            else if (type === 'createGame') {
                const { type, players_count, bet, nickname} = message;
                let status = -1; 
                // Статус игры == -1 значит игра еще не началась

                // Создаём массив с одним никнеймом и преобразуем его в JSON-строку
                let players_id = JSON.stringify([nickname]);
                const query = 'INSERT INTO cre (id, password, players_count, map, bet, players_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
                const currGameId = CreateGameId();
                // Функция для создания уникального идентификатора

                if (ClientGames[nickname]){ 
                    // Если у пользователя по его нику что-то есть в массиве с играми
                    console.log('Вы уже учавствуете в другой игре');
                    return ws.send(JSON.stringify({ type: 'create_game_error', message: 'Вы уже учавствуете в другой игре' }));
                }


                gamedb.query(query, [currGameId, -1, players_count, -1, bet, players_id, status], (error, results) => {
                    if (error) {
                        console.error('Ошибка добавления в базу данных:', error);
                        return ws.send(JSON.stringify({ type: 'error', message: 'Ошибка добавления в базу данных.' }));
                    } 

                    console.log('Игра добавлена в базу данных', results);
                    ws.send(JSON.stringify({ type: 'success', message: 'Игра успешно создана.' }));

                    ClientGames[nickname] = currGameId;
                    return ws.send(JSON.stringify({ type: 'updateGamesOK'}));
                    // broadcastGamesList();
                });

    // ---                              
            } else if (type === "joinGame") {
                const {type, gameId , nickname} = message;
                if (ClientGames[nickname]){
                    console.log('Вы уже учавствуете в другой игре');
                    return ws.send(JSON.stringify({ type: 'create_game_error', message: 'Вы уже учавствуете в другой игре' }));
                } else {
                    // 1. Извлекаем игру по gameId
                    const query = 'SELECT * FROM cre WHERE id = ?';
                    gamedb.query(query, [gameId], (error, results) => {
                        if (error || results.length === 0) {
                            console.error('Ошибка или игра не найдена:', error);
                            return ws.send(JSON.stringify({ type: 'error', message: 'Ошибка или игра не найдена.' }));
                        }
                
                        let game = results[0];
                        console.log(results);
                        let players_id = game.players_id;
                        let status = game.status;
                        if (status != -1){
                            console.error('Игра заполнена', error);
                            return ws.send(JSON.stringify({ type: 'fill_error', message: 'Игра заполнена' }));
                        }
                
                        // 2. Проверяем, уже ли пользователь в списке
                        if (!players_id.includes(nickname)) {
                            players_id.push(nickname); // Добавляем пользователя
                
                            // 3. Обновляем запись в базе данных
                            const updateQuery = 'UPDATE cre SET players_id = ? WHERE id = ?';
                            gamedb.query(updateQuery, [JSON.stringify(players_id), gameId], (updateError) => {
                                if (updateError) {
                                    console.error('Ошибка обновления игры:', updateError);
                                    return ws.send(JSON.stringify({ type: 'add_error', message: 'Ошибка обновления игры.' }));
                                }

                                console.log(`Пользователь ${nickname} добавлен к игре ${gameId}`);
                                ClientGames[nickname] = gameId; // Устанавливаем текущую игру к нему в массив
                                if (players_id.length === game.players_count) {
                                    checkFullness(gameId);
                                }
                                return ws.send(JSON.stringify({ type: 'updateGamesOK'}));
                                // broadcastGamesList(); // Обновляем список игр для всех пользователей
                            });
                        } else {
                            console.log(`Пользователь ${nickname} уже в игре ${gameId}`);
                            return ws.send(JSON.stringify({ type: 'add_error', message: 'Вы уже в игре' }));
                        }
                    });
                }
    // ---
            } else if (type === "leaveGame") {
                const {type, gameId, nickname} = message;

                const query = 'SELECT * FROM cre WHERE id = ?';
                gamedb.query(query, [gameId], (error, results) => {
                    if (error || results.length === 0) {
                        console.error('Ошибка или игра не найдена:', error);
                        return ws.send(JSON.stringify({ type: 'error', message: 'Ошибка или игра не найдена.' }));
                    }
                    let game = results[0];
                    let players_id = game.players_id;
                    players_id = players_id.filter(playerNickname => playerNickname !== nickname);
                    if (players_id.length === 0){
                        delete ClientGames[nickname];
                        deleteGame(gameId);
                        return;
                    }
                    const updateQuery = 'UPDATE cre SET players_id = ? WHERE id = ?';
                    gamedb.query(updateQuery, [JSON.stringify(players_id), gameId], (updateError) => {
                        if (updateError) {
                            console.error('Ошибка обновления игры:', updateError);
                            return ws.send(JSON.stringify({ type: 'error', message: 'Ошибка обновления игры.' }));
                        }
                        console.log(`Пользователь ${nickname} покинул игру ${gameId}`);
                        delete ClientGames[nickname];
                        return ws.send(JSON.stringify({ type: 'updateGamesOK'}));
                    });

                    // Удаляем игру из ClientGames, если пользователь покинул её
                });
            }
    // ТУТ НАЧИНАЕТСЯ КОД ДЛЯ СТРАНИЧКИ ИГРЫ
            else if (type === "requestRegistration"){
                console.log(GamesWithPlayers)

                const nickname = message.nickname;
                ClientConnections[nickname] = ws;
                const gameId = message.gameId;
                if (!GamesWithPlayers[gameId]) {
                    GamesWithPlayers[gameId] = [];
                }
                if (!GamesWithPlayers[gameId].includes(nickname)){
                    GamesWithPlayers[gameId].push(nickname);
                }
                const check_query = `SELECT * FROM game_cells WHERE id = ?`;

                gamedb.query(check_query, [gameId], function(error,message) {
                    if (error) {
                        console.error('Ошибка при проверке налиия игры:', error);
                    } else {
                        if (message.length === 0){
                            const copyCellsQuery = `
                            INSERT INTO game_cells (id, position, name, cost, data, discription, owner, houses, lay, type)
                            SELECT ?,position, name, cost, data, disctiption, owner, houses,lay,type
                            FROM board
                            ORDER BY position
                            `;
                            gamedb.query(copyCellsQuery, [gameId], function(error,message) {
                                if (error) {
                                    console.error('Ошибка при копировании клеток для новой игры:', error);
                                } else {
                                    console.log('Клетки успешно скопированы для игры ID:', gameId);
                                }
                            });

                        } else{
                            console.log("Такая игра уже есть")
                        }
                        ws.send(JSON.stringify({ type: 'boardReady', gameId: gameId }));
                    }
                });

                const query = 'SELECT * FROM chat_messages WHERE gameId = ? ORDER BY timestamp ASC';
                gamedb.query(query, [gameId], (error, messages) => {
                    if (error) {
                        console.error('Ошибка при извлечении истории сообщений:', error);
                        return;
                    }
                    ws.send(JSON.stringify({ type: 'chatHistory', messages: messages }));
                });


            }  else if (message.type === 'rollDice' && message.gameId) {
                const gameId = message.gameId;
                const color = message.color;
                const nickname = message.nickname;
                const randomValues = generateRandomDiceValues();

                // Передаем результат броска только игрокам текущей игры
                sendToGame(gameId, { type: 'diceRolled', color:color,nickname:nickname, ...randomValues });
                return;
            }


            else if (message.type === "chatMessage") {
                const { gameId, text, nickname} = message;
                // Сохраняем сообщение в базу данных
                const query = 'INSERT INTO chat_messages (gameId, from_nickname, message) VALUES (?, ?, ?)';
                gamedb.query(query, [gameId, nickname, text], (error, results) => {
                    if (error) {
                        console.error('Ошибка при добавлении сообщения в базу данных:', error);
                        return;
                    }
                    // Отправляем сообщение всем участникам игры
                    GamesWithPlayers[gameId].forEach(playerNickname => {
                        if (ClientConnections[playerNickname]) {
                            ClientConnections[playerNickname].send(JSON.stringify({ type: 'chatMessage', text: text, from: nickname }));
                        }
                    });
                });
                const a = 0;
            } else if (message.type === "board_is_ready"){
                console.log('ВЫЗОВ БОАРД ИЗ РЕДИ');
                GamesWithPlayers[message.gameId].forEach(playerNickname => {
                    if (ClientConnections[playerNickname]) {
                        ClientConnections[playerNickname].send(JSON.stringify({ type: 'getTurn'}));
                    }
                });


            } else if (message.type === "DiceResult") {
                const { nickname, color, dice1, dice2, gameId } = message;
                const colors = ['red', 'blue', 'green', 'yellow'].slice(0,GamesWithPlayers[gameId].length);
                
                const currentPlayerColor = color;  // Текущий цвет
                const currentPlayerIndex = colors.indexOf(currentPlayerColor);  // Индекс текущего цвета
                const nextPlayerIndex = (currentPlayerIndex + 1) % colors.length;  // Индекс следующего игрока по модулю длины массива
                const nextPlayerColor = colors[nextPlayerIndex];  // Цвет следующего игрока

            
                const query = 'SELECT player_id, color, is_jail FROM state WHERE turn = 1 AND id = ?';
                gamedb.query(query, [gameId], (error, results, fields) => {
                    if (error) {
                        console.error('Ошибка при выполнении запроса к базе данных:', error);
                        return; // Обработка ошибки базы данных
                    }
            
                    if (results.length === 0) {
                        console.error('Игрок с текущим ходом не найден');
                        return; // Обработка отсутствия активных игроков
                    }
            
                    const currentPlayer = results[0];
                    console.log(currentPlayer)
                    if (currentPlayer.player_id.toString() === nickname) { // Проверьте, что это строковое сравнение, если `player_id` возвращается как число
                        const PlayersNikname  = currentPlayer.player_id.toString();
                        if (currentPlayer.is_jail >= 0) {
                            if (dice1 === dice2) {
                                // Игрок выбросил дубль и выходит из тюрьмы
                                const updateJailStatusQuery = 'UPDATE state SET is_jail = -1 WHERE id = ? AND player_id = ?';
                                gamedb.query(updateJailStatusQuery, [gameId, nickname], (error, results) => {
                                    if (error) {
                                        console.error('Ошибка при обновлении статуса тюрьмы:', error);
                                        
                                    }
                                    const text = `Выбросил ${dice1}:${dice2} и выходит из тюрьмы!`;
                                    sendMessage(text, nickname, gameId);
                                    updateTurn(currentPlayer.color, gameId);
                                    updatePosition(0, 0, gameId, nickname, 'red', 'red');
                                });
                            } else if (currentPlayer.is_jail === 0) {
                                // Игрок пропустил три хода и выходит из тюрьмы
                                const updateJailStatusQuery = 'UPDATE state SET is_jail = -1 WHERE id = ? AND player_id = ?';
                                gamedb.query(updateJailStatusQuery, [gameId, nickname], (error, results) => {
                                    if (error) {
                                        console.error('Ошибка при обновлении статуса тюрьмы:', error);
                                        return;
                                    }
                                    const text = `Выходит из тьюрьмы после трех ходов`;
                                    sendMessage(text, nickname, gameId);
                                    updateTurn(currentPlayer.color, gameId);
                                    updatePosition(0, 0, gameId, nickname, 'red', 'red');
                                });
                            } else if (currentPlayer.is_jail > 0) {
                                // Игрок остаётся в тюрьме
                                const updateJailTurnsQuery = 'UPDATE state SET is_jail = is_jail - 1 WHERE id = ? AND player_id = ?';
                                gamedb.query(updateJailTurnsQuery, [gameId, nickname], (error, results) => {
                                    if (error) {
                                        console.error('Ошибка при обновлении количества ходов в тюрьме:', error);
                                        return;
                                    }
                                    const text = `Остаётся в тюрьме`;
                                    sendMessage(text, nickname, gameId);
                                    updateTurn(nextPlayerColor, gameId);
                                    console.log(nextPlayerColor)
                                    updatePosition(0, 0, gameId, nickname, 'red', 'red');
                                    // console.log(`Игрок ${nickname} остаётся в тюрьме (ходов в тюрьме: ${currentPlayer.jail_turns - 1})`); //chat
                                });
                            }
                        } else {
                            const text = `выбросил ${dice1}:${dice2}`;
                            sendMessage(text, nickname, gameId); // Отправляю сообщение всм клентам игры
                            const diceTotal = dice1 + dice2; // Сумма кубиков
                            updatePosition(dice1,dice2, gameId, nickname, nextPlayerColor, color);
                        }
                    } else {
                        console.error('Не ваш ход!');
                    }
                });
            } else if (message.type === "BuyField") {
                const { position, nickname, gameId } = message;
    
            
                // Запрос для получения цвета игрока, баланса и свойств
                const queryColorBalanceProperties = "SELECT color, balance, properties FROM state WHERE id = ? AND player_id = ?";
                gamedb.query(queryColorBalanceProperties, [gameId, nickname], (error, results) => {
                    if (error) {
                        console.error('Ошибка при извлечении цвета, баланса и свойств:', error);
                        return;
                    }
            
                    if (results.length > 0) {
                        const playerColor = results[0].color;
                        const playerBalance = results[0].balance;
                        let properties = results[0].properties ? results[0].properties : {};
            
                        // Запрос для получения стоимости поля, данных и типа
                        const queryCostData = "SELECT cost, data, type, lay FROM game_cells WHERE id = ? AND position = ?";
                        gamedb.query(queryCostData, [gameId, position], (error, results) => {
                            if (error || results.length === 0) {
                                console.error("Ошибка при извлечении стоимости и данных поля:", error);
                                return;
                            }
            
                            const cost = results[0].cost;
                            const data = results[0].data;
                            const [type, additionalInfo] = results[0].type.split(".");
                            const lay = results[0].lay;
            
                            // Проверка, достаточно ли у игрока денег
                            if (playerBalance >= cost) {
                                const newCost = type === "field" ? data.h0 : 100000 * ((properties["special"] || 0) + 1);
                                const updatePlayerBalance = "UPDATE state SET balance = balance - ? WHERE id = ? AND player_id = ?";
                                const updateFieldOwnerCost = "UPDATE game_cells SET owner = ?, cost = ? WHERE position = ? AND id = ?";
            
                                // Обновляем баланс игрока
                                gamedb.query(updatePlayerBalance, [cost, gameId, nickname], (error) => {
                                    if (error) {
                                        console.error('Ошибка при обновлении баланса игрока:', error);
                                        return;
                                    }
            
                                    // Обновляем владельца поля и стоимость
                                    gamedb.query(updateFieldOwnerCost, [playerColor, newCost, position, gameId], (error) => {
                                        if (error) {
                                            console.error('Ошибка при обновлении владельца поля и стоимости:', error);
                                            return;
                                        }
            
                                        // Обновляем свойства игрока
                                        if (type === "field") {
                                            const color = additionalInfo; // Цвет в формате rgb
                                            properties[color] = (properties[color] || 0) + 1;
                                        } else if (type === "special") {
                                            properties["special"] = (properties["special"] || 0) + 1;
                                        }

                                        checkMonopoly(properties, gameId, additionalInfo, type, position, nickname)
                                            .then(has_monopoly => {
                                                console.log(has_monopoly);
                                                if (has_monopoly) {
                                                    text = 'Приобрел монополию!';
                                                    sendMessage(text, nickname, gameId);
                                                } else {
                                                    const a = 0;
                                                }
                                            })
                                            .catch(error => {
                                                console.error("Ошибка при проверке монополии:", error);
                                            });
                                        const updateProperties = "UPDATE state SET properties = ?, properties_cost = properties_cost + ?, curr_status = ? WHERE id = ? AND player_id = ?";
                                        gamedb.query(updateProperties, [JSON.stringify(properties), lay, "NULL", gameId, nickname], (error) => {
                                            if (error) {
                                                console.error('Ошибка при обновлении свойств игрока:', error);
                                                return;
                                            }
            
                                            console.log(`Поле на позиции ${position} куплено игроком ${nickname} с цветом ${playerColor} и стоимостью ${newCost}`);
            
                                            // Оповещаем всех участников игры о покупке поля
                                            GamesWithPlayers[gameId].forEach(playerNickname => {
                                                if (ClientConnections[playerNickname]) {
                                                    ClientConnections[playerNickname].send(JSON.stringify({
                                                        type: 'fieldBought',
                                                        position: position,
                                                        color: playerColor,
                                                        owner: nickname,
                                                        newCost: newCost // Отправляем новую стоимость
                                                    }));
                                                }
                                            });
                                        });
                                    });
                                });
                            } else {
                                text = "Недостаточно денег для покупки поля";
                                sendMessage(text, nickname, gameId);
                                GamesWithPlayers[gameId].forEach(playerNickname => {
                                    if (ClientConnections[playerNickname]) {
                                        ClientConnections[playerNickname].send(JSON.stringify({
                                            type: 'displayBuyButtonAgain',
                                            position: position,
                                            nickname: nickname,
                                        }));
                                    }
                                });
                                
                            }
                        });
                    } else {
                        console.error('Игрок не найден или цвет не задан');
                    }
                });
            } else if (message.type === "jail!"){

                const gameId = message.gameId;
                const nickname = message.nickname;
                const colorQuery = "SELECT color FROM state WHERE id = ? AND player_id = ?";
                gamedb.query(colorQuery, [gameId, nickname], (error, results) => {
                    if (error) {
                        console.log("Ошибка в 920 строке сервера", error);
                        return;
                    } else {
                        if (results.length > 0) {
                            let color = results[0].color;
                            console.log("Цвет игрока:", color);
                            const query = "UPDATE state SET position = 13, is_jail = 3 WHERE id = ? AND color = ?";
                            gamedb.query(query,[gameId, color], (error)=>{
                                if (error){
                                    console.log("Ошибка в 925 строке сервера", error);
                                    return;
                                } else {
                                    GamesWithPlayers[gameId].forEach(playerNickname => {
                                        if (ClientConnections[playerNickname]) {
                                            ClientConnections[playerNickname].send(JSON.stringify({ 
                                                type: 'jumpJail',
                                                color: color
                                            }));
                                        }
                                    });
                                }
                            })
                        } else {
                            console.log("Цвет не найден");
                        }
                    }
                });
            } else if (message.type === "PayMessage"){// owner - цвет игрока который владеет полем
                const { gameId, position, nickname, cellCost, cellOwner, currentPlayerColor } = message;
                const queryColorBalanceProperties = "SELECT color, balance, properties_cost, position FROM state WHERE id = ? AND player_id = ?";
                gamedb.query(queryColorBalanceProperties, [gameId, nickname], (error, results) => {
                    if (error) {
                        console.error('Ошибка при извлечении цвета, баланса и свойств:', error);
                        return;
                    }
            
                    if (results.length > 0) {
                        const curr_position = results[0].position;
                        // if (curr_position === position){
                        text = `Попал на чужое поле и должен выплатить ${cellCost}`;
                        sendMessage(text, nickname, gameId);
                        // }
                        const playerColor = results[0].color;
                        const playerBalance = results[0].balance;
                        const properties_cost = results[0].properties_cost;
                        if (playerBalance + properties_cost  < cellCost){
                            text = `Проиграл - не может выплатить аренду!`;
                            sendMessage(text, nickname, gameId);
                            GamesWithPlayers[gameId].forEach(playerNickname => {
                                if (ClientConnections[playerNickname]) {
                                    ClientConnections[playerNickname].send(JSON.stringify({ 
                                        type: 'END_GAME',
                                        winner: cellOwner
                                    }));
                                }
                            });
                        }
                        return;
                    }
                });


                GamesWithPlayers[gameId].forEach(playerNickname => {
                    if (ClientConnections[playerNickname]) {
                        ClientConnections[playerNickname].send(JSON.stringify({ 
                            type: 'Pay!',
                            gameId: gameId, 
                            cellOwner: cellOwner,
                            cellCost: cellCost,
                            nickname: nickname
                        }));
                    }
                });
            } else if (message.type === "Payed"){// owner - цвет игрока который владеет полем
                const {cellOwner, cellCost, nickname, gameId} = message;

                // Запрос для получения цвета игрока, баланса и свойств
                const queryColorBalanceProperties = "SELECT color, balance, properties FROM state WHERE id = ? AND player_id = ?";
                gamedb.query(queryColorBalanceProperties, [gameId, nickname], (error, results) => {
                    if (error) {
                        console.error('Ошибка при извлечении цвета, баланса и свойств:', error);
                        return;
                    }
            
                    if (results.length > 0) {
                        const playerColor = results[0].color;
                        const playerBalance = results[0].balance;
                        if (playerBalance >= cellCost ){
                            const getNameWhoOwns = "SELECT player_id FROM state WHERE color = ? AND id = ?";
                            gamedb.query(getNameWhoOwns, [cellOwner, gameId], (error, result) => {
                                if (error){
                                    console.log("Ошибка в функции Payed, 1", error);
                                }
                                const nicknameWhoOwns = result[0].player_id;
                                const ubdateBalance = "UPDATE state SET balance = balance - ? WHERE id = ? AND player_id = ?";
                                gamedb.query(ubdateBalance, [cellCost, gameId, nickname], (error) => {
                                    if (error){
                                        console.log("Ошибка Payed, 2", error);
                                    } else{
                                        gamedb.query(ubdateBalance, [-cellCost, gameId, nicknameWhoOwns], (error) => {
                                            if (error){
                                                console.log("Ошибка Payed, 2", error);
                                            } else{
                                                GamesWithPlayers[gameId].forEach(playerNickname => {
                                                    if (ClientConnections[playerNickname]) {
                                                        ClientConnections[playerNickname].send(JSON.stringify({ 
                                                            type: 'fieldBought'
                                                        }));
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            });
                        } else {
                            text = `Не достаточно средств чтобы выплатить ${cellCost}р, нужно продать имущество!`;
                            sendMessage(text, nickname, gameId);
                            GamesWithPlayers[gameId].forEach(playerNickname => {
                                if (ClientConnections[playerNickname]) {
                                    ClientConnections[playerNickname].send(JSON.stringify({ 
                                        type: 'layProperty',
                                        nickname: nickname
                                    }));
                                }
                            });
                        }
                    } else {
                        console.error('Игрок не найден или цвет не задан');
                    }
                });

            } else if (message.type === "buildHouse"){
                console.log(message);
                const {gameId, position, houses, nickname} = message;
                query = "SELECT * FROM game_cells WHERE id = ? AND position = ?";
                gamedb.query(query, [gameId, position], (error, result) =>{
                    if (error){
                        console.log("ежик", error);
                    }
                    if (result.length > 0){
                        const data = JSON.parse(result[0].data);
                        const {cost} = result[0];

                        const buildCost = data['build'];
                        console.log(buildCost); 
                        let newCost = cost;                   
                        if (houses < 4){
                            console.log(data);
                            newCost = data[`h${houses}`];
                        } else{
                            newCost = data[`hotel`];;
                        }
                        const queryColorBalanceProperties = "SELECT color, balance, properties FROM state WHERE id = ? AND player_id = ?";
                        gamedb.query(queryColorBalanceProperties, [gameId, nickname], (error, results) => {
                            if (error) {
                                console.error('Ошибка при извлечении цвета, баланса и свойств:', error);
                                return;
                            }
                            if (results.length > 0) {
                                const playerColor = results[0].color;
                                const playerBalance = results[0].balance;
                                if (playerBalance >= buildCost){
                                    queryCost = "UPDATE game_cells SET cost = ?, houses = houses + 1 WHERE id = ? AND position = ?";
                                    gamedb.query(queryCost, [newCost, gameId, position], (error, result) =>{
                                        if (error){
                                            console.log('медведь', error);
                                        }
                                        const updateBalance = "UPDATE state SET balance = balance - ? WHERE id = ? AND player_id = ?";
                                        gamedb.query(updateBalance, [buildCost, gameId, nickname], (error)=>{
                                            if (error){
                                                console.log('звяц', error);
                                            }
                                            GamesWithPlayers[gameId].forEach(playerNickname => {
                                                if (ClientConnections[playerNickname]) {
                                                    ClientConnections[playerNickname].send(JSON.stringify({ 
                                                        type: 'House'
                                                    }));
                                                }
                                            });
                                            
                                        });
                                    });
                                }
                            }
                        });
                    }
                });
            } else if (message.type === "layField"){
                const {gameId, position, houses, nickname, prev_buttons} = message;
                if (houses <= 0){
                    const query = "SELECT * FROM game_cells WHERE id = ? AND position = ?";
                    gamedb.query(query, [gameId, position], (error, result) =>{
                        if (error){
                            console.log("Функция layField, ошибка", error);
                        } else if (result.length > 0){
                            const owner = result[0].owner;
                            const cost = result[0].cost;
                            const lay = result[0].lay;
                            const name = result[0].name;
                            const fieldType = result[0].type;
                            const query2 = "UPDATE game_cells SET owner = 'white' WHERE id = ? AND position = ?";
                            gamedb.query(query2, [gameId, position], (error) =>{
                                if (error){
                                    console.log(error);
                                }
                                const query3 = "SELECT properties, position FROM state WHERE id = ? AND player_id = ?";
                                gamedb.query(query3, [gameId, nickname], (error, result2) =>{
                                    if (error){
                                        console.log(error);
                                    } else if (result2.length > 0){

                                        let properties = result2[0].properties;
                                        const key = fieldType.split('.')[1];
                                        if (properties[key] > 1){
                                            properties[key] -= 1;
                                        } else{
                                            delete properties[key];
                                        }

                                        let curr_players_position = result2[0].position;
                                        tmp_query = "SELECT owner, cost FROM game_cells WHERE id = ? AND position = ?";
                                        gamedb.query(tmp_query, [gameId, curr_players_position], (error, result3)=>{
                                            if (error){
                                                console.log(error);
                                            } else if (result3.length > 0){
                                                cell_owner = result3[0].owner;
                                                cell_cost = result3[0].cost;

                                                quety4 = "UPDATE state SET balance = balance + ?, properties_cost = properties_cost - ?, properties = ?, curr_status = ? WHERE id = ? AND player_id = ?";
                                                gamedb.query(quety4, [lay, lay, JSON.stringify(properties), prev_buttons,gameId, nickname], (error) =>{
                                                    if (error){
                                                        console.log(error);    
                                                    }
                                                    console.log('--------------------------------',prev_buttons);
                                                    text = `Продает поле ${name} за ${lay}р, нужны деньги!`;
                                                    sendMessage(text, nickname, gameId);
                                                    GamesWithPlayers[gameId].forEach(playerNickname => {
                                                        if (ClientConnections[playerNickname]) {
                                                            ClientConnections[playerNickname].send(JSON.stringify({ 
                                                                type: 'fieldLayed', 
                                                                cellOwner: cell_owner,
                                                                cellCost: cell_cost,
                                                                prev_buttons:prev_buttons
                                                            }));
                                                        }
                                                    });
                                                });
                                            }
                                        });
                                    }
                                });
                            });
                        }
                    });   
                }
            } else if (message.type === "TaxPay") {
                const { cellOwner, cellCost, nickname, gameId } = message;
                const queryBalance = "SELECT balance FROM state WHERE id = ? AND player_id = ?";
                gamedb.query(queryBalance, [gameId, nickname], (error, results) => {
                    if (error) {
                        console.error('Ошибка при извлечении баланса:', error);
                        return;
                    }
                    if (results.length > 0) {
                        const currentBalance = results[0].balance;
                        const taxAmount = currentBalance * 0.18;
                        const newBalance = currentBalance - taxAmount;
                        const updateBalance = "UPDATE state SET balance = ? WHERE id = ? AND player_id = ?";
                        gamedb.query(updateBalance, [newBalance, gameId, nickname], (error, results) => {
                            if (error) {
                                console.error('Ошибка при обновлении баланса:', error);
                                return;
                            }
                            GamesWithPlayers[gameId].forEach(playerNickname => {
                                if (ClientConnections[playerNickname]) {
                                    ClientConnections[playerNickname].send(JSON.stringify({ 
                                        type: 'fieldBought'
                                    }));
                                }
                            });
                        });
                    } else {
                        console.log('Игрок не найден');
                    }
                });
            }
            
        });


        ws.on('close', () => {
            // Проверяем, есть ли у соединения свойство nickname
            if(ws.nickname) {
                // Используем это свойство для удаления из ClientConnections
                delete ClientConnections[ws.nickname];
                console.log(`Client ${ws.nickname} closed`);
            } else {
                console.log(`An anonymous connection closed`);
            }
        });
    });
}

let ClientIdCounter = 0;
function CreateClientId(){
    ClientIdCounter ++;
    return ClientIdCounter;
}

let GameIdCounter = '';
function CreateGameId(){
    GameIdCounter = uuid(); 
    return GameIdCounter;
}
