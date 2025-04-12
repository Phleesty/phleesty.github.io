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

    // Сортируем сообщения по времени (по возрастанию)
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

    // Функция для создания элемента сообщения
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
    let isAutoScrolling = true;
    const autoScrollButton = document.getElementById('auto-scroll-button');
    const chatMessages = document.getElementById('chat-messages');
    let isUserScrolling = false;
    const lastMessageTime = sortedComments.length > 0 ? sortedComments[sortedComments.length - 1].content_offset_seconds : 0;
    
    // Переменная для отслеживания текущего индекса загруженных сообщений
    let messageIndex = 0;

    // Функция для управления автопрокруткой
    function manageAutoScroll() {
        if (isAutoScrolling) {
            autoScrollButton.style.display = 'none';
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } else {
            autoScrollButton.style.display = 'block';
        }
    }

    // Функция обновления сообщений чата
    // isSeek = true означает полный ререндер (например, при перемотке)
    function updateChatMessages(timeInSeconds, isSeek = false) {
        if (isSeek) {
            chatMessages.innerHTML = '';
            let newIndex = sortedComments.findIndex(comment => comment.content_offset_seconds > timeInSeconds);
            if (newIndex === -1) {
                newIndex = sortedComments.length;
            }
            messageIndex = newIndex;
            for (let i = 0; i < messageIndex; i++) {
                const msgElement = processMessage(sortedComments[i]);
                chatMessages.appendChild(msgElement);
            }
        } else {
            while (messageIndex < sortedComments.length &&
                   sortedComments[messageIndex].content_offset_seconds <= timeInSeconds) {
                const msgElement = processMessage(sortedComments[messageIndex]);
                chatMessages.appendChild(msgElement);
                messageIndex++;
            }
        }
        if (isAutoScrolling) {
            manageAutoScroll();
        }
    }

    // Инициализация VideoPlayer API ВКонтакте
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
                // Автовоспроизведение видео
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
                const jumpThreshold = 5; // порог для определения перемотки
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

    // Функция для перемотки видео
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

    chatMessages.addEventListener('scroll', () => {
        isUserScrolling = true;
        const isAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 1;
        isAutoScrolling = isAtBottom;
        manageAutoScroll();
        setTimeout(() => {
            isUserScrolling = false;
        }, 100);
    });

    chatMessages.addEventListener('click', function(event) {
        const chatMessage = event.target.closest('.chat-message');
        if (chatMessage && chatMessage.dataset.time) {
            const timeToSeek = parseFloat(chatMessage.dataset.time);
            seekToTime(timeToSeek);
        }
    });

    autoScrollButton.addEventListener('click', () => {
        isAutoScrolling = true;
        updateChatMessages(currentVideoTime, true);
        manageAutoScroll();
    });
});
