document.addEventListener('DOMContentLoaded', async () => {
    const MAX_MESSAGES = 100;
    const TIME_WINDOW = 30;
    let player = null;
    let chatData = null;
    let currentMessages = [];
    let lastUpdateTime = -1;

    // Загрузка данных чата
    try {
        const response = await fetch('2421184938.json');
        if (!response.ok) throw new Error('Ошибка загрузки чата');
        chatData = await response.json();
        chatData.comments.sort((a, b) => a.content_offset_seconds - b.content_offset_seconds);
    } catch (error) {
        console.error('Ошибка чата:', error);
        document.getElementById('chat-messages').innerHTML = '<div class="error">Ошибка загрузки чата</div>';
        return;
    }

    // Инициализация плеера
    const initPlayer = () => {
        try {
            player = VK.VideoPlayer(document.getElementById('vk-player'));
            player.on(VK.VideoPlayer.Events.TIMEUPDATE, updateChat);
            player.on(VK.VideoPlayer.Events.ERROR, () => startFallback());
            console.log('VK плеер инициализирован');
        } catch (error) {
            console.warn('Ошибка VK плеера, используется fallback');
            startFallback();
        }
    };

    // Fallback таймер
    const startFallback = () => {
        let fakeTime = 0;
        setInterval(() => {
            fakeTime += 0.5;
            updateChat({ time: fakeTime });
        }, 500);
    };

    // Основная функция обновления чата
    const updateChat = ({ time }) => {
        if (Math.abs(time - lastUpdateTime) < 0.5) return;
        lastUpdateTime = time;

        const startTime = Math.max(0, time - TIME_WINDOW);
        const endTime = time + TIME_WINDOW;
        
        // Бинарный поиск для оптимизации
        const findIndex = (target) => {
            let low = 0, high = chatData.comments.length;
            while (low < high) {
                const mid = (low + high) >>> 1;
                if (chatData.comments[mid].content_offset_seconds < target) low = mid + 1;
                else high = mid;
            }
            return low;
        };

        const startIdx = findIndex(startTime);
        const endIdx = findIndex(endTime);
        const newMessages = chatData.comments.slice(startIdx, endIdx).slice(-MAX_MESSAGES);

        if (JSON.stringify(newMessages) === JSON.stringify(currentMessages)) return;
        currentMessages = newMessages;

        renderMessages(newMessages);
    };

    // Рендер сообщений
    const renderMessages = (messages) => {
        const fragment = document.createDocumentFragment();
        const chatContainer = document.getElementById('chat-messages');
        
        messages.forEach(comment => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message';
            messageDiv.dataset.time = comment.content_offset_seconds;
            
            // Бейджи
            const badgesDiv = document.createElement('div');
            badgesDiv.className = 'chat-badges';
            if (comment.message.user_badges) {
                comment.message.user_badges.forEach(badge => {
                    const badgeData = chatData.badges?.find(b => b.name === badge._id);
                    if (badgeData?.versions?.[badge.version]) {
                        const img = document.createElement('img');
                        img.src = badgeData.versions[badge.version].image_url_1x;
                        img.className = 'chat-badge';
                        badgesDiv.appendChild(img);
                    }
                });
            }

            // Имя пользователя
            const userSpan = document.createElement('span');
            userSpan.className = 'chat-user';
            userSpan.style.color = comment.message.user_color || '#fff';
            userSpan.textContent = comment.commenter.display_name;

            // Контент сообщения
            const contentDiv = document.createElement('div');
            contentDiv.className = 'chat-content';
            comment.message.fragments?.forEach(fragment => {
                if (fragment.emoticon) {
                    const emoteData = chatData.emotes?.find(e => e.id === fragment.emoticon.emoticon_id);
                    if (emoteData) {
                        const img = document.createElement('img');
                        img.src = emoteData.data ? `data:image/png;base64,${emoteData.data}` : emoteData.url;
                        img.className = 'chat-emote';
                        contentDiv.appendChild(img);
                    }
                } else {
                    contentDiv.appendChild(document.createTextNode(fragment.text));
                }
            });

            // Сборка элементов
            messageDiv.append(badgesDiv, userSpan, contentDiv);
            fragment.appendChild(messageDiv);
        });

        chatContainer.innerHTML = '';
        chatContainer.appendChild(fragment);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    // Обработчик клика для перемотки
    document.getElementById('chat-messages').addEventListener('click', (e) => {
        const messageDiv = e.target.closest('.chat-message');
        if (messageDiv && player) {
            player.seek(parseFloat(messageDiv.dataset.time));
        }
    });

    // Инициализация
    if (typeof VK !== 'undefined') {
        initPlayer();
    } else {
        console.warn('VK API не загружен, используется fallback');
        startFallback();
    }
});