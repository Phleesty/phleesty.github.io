document.addEventListener('DOMContentLoaded', async function() {
    // Загрузка данных чата из JSON файла
    let chatData;
    try {
        const response = await fetch('2421184938.json');
        if (!response.ok) throw new Error('Не удалось загрузить файл чата.');
        chatData = await response.json();
    } catch (error) {
        console.error("Ошибка загрузки чата:", error);
        document.getElementById('chat-messages').innerHTML =
            '<p class="error">Ошибка загрузки чата</p>';
        return;
    }

    // Сбор стандартных Twitch-эмодзи
    const emoticons = {};
    (chatData.emotes || []).forEach(e => { emoticons[e.id] = e; });

    // Сбор стандартных бейджей
    const badges = {};
    (chatData.badges || []).forEach(b => {
        if (!badges[b._id]) badges[b._id] = {};
        badges[b._id][b.version] = b;
    });

    // Сортировка сообщений по времени
    const sortedComments = (chatData.comments || []).sort(
        (a, b) => a.content_offset_seconds - b.content_offset_seconds
    );

    // Форматирование времени в ЧЧ:ММ:СС
    function formatTime(sec) {
        const h = Math.floor(sec / 3600),
              m = Math.floor((sec % 3600) / 60),
              s = Math.floor(sec % 60);
        return `${h>0?h+':':''}${m<10?'0'+m:m}:${s<10?'0'+s:s}`;
    }

    // Сбор кастомных эмодзи и бейджей
    const customEmotes = {}, customBadges = {};
    if (chatData.embeddedData) {
        (chatData.embeddedData.thirdParty||[]).forEach(e => {
            if (e.name) customEmotes[e.name] = e;
        });
        (chatData.embeddedData.firstParty||[]).forEach(e => {
            if (e.id) customEmotes[e.id] = e;
        });
        (chatData.embeddedData.twitchBadges||[]).forEach(b => {
            customBadges[b.name] = b;
        });
    }

    // Утилита: создать <img> для эмодзи/бейджа
    function createImg({ src, alt, title, width, height, zero, cls }) {
        const img = document.createElement('img');
        img.className = cls || 'emote';
        img.src = src;
        img.alt = alt;
        img.title = title;
        if (width)  img.style.width  = width  + 'px';
        if (height) img.style.height = height + 'px';
        img.dataset.zero = zero ? '1' : '0';
        return img;
    }

    // Создать Twitch-эмодзи
    function createStandardEmote(frag) {
        const id = frag.emoticon.emoticon_id;
        const url = emoticons[id]?.url ||
                    `https://static-cdn.jtvnw.net/emoticons/v1/${id}/1.0`;
        // устанавливаем фиксированную высоту чтобы центрировалось
        return createImg({
            src: url, alt: frag.text, title: frag.text,
            width: 28, height: 28, zero: false, cls: 'emote'
        });
    }

    // Создать кастомный эмодзи
    function createCustomEmote(name) {
        const d = customEmotes[name];
        return createImg({
            src: 'data:image/png;base64,' + d.data,
            alt: name, title: name,
            width: d.width, height: d.height,
            zero: d.isZeroWidth,
            cls: 'emote'
        });
    }

    // Рендер стека наложенных эмодзи
    function renderEmoteStack(stack) {
        // вычисляем max размер из style.width/style.height или атрибутов width/height
        let maxW = 0, maxH = 0;
        stack.forEach(tok => {
            const el = tok.element;
            const w = el.style.width  ? parseInt(el.style.width)  : el.width;
            const h = el.style.height ? parseInt(el.style.height) : el.height;
            if (w > maxW) maxW = w;
            if (h > maxH) maxH = h;
        });

        const wrap = document.createElement('span');
        wrap.className = 'emote-stack';
        wrap.style.display       = 'inline-block';
        wrap.style.position      = 'relative';
        wrap.style.width         = maxW + 'px';
        wrap.style.height        = maxH + 'px';
        wrap.style.verticalAlign = 'middle';
        wrap.style.marginLeft    = '0.2em';

        stack.forEach((tok, i) => {
            const img = tok.element.cloneNode();
            img.style.position  = 'absolute';
            img.style.top       = '50%';
            img.style.left      = '50%';
            img.style.transform = 'translate(-50%,-50%)';
            img.style.zIndex    = 100 + i;
            wrap.appendChild(img);
        });

        return wrap;
    }

    // Обработка одного сообщения
    function processMessage(c) {
        const div = document.createElement('div');
        div.className = 'chat-message';
        div.dataset.time = c.content_offset_seconds;

        // timestamp
        const ts = document.createElement('span');
        ts.className = 'timestamp';
        ts.textContent = formatTime(c.content_offset_seconds);
        ts.dataset.time = c.content_offset_seconds;
        div.appendChild(ts);

        // бейджи
        (c.message.user_badges||[]).forEach(b => {
            let src = null;
            if (customBadges[b._id]?.versions[b.version]) {
                src = 'data:image/png;base64,' +
                      customBadges[b._id].versions[b.version].bytes;
            } else if (badges[b._id]?.[b.version]) {
                src = badges[b._id][b.version].image_url_1x;
            }
            if (!src) return;
            const img = createImg({
                src, alt: b._id, title: b._id,
                width: 18, height: 18,
                zero: false, cls: 'badge'
            });
            div.appendChild(img);
        });

        // username
        const un = document.createElement('span');
        un.className = 'username';
        un.textContent = c.commenter.display_name;
        if (c.message.user_color) un.style.color = c.message.user_color;
        div.appendChild(un);
        div.appendChild(document.createTextNode(': '));

        // content
        const content = document.createElement('span');
        content.className = 'message-content';

        // токенизация
        const tokens = [];
        (c.message.fragments||[]).forEach(frag => {
            if (frag.emoticon) {
                tokens.push({
                    type: 'emote',
                    element: createStandardEmote(frag),
                    isZero: false
                });
            } else {
                frag.text.split(/(\s+)/).forEach(part => {
                    if (/^\s+$/.test(part)) {
                        tokens.push({ type: 'space', text: part });
                    } else if (customEmotes[part]) {
                        const el = createCustomEmote(part);
                        tokens.push({
                            type: 'emote',
                            element: el,
                            isZero: el.dataset.zero === '1'
                        });
                    } else {
                        tokens.push({ type: 'text', text: part });
                    }
                });
            }
        });

        // группировка overlay-эмодзи
        let stack = [];
        const flush = () => {
            if (stack.length > 1) {
                content.appendChild(renderEmoteStack(stack));
            } else if (stack.length === 1) {
                content.appendChild(stack[0].element);
            }
            stack = [];
        };

        tokens.forEach(tok => {
            if (tok.type === 'emote') {
                if (tok.isZero && stack.length > 0) {
                    // наложение на предыдущий
                    stack.push(tok);
                    return;
                }
                // новый стек
                flush();
                stack = [tok];
                return;
            }
            if (tok.type === 'space') {
                // пробел не сбрасывает стек
                if (stack.length > 1) {
                    content.lastChild.appendChild(document.createTextNode(tok.text));
                } else {
                    content.appendChild(document.createTextNode(tok.text));
                }
                return;
            }
            // текст сбрасывает
            flush();
            content.appendChild(document.createTextNode(tok.text));
        });
        flush();

        div.appendChild(content);
        return div;
    }

    // ========== VideoPlayer + автоскролл ==========
    const chatEl = document.getElementById('chat-messages');
    const autoBtn = document.getElementById('auto-scroll-button');
    let msgIdx = 0, curTime = 0, autoScroll = true;
    let player, playerInited = false;

    function manageScroll() {
        if (autoScroll) {
            autoBtn.classList.remove('show');
            chatEl.scrollTop = chatEl.scrollHeight;
        } else {
            autoBtn.classList.add('show');
        }
    }

    function update(time, seek = false) {
        if (seek) {
            chatEl.innerHTML = '';
            msgIdx = sortedComments.findIndex(x => x.content_offset_seconds > time);
            if (msgIdx < 0) msgIdx = sortedComments.length;
            for (let i = 0; i < msgIdx; i++) {
                chatEl.appendChild(processMessage(sortedComments[i]));
            }
        } else {
            while (
                msgIdx < sortedComments.length &&
                sortedComments[msgIdx].content_offset_seconds <= time
            ) {
                chatEl.appendChild(processMessage(sortedComments[msgIdx]));
                msgIdx++;
            }
        }
        if (autoScroll) manageScroll();
    }

    function initVK() {
        if (typeof VK === 'undefined') return console.error('VK API отсутствует');
        player = VK.VideoPlayer(document.getElementById('vk-player'));
        player.on(VK.VideoPlayer.Events.INITED, () => {
            playerInited = true;
            try { player.play(); } catch {}
            update(player.getCurrentTime(), true);
            manageScroll();
        });
        player.on(VK.VideoPlayer.Events.TIMEUPDATE, st => {
            const t = st.time;
            if (Math.abs(t - curTime) > 5) {
                autoScroll = true;
                update(t, true);
            } else {
                update(t, false);
            }
            curTime = t;
        });
        player.on(VK.VideoPlayer.Events.ERROR, e => console.error(e));
    }

    function seek(sec) {
        if (!playerInited) return;
        player.seek(sec);
        curTime = sec;
        autoScroll = true;
        update(sec, true);
        manageScroll();
    }

    initVK();

    chatEl.addEventListener('scroll', () => {
        autoScroll =
            chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < 1;
        manageScroll();
    });

    chatEl.addEventListener('click', e => {
        if (e.target.classList.contains('timestamp')) {
            const t = parseFloat(e.target.dataset.time);
            if (!isNaN(t)) seek(t);
        }
    });

    autoBtn.addEventListener('click', () => {
        autoScroll = true;
        update(curTime, true);
        manageScroll();
    });
});
