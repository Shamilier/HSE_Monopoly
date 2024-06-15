# Используем базовый образ Node.js
FROM node:14

# Создаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальной код приложения
COPY . .

# Открываем порт
EXPOSE 3000

# Запуск приложения
CMD ["node", "server/server.cjs"]
