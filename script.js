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

    // Карты эмотиконов и бейджей
    const emoticons = {};
    if (chatData.emotes) {
        chatData.emotes.forEach(emote => {
            emoticons[emote.id] = emote;
        });
    }
    const badges = {};
    if (chatData.badges) {
        chatData.badges.forEach(badge => {
            if (!badges[badge._id]) {
                badges[badge._id] = {};
            }
            badges[badge._id][badge.version] = badge;
        });
    }

    // Сортировка сообщений по времени (по возрастанию)
    const sortedComments = chatData.comments.sort((a, b) =>
        a.content_offset_seconds - b.content_offset_seconds
    );

    // Функция форматирования времени в формат ЧЧ:ММ:СС
    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h > 0 ? h + ':' : ''}${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    }

    // Функция создания элемента сообщения
    function processMessage(comment) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.dataset.time = comment.content_offset_seconds;

        // Создадим элемент времени и добавим его в сообщение
        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = formatTime(comment.content_offset_seconds);
        // Запишем время также в data-атрибуте для прямого использования
        timestamp.dataset.time = comment.content_offset_seconds;
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
                    emote.src = (emoticons[emoteId] && emoticons[emoteId].url) 
                        ? emoticons[emoteId].url 
                        : `https://static-cdn.jtvnw.net/emoticons/v1/${emoteId}/1.0`;
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
    let isAutoScrolling = true;
    const autoScrollButton = document.getElementById('auto-scroll-button');
    const chatMessages = document.getElementById('chat-messages');
    let isUserScrolling = false;
    const lastMessageTime = sortedComments.length 
        ? sortedComments[sortedComments.length - 1].content_offset_seconds 
        : 0;
    
    // Счётчик отображённых сообщений
    let messageIndex = 0;

    // Функция управления автоскроллом
    function manageAutoScroll() {
        if (isAutoScrolling) {
            autoScrollButton.classList.remove('show');
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } else {
            autoScrollButton.classList.add('show');
        }
    }

    // Обновление сообщений чата.
    // При перемотке (isSeek = true) происходит полный ререндер.
    function updateChatMessages(timeInSeconds, isSeek = false) {
        if (isSeek) {
            chatMessages.innerHTML = '';
            let newIndex = sortedComments.findIndex(comment => comment.content_offset_seconds > timeInSeconds);
            if (newIndex === -1) newIndex = sortedComments.length;
            messageIndex = newIndex;
            for (let i = 0; i < messageIndex; i++) {
                chatMessages.appendChild(processMessage(sortedComments[i]));
            }
        } else {
            while (messageIndex < sortedComments.length &&
                   sortedComments[messageIndex].content_offset_seconds <= timeInSeconds) {
                chatMessages.appendChild(processMessage(sortedComments[messageIndex]));
                messageIndex++;
            }
        }
        if (isAutoScrolling) {
            manageAutoScroll();
        }
    }

    // Инициализация плеера ВКонтакте
    let player;
    let playerInitialized = false;
    function initVideoPlayer() {
        try {
            if (typeof VK === 'undefined') {
                throw new Error('API ВКонтакте не загрузилось.');
            }
            const iframe = document.getElementById('vk-player');
            player = VK.VideoPlayer(iframe);

            player.on(VK.VideoPlayer.Events.INITED, function(state) {
                console.log('Плеер инициализирован', state);
                playerInitialized = true;
                try {
                    player.play();
                } catch (e) {
                    console.warn('Автозапуск не удался:', e);
                }
                updateChatMessages(player.getCurrentTime(), true);
                isAutoScrolling = true;
                manageAutoScroll();
            });

            player.on(VK.VideoPlayer.Events.TIMEUPDATE, function(state) {
                const jumpThreshold = 5;
                if (Math.abs(state.time - currentVideoTime) > jumpThreshold) {
                    isAutoScrolling = true;
                    isUserScrolling = false;
                    updateChatMessages(state.time, true);
                } else {
                    updateChatMessages(state.time, false);
                }
                currentVideoTime = state.time;
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
            chatMessages.innerHTML = '<p class="error">Не удалось загрузить плеер ВКонтакте.</p>';
        }
    }

    // Функция перемотки видео
    function seekToTime(seconds) {
        if (playerInitialized) {
            try {
                player.seek(seconds);
                currentVideoTime = seconds;
                isUserScrolling = false;
                isAutoScrolling = true;
                updateChatMessages(seconds, true);
                manageAutoScroll();
            } catch (error) {
                console.error('Ошибка при перемотке видео:', error);
            }
        }
    }

    initVideoPlayer();

    // Обработка события скролла: если пользователь вручную прокручивает чат,
    // отключается автоскролл (если не у самого низа)
    chatMessages.addEventListener('scroll', () => {
        isUserScrolling = true;
        const isAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 1;
        isAutoScrolling = isAtBottom;
        manageAutoScroll();
        setTimeout(() => { isUserScrolling = false; }, 100);
    });

    // Восстанавливаем функционал перехода к таймингу видео: при клике на элемент времени
    chatMessages.addEventListener('click', (e) => {
        if (e.target.classList.contains('timestamp')) {
            const time = parseFloat(e.target.dataset.time);
            if (!isNaN(time)) {
                seekToTime(time);
            }
        }
    });

    // Обработчик для кнопки авто-прокрутки
    autoScrollButton.addEventListener('click', () => {
        isAutoScrolling = true;
        updateChatMessages(currentVideoTime, true);
        manageAutoScroll();
    });
});
