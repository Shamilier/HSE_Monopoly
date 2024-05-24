// document.getElementById('loginForm').addEventListener('submit', function(e) {
//     e.preventDefault();
//     const formData = new FormData(this);
//     fetch('/login', { // Убедитесь, что адрес совпадает с серверным маршрутом
//         method: 'POST',
//         body: new URLSearchParams(formData), // Передача данных как URL-encoded form
//     })
//     .then(response => {
//         if (response.ok) {
//             // При успешном входе перенаправляем на страницу login.html
//             // Измените это на /profile.html, если у вас есть страница профиля
//             window.location.href = '/register.html';
//         } else {
//             alert('Login failed');
//         }
//     })
//     .catch(error => console.error('Error:', error));
// });

document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');

    loginForm.addEventListener('submit', function (event) {
        event.preventDefault(); // Предотвращаем стандартное поведение отправки формы

        const formData = {
            email: loginForm.querySelector('input[name="email"]').value,
            password: loginForm.querySelector('input[name="password"]').value,
        };
    
        fetch('/login', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (response.ok) {
                // При успешном входе перенаправляем на страницу login.html
                // Измените это на /profile.html, если у вас есть страница профиля
                window.location.href = "/main_page.html";
            } else {
                alert('Login failed');
            }
        })
        .catch(error => console.error('Error:', error));
    });
});


document.addEventListener('DOMContentLoaded', function () {
    const registerLink = document.getElementById("RegisterLink");
    registerLink.addEventListener("click", function(event) {
        event.preventDefault(); 
        registerLink.style.transform = "scale(1.1)"; 
        setTimeout(function() {
            window.location.href = "register.html"; 
        }, 500); 
    });
});
