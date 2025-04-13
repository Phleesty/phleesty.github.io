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

    // Карта стандартных Twitch-эмодзи
    const emoticons = {};
    if (chatData.emotes) {
        chatData.emotes.forEach(emote => {
            emoticons[emote.id] = emote;
        });
    }

    // Карта стандартных бейджей
    const badges = {};
    if (chatData.badges) {
        chatData.badges.forEach(badge => {
            if (!badges[badge._id]) {
                badges[badge._id] = {};
            }
            badges[badge._id][badge.version] = badge;
        });
    }

    // Сортировка сообщений по времени
    const sortedComments = chatData.comments.sort((a, b) =>
        a.content_offset_seconds - b.content_offset_seconds
    );

    // Функция форматирования времени
    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h > 0 ? h + ':' : ''}${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    }

    // Построение карты кастомных эмодзи (7TV, BTTV, FFZ) из embeddedData
    const customEmotes = {};
    if (chatData.embeddedData) {
        if (chatData.embeddedData.thirdParty) {
            chatData.embeddedData.thirdParty.forEach(emote => {
                if (emote.name) {
                    customEmotes[emote.name] = emote;
                }
            });
        }
        if (chatData.embeddedData.firstParty) {
            chatData.embeddedData.firstParty.forEach(emote => {
                if (emote.id) {
                    customEmotes[emote.id] = emote;
                }
            });
        }
    }

    // Построение карты кастомных бейджей из embeddedData.twitchBadges
    const customBadges = {};
    if (chatData.embeddedData && chatData.embeddedData.twitchBadges) {
         chatData.embeddedData.twitchBadges.forEach(badge => {
            customBadges[badge.name] = badge;
         });
    }

    // Функция создания элемента сообщения с обработкой бейджей и смайликов
    function processMessage(comment) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.dataset.time = comment.content_offset_seconds;

        // Элемент времени (timestamp) – клик по нему перематывает видео
        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = formatTime(comment.content_offset_seconds);
        timestamp.dataset.time = comment.content_offset_seconds;
        messageDiv.appendChild(timestamp);

        // Обработка бейджей пользователя
        if (comment.message.user_badges && comment.message.user_badges.length > 0) {
            comment.message.user_badges.forEach(badge => {
                const badgeImg = document.createElement('img');
                badgeImg.className = 'badge';
                let badgeImageSrc = null;
                if (customBadges[badge._id] && customBadges[badge._id].versions[badge.version]) {
                    badgeImageSrc = customBadges[badge._id].versions[badge.version].bytes;
                } else if (badges[badge._id] && badges[badge._id][badge.version]) {
                    badgeImageSrc = badges[badge._id][badge.version].image_url_1x;
                }
                if (badgeImageSrc) {
                    // Формируем data URL из base64 строки
                    badgeImg.src = "data:image/png;base64," + badgeImageSrc;
                    badgeImg.alt = badge._id;
                    badgeImg.title = badge._id;
                    badgeImg.width = 18;
                    badgeImg.height = 18;
                    messageDiv.appendChild(badgeImg);
                }
            });
        }

        // Имя пользователя
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

        // Контейнер для текста сообщения
        const messageContent = document.createElement('span');
        messageContent.className = 'message-content';

        // Обработка фрагментов сообщения
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
                    // Если текст фрагмента совпадает с именем кастомного эмодзи – выводим картинку
                    if (customEmotes[fragment.text]) {
                        const emote = document.createElement('img');
                        emote.className = 'emote';
                        emote.src = "data:image/png;base64," + customEmotes[fragment.text].data;
                        emote.alt = fragment.text;
                        emote.title = fragment.text;
                        if (customEmotes[fragment.text].width) {
                            emote.style.width = customEmotes[fragment.text].width + 'px';
                        }
                        if (customEmotes[fragment.text].height) {
                            emote.style.height = customEmotes[fragment.text].height + 'px';
                        }
                        messageContent.appendChild(emote);
                    } else {
                        messageContent.appendChild(document.createTextNode(fragment.text));
                    }
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
    const lastMessageTime = sortedComments.length ? sortedComments[sortedComments.length - 1].content_offset_seconds : 0;
    
    // Счетчик отображенных сообщений
    let messageIndex = 0;

    function manageAutoScroll() {
        if (isAutoScrolling) {
            autoScrollButton.classList.remove('show');
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } else {
            autoScrollButton.classList.add('show');
        }
    }

    // Обновление сообщений чата: isSeek === true означает полный ререндер (например, при перемотке)
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

    // Функция перемотки видео (по клику на timestamp)
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

    // Обработка скролла чата
    chatMessages.addEventListener('scroll', () => {
        isUserScrolling = true;
        const isAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 1;
        isAutoScrolling = isAtBottom;
        manageAutoScroll();
        setTimeout(() => { isUserScrolling = false; }, 100);
    });

    // Обработчик клика по timestamp – перематываем видео к указанному времени
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
