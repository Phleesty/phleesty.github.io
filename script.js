document.addEventListener('DOMContentLoaded', async function() {
    // 1. Загрузка JSON
    let chatData;
    try {
        const res = await fetch('2421184938.json');
        if (!res.ok) throw new Error('Не удалось загрузить файл чата.');
        chatData = await res.json();
    } catch (e) {
        console.error('Ошибка загрузки чата:', e);
        document.getElementById('chat-messages').innerHTML =
            '<p class="error">Ошибка загрузки чата</p>';
        return;
    }

    // 2. Стандартные эмодзи и бейджи
    const emoticons = {};
    (chatData.emotes||[]).forEach(e => emoticons[e.id] = e);

    const badges = {};
    (chatData.badges||[]).forEach(b => {
        if (!badges[b._id]) badges[b._id] = {};
        badges[b._id][b.version] = b;
    });

    // 3. Сортировка по времени
    const sortedComments = (chatData.comments||[]).sort(
        (a,b) => a.content_offset_seconds - b.content_offset_seconds
    );

    // 4. Форматер времени
    function formatTime(sec) {
        const h = Math.floor(sec/3600),
              m = Math.floor((sec%3600)/60),
              s = Math.floor(sec%60);
        return `${h>0? h+':' : ''}${m<10? '0'+m : m}:${s<10? '0'+s : s}`;
    }

    // 5. Кастомные эмодзи и бейджи
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

    // 6. Утилита для создания <img>
    function createImg({src, alt, title, width, height, zero, cls}) {
        const img = document.createElement('img');
        img.className = cls || 'emote';
        img.src       = src;
        img.alt       = alt;
        img.title     = title;
        if (width)    img.style.width  = width  + 'px';
        if (height)   img.style.height = height + 'px';
        img.dataset.zero = zero ? '1' : '0';
        img.style.verticalAlign = 'middle';
        return img;
    }

    // 7. Стандартный и кастомный эмодзи
    function createStandardEmote(frag) {
        const id  = frag.emoticon.emoticon_id;
        const url = emoticons[id]?.url ||
                    `https://static-cdn.jtvnw.net/emoticons/v1/${id}/1.0`;
        // НЕ задаём width/height — используем естественный размер
        return createImg({
            cls: 'emote',
            src: url,
            alt: frag.text,
            title: frag.text,
            zero: false
        });
    }
    function createCustomEmote(name) {
        const d = customEmotes[name];
        return createImg({
            cls: 'emote',
            src: 'data:image/png;base64,' + d.data,
            alt: name,
            title: name,
            width: d.width,
            height: d.height,
            zero: d.isZeroWidth
        });
    }

    // 8. Рендер overlay-стека
    function renderEmoteStack(stack) {
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

    // 9. Обработка одного сообщения
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
                cls: 'badge',
                src, alt: b._id, title: b._id,
                width: 18, height: 18,
                zero: false
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

        // собираем токены
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

        // формируем финальные узлы
        const out = [];
        tokens.forEach(tok => {
            if (tok.type === 'emote' && tok.isZero) {
                // ищем назад последний эмодзи или стек
                let j = out.length - 1;
                while (j >= 0 &&
                      out[j].nodeType === 3 &&
                      /^\s*$/.test(out[j].textContent)) {
                    j--;
                }
                if (j >= 0) {
                    const prev = out[j];
                    if (
                        prev.nodeType === 1 &&
                        (prev.classList.contains('emote') ||
                         prev.classList.contains('emote-stack'))
                    ) {
                        out.splice(j, 1);
                        let baseElems;
                        if (prev.classList.contains('emote-stack')) {
                            baseElems = Array.from(prev.children).map(el => ({ element: el }));
                        } else {
                            baseElems = [{ element: prev }];
                        }
                        const newStack = baseElems.concat({ element: tok.element });
                        out.splice(j, 0, renderEmoteStack(newStack));
                        return;
                    }
                }
            }
            if (tok.type === 'emote') {
                out.push(tok.element);
            } else {
                // text or space
                out.push(document.createTextNode(tok.text));
            }
        });

        // собираем в DOM
        const content = document.createElement('span');
        content.className = 'message-content';
        out.forEach(node => content.appendChild(node));
        div.appendChild(content);
        return div;
    }

    // 10. VideoPlayer + автоскролл
    const chatEl = document.getElementById('chat-messages');
    const autoBtn = document.getElementById('auto-scroll-button');
    let idx = 0, curTime = 0, autoOn = true, playerInited = false, player;

    function manageScroll() {
        if (autoOn) {
            autoBtn.classList.remove('show');
            chatEl.scrollTop = chatEl.scrollHeight;
        } else {
            autoBtn.classList.add('show');
        }
    }

    function update(time, seek=false) {
        if (seek) {
            chatEl.innerHTML = '';
            idx = sortedComments.findIndex(x => x.content_offset_seconds > time);
            if (idx < 0) idx = sortedComments.length;
            for (let i = 0; i < idx; i++) {
                chatEl.appendChild(processMessage(sortedComments[i]));
            }
        } else {
            while (
                idx < sortedComments.length &&
                sortedComments[idx].content_offset_seconds <= time
            ) {
                chatEl.appendChild(processMessage(sortedComments[idx]));
                idx++;
            }
        }
        if (autoOn) manageScroll();
    }

    function initVK() {
        if (typeof VK === 'undefined') {
            console.error('VK API отсутствует');
            return;
        }
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
                autoOn = true;
                update(t, true);
            } else {
                update(t, false);
            }
            curTime = t;
        });
        player.on(VK.VideoPlayer.Events.ERROR, e => console.error(e));
    }

    function seekTo(sec) {
        if (!playerInited) return;
        player.seek(sec);
        curTime = sec;
        autoOn = true;
        update(sec, true);
        manageScroll();
    }

    initVK();
    chatEl.addEventListener('scroll', () => {
        autoOn =
            chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < 1;
        manageScroll();
    });
    chatEl.addEventListener('click', e => {
        if (e.target.classList.contains('timestamp')) {
            const t = parseFloat(e.target.dataset.time);
            if (!isNaN(t)) seekTo(t);
        }
    });
    autoBtn.addEventListener('click', () => {
        autoOn = true;
        update(curTime, true);
        manageScroll();
    });
});
