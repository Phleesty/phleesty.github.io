document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat');
    const videoIframe = document.getElementById('vk-video');
    let comments = [];
    let displayedComments = new Set();
  
    // Загрузка JSON с комментариями
    fetch('comments.json')
      .then(response => response.json())
      .then(data => {
        comments = data.comments;
      })
      .catch(error => console.error('Ошибка загрузки комментариев:', error));
  
    // Функция для отображения комментариев
    function displayComment(comment) {
      const messageElement = document.createElement('div');
      messageElement.classList.add('chat-message');
  
      const userNameElement = document.createElement('span');
      userNameElement.classList.add('user-name');
      userNameElement.textContent = comment.commenter.display_name + ': ';
      userNameElement.style.color = comment.message.user_color || '#fff';
  
      const messageBodyElement = document.createElement('span');
      messageBodyElement.classList.add('message-body');
      messageBodyElement.textContent = comment.message.body;
  
      messageElement.appendChild(userNameElement);
      messageElement.appendChild(messageBodyElement);
      chatBox.appendChild(messageElement);
  
      // Прокрутка чата вниз
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  
    // Функция для синхронизации комментариев с видео
    function syncComments(currentTime) {
      comments.forEach(comment => {
        const commentTime = comment.content_offset_seconds;
        if (currentTime >= commentTime && !displayedComments.has(comment._id)) {
          displayComment(comment);
          displayedComments.add(comment._id);
        }
      });
    }
  
    // Функция для получения текущего времени видео
    function getCurrentVideoTime() {
      // Используем postMessage для запроса текущего времени у iframe
      videoIframe.contentWindow.postMessage({ type: 'getCurrentTime' }, '*');
    }
  
    // Обработчик сообщений от iframe
    window.addEventListener('message', (event) => {
      if (event.data.type === 'currentTime') {
        const currentTime = event.data.time;
        syncComments(currentTime);
      }
    });
  
    // Запрос текущего времени видео каждые 500 мс
    setInterval(getCurrentVideoTime, 500);
  });
  