document.addEventListener('DOMContentLoaded', async function() {
    // Загрузка данных чата из JSON файла
    let chatData;
    try {
        const response = await fetch('2421184938.json');
        if (!response.ok) {
            throw new Error('Не удалось загрузить файл чата.');
        }
        chatData = await response.json();
        console.log("Чат загружен успешно");
    } catch (error) {
        console.error("Ошибка загрузки чата:", error);
        document.getElementById('chat-messages').innerHTML = '<p class="error">Ошибка загрузки чата</p>';
        return;
    }

    // Карта эмотиконов для быстрого доступа
    const emoticons = {};
    if (chatData.emotes) {
        chatData.emotes.forEach(emote => {
            emoticons[emote.id] = emote;
        });
    }

    // Карта бейджей для быстрого доступа
    const badges = {};
    if (chatData.badges) {
        chatData.badges.forEach(badge => {
            if (!badges[badge._id]) {
                badges[badge._id] = {};
            }
            badges[badge._id][badge.version] = badge;
        });
    }

    // Сортируем сообщения по времени
    const sortedComments = chatData.comments.sort((a, b) => 
        a.content_offset_seconds - b.content_offset_seconds
    );

    // Функция для форматирования времени в формат ЧЧ:ММ:СС
    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h > 0 ? h + ':' : ''}${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    }

    // Функция для обработки сообщения чата
    function processMessage(comment) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.dataset.time = comment.content_offset_seconds;

        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = formatTime(comment.content_offset_seconds);
        messageDiv.appendChild(timestamp);

        if (comment.message.user_badges && comment.message.user_badges.length > 0) {
            comment.message.user_badges.forEach(badge => {
                const badgeImg = document.createElement('img');
                badgeImg.className = 'badge';
                if (badges[badge._id] && badges[badge._id][badge.version]) {
                    badgeImg.src = badges[badge._id][badge.version].image_url_1x;
                    badgeImg.alt = badge._id;
                    badgeImg.title = badge._id;
                    badgeImg.width = 18;
                    badgeImg.height = 18;
                    messageDiv.appendChild(badgeImg);
                }
            });
        }

        const username = document.createElement('span');
        username.className = 'username';
        username.textContent = comment.commenter.display_name;
        if (comment.message.user_color) {
            username.style.color = comment.message.user_color;
        }
        messageDiv.appendChild(username);

        const colon = document.createElement('span');
        colon.textContent = ': ';
        messageDiv.appendChild(colon);

        const messageContent = document.createElement('span');
        messageContent.className = 'message-content';

        if (comment.message.fragments) {
            comment.message.fragments.forEach(fragment => {
                if (fragment.emoticon) {
                    const emote = document.createElement('img');
                    emote.className = 'emote';
                    const emoteId = fragment.emoticon.emoticon_id;
                    if (emoticons[emoteId]) {
                        emote.src = emoticons[emoteId].url || `https://static-cdn.jtvnw.net/emoticons/v1/${emoteId}/1.0`;
                    } else {
                        emote.src = `https://static-cdn.jtvnw.net/emoticons/v1/${emoteId}/1.0`;
                    }
                    emote.alt = fragment.text;
                    emote.title = fragment.text;
                    messageContent.appendChild(emote);
                } else {
                    messageContent.appendChild(document.createTextNode(fragment.text));
                }
            });
        } else {
            messageContent.textContent = comment.message.body;
        }

        messageDiv.appendChild(messageContent);
        return messageDiv;
    }

    let currentVideoTime = 0;
    let isPlaying = false;

    // Функция для отображения последних 100 сообщений до текущего времени
    function showMessagesUpToTime(timeInSeconds) {
        const chatMessages = document.getElementById('chat-messages');

        // Находим индекс первого сообщения, которое еще не должно быть показано
        const index = sortedComments.findIndex(comment => comment.content_offset_seconds > timeInSeconds);
        const messagesToShow = sortedComments.slice(Math.max(0, index - 100), index);

        // Очищаем чат
        chatMessages.innerHTML = '';

        // Добавляем последние 100 сообщений
        messagesToShow.forEach(comment => {
            const messageDiv = processMessage(comment);
            chatMessages.appendChild(messageDiv);
        });

        // Прокручиваем чат вниз
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Инициализация VideoPlayer API ВКонтакте
    let player;
    let playerInitialized = false;

    function initVideoPlayer() {
        try {
            // Проверяем, доступен ли VK объект
            if (typeof VK === 'undefined') {
                throw new Error('API ВКонтакте не загрузилось. Проверьте настройки безопасности браузера.');
            }

            const iframe = document.getElementById('vk-player');
            player = VK.VideoPlayer(iframe);

            player.on(VK.VideoPlayer.Events.INITED, function(state) {
                console.log('Плеер инициализирован', state);
                playerInitialized = true;
                updateTime();
            });

            player.on(VK.VideoPlayer.Events.TIMEUPDATE, function(state) {
                if (isPlaying) {
                    currentVideoTime = state.time;
                    showMessagesUpToTime(currentVideoTime);
                }
            });

            player.on(VK.VideoPlayer.Events.STARTED, function(state) {
                isPlaying = true;
            });

            player.on(VK.VideoPlayer.Events.PAUSED, function(state) {
                isPlaying = false;
            });

            player.on(VK.VideoPlayer.Events.RESUMED, function(state) {
                isPlaying = true;
            });

            player.on(VK.VideoPlayer.Events.ERROR, function(state) {
                console.error('Ошибка воспроизведения', state);
            });

        } catch (error) {
            console.error('Ошибка инициализации плеера:', error);
            // Выводим предупреждение в интерфейсе
            const chatMessages = document.getElementById('chat-messages');
            chatMessages.innerHTML = '<p class="error">Не удалось загрузить плеер ВКонтакте. Проверьте настройки безопасности браузера или отключите блокировку сторонних скриптов.</p>';
        }
    }

    // Функция обновления времени
    function updateTime() {
        if (playerInitialized) {
            try {
                currentVideoTime = player.getCurrentTime();
                showMessagesUpToTime(currentVideoTime);
            } catch (error) {
                console.error('Ошибка при получении текущего времени:', error);
            }
        }
    }

    // Функция для перемотки видео
    function seekToTime(seconds) {
        if (playerInitialized) {
            try {
                player.seek(seconds);
                currentVideoTime = seconds;
                showMessagesUpToTime(currentVideoTime);
            } catch (error) {
                console.error('Ошибка при перемотке видео:', error);
            }
        }
    }

    // Инициализируем плеер
    initVideoPlayer();

    // Обработчик клика по сообщениям для перемотки
    document.getElementById('chat-messages').addEventListener('click', function(event) {
        const chatMessage = event.target.closest('.chat-message');
        if (chatMessage && chatMessage.dataset.time) {
            const timeToSeek = parseFloat(chatMessage.dataset.time);
            seekToTime(timeToSeek);
        }
    });
});