document.addEventListener('DOMContentLoaded', async function() {
    // Конфигурация видео ВК
    // Указываем ID владельца и ID видео из вашей iframe-ссылки
    const owner_id = -181822274;
    const video_id = 456239297;
    
    // Загрузка данных чата из JSON файла
    let chatData;
    try {
        const response = await fetch('2418600027.json');
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
    
    // Если в JSON-файле есть эмотиконы, обрабатываем их
    if (chatData.emotes) {
        chatData.emotes.forEach(emote => {
            emoticons[emote.id] = emote;
        });
    }
    
    // Карта бейджей для быстрого доступа
    const badges = {};
    
    // Если в JSON есть бейджи, обрабатываем их
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
        
        // Добавляем временную метку
        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = formatTime(comment.content_offset_seconds);
        messageDiv.appendChild(timestamp);
        
        // Добавляем бейджи пользователя
        if (comment.message.user_badges && comment.message.user_badges.length > 0) {
            comment.message.user_badges.forEach(badge => {
                const badgeImg = document.createElement('img');
                badgeImg.className = 'badge';
                // Проверяем, есть ли бейдж в нашей карте
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
        
        // Добавляем имя пользователя с цветом
        const username = document.createElement('span');
        username.className = 'username';
        username.textContent = comment.commenter.display_name;
        if (comment.message.user_color) {
            username.style.color = comment.message.user_color;
        }
        messageDiv.appendChild(username);
        
        // Добавляем текст сообщения
        const messageContent = document.createElement('span');
        messageContent.className = 'message-content';
        
        // Обрабатываем фрагменты сообщения (текст и эмоциконы)
        if (comment.message.fragments) {
            comment.message.fragments.forEach(fragment => {
                if (fragment.emoticon) {
                    // Это эмоцикон
                    const emote = document.createElement('img');
                    emote.className = 'emote';
                    
                    // Проверяем, есть ли эмоцикон в нашей карте или ищем в основном объекте
                    const emoteId = fragment.emoticon.emoticon_id;
                    if (emoticons[emoteId]) {
                        emote.src = emoticons[emoteId].url || `https://static-cdn.jtvnw.net/emoticons/v1/${emoteId}/1.0`;
                    } else {
                        // Если не нашли в карте, используем стандартный URL Twitch для эмоциконов
                        emote.src = `https://static-cdn.jtvnw.net/emoticons/v1/${emoteId}/1.0`;
                    }
                    
                    emote.alt = fragment.text;
                    emote.title = fragment.text;
                    messageContent.appendChild(emote);
                } else {
                    // Обычный текст
                    messageContent.appendChild(document.createTextNode(fragment.text));
                }
            });
        } else {
            // Если фрагментов нет, просто добавляем текст сообщения
            messageContent.textContent = comment.message.body;
        }
        
        messageDiv.appendChild(messageContent);
        return messageDiv;
    }
    
    // Инициализация плеера ВК
    let player;
    let currentVideoTime = 0;
    let lastShownMessageTime = -1;
    
    // Функция для отображения сообщений до определенного времени
    function showMessagesUpToTime(timeInSeconds) {
        // Если время не изменилось, ничего не делаем
        if (timeInSeconds === lastShownMessageTime) return;
        
        const chatMessages = document.getElementById('chat-messages');
        
        // Очищаем чат, если перемотали назад
        if (timeInSeconds < lastShownMessageTime) {
            chatMessages.innerHTML = '';
            lastShownMessageTime = -1;
        }
        
        // Показываем сообщения до текущего времени видео
        sortedComments.forEach(comment => {
            const messageTime = comment.content_offset_seconds;
            
            // Если сообщение должно быть показано и оно еще не было показано
            if (messageTime <= timeInSeconds && messageTime > lastShownMessageTime) {
                const messageDiv = processMessage(comment);
                chatMessages.appendChild(messageDiv);
                
                // Прокручиваем чат вниз при добавлении новых сообщений
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        });
        
        lastShownMessageTime = timeInSeconds;
    }
    
    // Инициализация VK API
    VK.init({
        apiId: 53407736 // Здесь нужно указать ваш API ID, который можно получить в настройках приложения VK
    });
    
    // Функция для инициализации видеоплеера ВК
    function initPlayer() {
        player = VK.Widgets.Video('vk-player', {
            width: '100%',
            height: '100%'
        }, `${owner_id}_${video_id}`);
        
        // Для мониторинга текущего времени видео используем setInterval
        // поскольку VK API не предоставляет полноценных колбэков для отслеживания времени
        const videoTimeTracker = setInterval(function() {
            // Если мы смогли получить плеер VK
            if (document.querySelector('iframe#vk-player_iframe')) {
                const iframe = document.querySelector('iframe#vk-player_iframe');
                
                // Отправляем сообщение плееру VK для получения текущего времени
                iframe.contentWindow.postMessage({
                    method: 'getCurrentTime'
                }, '*');
            }
        }, 1000); // Проверяем каждую секунду
        
        // Слушаем сообщения от iframe для получения текущего времени видео
        window.addEventListener('message', function(event) {
            // Проверяем, что сообщение от плеера VK и содержит время
            if (event.data && typeof event.data === 'object' && event.data.event === 'getCurrentTime') {
                currentVideoTime = event.data.time;
                showMessagesUpToTime(currentVideoTime);
            }
        });
    }
    
    // Инициализируем плеер после загрузки VK API
    initPlayer();
});
