let currentTime = 0; // Текущее время в секундах
let lastIndex = 0;   // Индекс последнего отображенного сообщения
let timerId = null;  // ID таймера
let isPaused = false; // Флаг паузы
let emoteMap = {};   // Карта эмоутов: ID -> data URL
let badgeSets = {};  // Карта бейджей: ID -> данные

// Загрузка JSON
fetch('2418600027.json')
    .then(response => response.json())
    .then(data => {
        const comments = data.comments;
        const emotes = data.emotes || [];

        // Создаем карту эмоутов
        emotes.forEach(emote => {
            emoteMap[emote.id] = `data:image/png;base64,${emote.data}`;
        });

        const channelId = data.streamer.id; // ID канала из JSON

        // Загружаем бейджи с Twitch API
        Promise.all([
            fetch('https://badges.twitch.tv/v1/badges/global/display').then(res => res.json()),
            fetch(`https://badges.twitch.tv/v1/badges/channels/${channelId}/display`).then(res => res.json())
        ]).then(([globalBadges, channelBadges]) => {
            badgeSets = { ...globalBadges.badge_sets, ...channelBadges.badge_sets };

            // Обработчики кнопок
            document.getElementById('start').addEventListener('click', () => {
                if (!timerId) {
                    timerId = setInterval(() => {
                        if (!isPaused) {
                            currentTime += 1;
                            displayNewMessages(comments);
                        }
                    }, 1000); // Обновление каждую секунду
                }
            });

            document.getElementById('pause').addEventListener('click', () => {
                isPaused = true;
            });

            document.getElementById('resume').addEventListener('click', () => {
                isPaused = false;
            });
        });
    })
    .catch(error => console.error('Ошибка загрузки:', error));

// Отображение новых сообщений
function displayNewMessages(comments) {
    const chatDiv = document.getElementById('chat');
    while (lastIndex < comments.length && comments[lastIndex].content_offset_seconds <= currentTime) {
        const comment = comments[lastIndex];
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';

        // Бейджи
        comment.message.user_badges.forEach(badge => {
            if (badgeSets[badge._id] && badgeSets[badge._id].versions[badge.version]) {
                const badgeImg = document.createElement('img');
                badgeImg.src = badgeSets[badge._id].versions[badge.version].image_url_1x;
                badgeImg.alt = badge._id;
                badgeImg.style.height = '18px'; // Размер как в Twitch
                messageDiv.appendChild(badgeImg);
            }
        });

        // Ник с цветом
        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'username';
        usernameSpan.style.color = comment.message.user_color || '#ffffff'; // Белый по умолчанию
        usernameSpan.textContent = comment.commenter.display_name + ': ';
        messageDiv.appendChild(usernameSpan);

        // Текст сообщения с эмоутами
        comment.message.fragments.forEach(fragment => {
            if (fragment.emoticon && emoteMap[fragment.emoticon.emoticon_id]) {
                const emoteImg = document.createElement('img');
                emoteImg.src = emoteMap[fragment.emoticon.emoticon_id];
                emoteImg.alt = fragment.text;
                emoteImg.style.height = '24px'; // Размер эмоутов как в Twitch
                messageDiv.appendChild(emoteImg);
            } else {
                const textSpan = document.createElement('span');
                textSpan.textContent = fragment.text;
                messageDiv.appendChild(textSpan);
            }
        });

        chatDiv.appendChild(messageDiv);
        chatDiv.scrollTop = chatDiv.scrollHeight; // Прокрутка вниз
        lastIndex++;
    }
}