# HSE Monopoly

HSE Monopoly - это веб-приложение для игры в монополию, созданное специально для студентов Высшей школы экономики. Проект включает в себя серверную и клиентскую части, которые обеспечивают игровой процесс и взаимодействие с пользователем.

## Основные файлы и директории

### Корневая директория проекта

- `.env` - файл для хранения переменных окружения.
- `Dockerfile` - файл для сборки Docker-контейнера.
- `package.json` - файл с описанием зависимостей проекта и скриптов для управления проектом.
- `package-lock.json` - автоматически сгенерированный файл, который фиксирует версии установленных npm-зависимостей.
- `railway.json` - конфигурационный файл для деплоя проекта на платформу Railway.

### Директория `client`

Содержит клиентскую часть приложения.

- `css/` - директория со стилями CSS.
  - `main_page.css` - стили для главной страницы.
  - `game.css` - стили для игровой страницы.

- `images/` - директория с изображениями, используемыми в проекте.
  - `default_photo.jpg` - изображение профиля по умолчанию.
  - `hse_logo.png` - логотип ВШЭ.
  - другие изображения используемые в проекте.

- `js/` - директория с JavaScript файлами.
  - `main_page.js` - скрипты для главной страницы.
  - `game.js` - скрипты для игровой страницы.

- `favicon.ico` - иконка для вкладки браузера.
- `game.html` - HTML-файл для игровой страницы.
- `login.html` - HTML-файл для страницы входа.
- `main_page.html` - HTML-файл для главной страницы.
- `register.html` - HTML-файл для страницы регистрации.
- другие HTML файлы используемые в проекте.

### Директория `server`

Содержит серверную часть приложения.

- `server.cjs` - основной серверный файл, написанный на CommonJS, обрабатывает запросы к серверу и взаимодействие с базой данных.

## Установка и запуск

### С использованием Docker

1. Клонируйте репозиторий:
   ```sh
   git clone https://github.com/Shamilier/HSE_Monopoly.git
   cd HSE_Monopoly
