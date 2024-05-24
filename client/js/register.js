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



function Strength(password){
    let i = 0;
    if (password.length > 4) {
        i++;
    }
    if (password.length >= 6){
        i++;
    }
    if (password.length >= 10){
        i++;
    }
    if (/[A-Z]/.test(password)){
        i++;
    }
    if (/[0-9]/.test(password)){
        i++;
    }
    return i
}
const loginLink = document.getElementById("loginLink");
loginLink.addEventListener("click", function(event) {
    event.preventDefault(); 
    loginLink.style.transform = "scale(1.1)"; 
    setTimeout(function() {
        window.location.href = "login.html"; 
    }, 500); 
});

const ForgetLink = document.getElementById("ForgetLink");
ForgetLink.addEventListener("click", function(event) {
    event.preventDefault(); 
    ForgetLink.style.transform = "scale(1.1)"; 
    setTimeout(function() {
        window.location.href = "/login.html"; 
    }, 500); 
});


let container = document.querySelector(".password-container");
document.addEventListener("keyup", function (e) {
    let password = document.querySelector("#YourPassword").value;
    let strength = Strength(password)
    if (strength <= 2) {
        container.classList.add("weak");
        container.classList.remove("moderate");
        container.classList.remove("strong");
    } else if (strength >= 2 && strength <= 4){
        container.classList.remove("weak");
        container.classList.add("moderate");
        container.classList.remove("strong");
    } else {
        container.classList.remove("weak");
        container.classList.remove("moderate");
        container.classList.add("strong");
    }
});

document.addEventListener('DOMContentLoaded', function () {
    const showButton = document.querySelector('.show');
    const passwordInput = document.getElementById('YourPassword');
    const icon = showButton.querySelector('.fas');

    showButton.addEventListener('click', function () {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        icon.classList.toggle('fa-eye-slash');
        icon.classList.toggle('fa-eye');
    });
});


document.addEventListener('DOMContentLoaded', function () {
    const registrationForm = document.getElementById('registrationForm');

    registrationForm.addEventListener('submit', function (event) {
        event.preventDefault(); // Предотвращаем стандартное поведение отправки формы

        const formData = {
            email: registrationForm.querySelector('input[name="email"]').value,
            nickname: registrationForm.querySelector('input[name="nickname"]').value,
            password: registrationForm.querySelector('input[name="password"]').value,
        };

        fetch('/register', { // Отправляем данные на сервер
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            console.log(response);
            if (response.ok) {
                // Успешная регистрация, перенаправляем на страницу входа
                window.location.href = "/login.html"; // Перенаправление на страницу входа
            } else {
                // Обработка различных ответов от сервера
                return response.text();
            }
        })
        .then(text => {
            // Выводим текст ответа сервера в консоль для отладки
            alert(text);
        })
        .catch(error => {
            console.error('Error during registration:', error);
        });
    });
});
