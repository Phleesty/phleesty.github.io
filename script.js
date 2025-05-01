document.addEventListener('DOMContentLoaded', async function() {
    // —————————————————————————————————————————
    // 0. Обёртка #chat-messages в flex-контейнер
    // —————————————————————————————————————————
    const originalChatEl = document.getElementById('chat-messages');
    if (originalChatEl) {
        const chatWrapper = document.createElement('div');
        chatWrapper.id = 'chat-messages-wrapper';
        Object.assign(chatWrapper.style, {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
        });
        const parent = originalChatEl.parentNode;
        parent.replaceChild(chatWrapper, originalChatEl);
        chatWrapper.appendChild(originalChatEl);
    }

    // —————————————————————————————————————————
    // 1. Загрузка JSON
    // —————————————————————————————————————————
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

    // —————————————————————————————————————————
    // 2. Стандартные эмодзи и бейджи
    // —————————————————————————————————————————
    const emoticons = {};
    (chatData.emotes || []).forEach(e => emoticons[e.id] = e);

    const badges = {};
    (chatData.badges || []).forEach(b => {
        badges[b._id] = badges[b._id] || {};
        badges[b._id][b.version] = b;
    });

    // —————————————————————————————————————————
    // 3. Сортировка по времени
    // —————————————————————————————————————————
    const sortedComments = (chatData.comments || []).sort(
        (a, b) => a.content_offset_seconds - b.content_offset_seconds
    );

    // —————————————————————————————————————————
    // 4. Форматер времени (без ведущего нуля у минут, поддержка часов)
    // —————————————————————————————————————————
    function formatTime(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        const secStr = s < 10 ? '0' + s : String(s);

        if (h > 0) {
            const minStr = m < 10 ? '0' + m : String(m);
            return `${h}:${minStr}:${secStr}`;
        } else {
            // без ведущего нуля у минут
            return `${m}:${secStr}`;
        }
    }

    // —————————————————————————————————————————
    // 5. Кастомные эмодзи и бейджи
    // —————————————————————————————————————————
    const customEmotes = {}, customBadges = {};
    if (chatData.embeddedData) {
        (chatData.embeddedData.thirdParty || []).forEach(e => {
            if (e.name) customEmotes[e.name] = e;
        });
        (chatData.embeddedData.firstParty || []).forEach(e => {
            if (e.id) customEmotes[e.id] = e;
        });
        (chatData.embeddedData.twitchBadges || []).forEach(b => {
            customBadges[b.name] = b;
        });
    }

    // —————————————————————————————————————————
    // 6. Утилита для создания <img>
    // —————————————————————————————————————————
    function createImg({ src, alt, title, width, height, zero, cls }) {
        const img = document.createElement('img');
        img.className = cls || 'emote';
        img.src = src;
        img.alt = alt;
        img.title = title;
        if (width) img.style.width = width + 'px';
        if (height) img.style.height = height + 'px';
        img.dataset.zero = zero ? '1' : '0';
        img.style.verticalAlign = 'middle';
        return img;
    }

    // —————————————————————————————————————————
    // 7. Стандартный и кастомный эмодзи
    // —————————————————————————————————————————
    function createStandardEmote(frag) {
        const id = frag.emoticon.emoticon_id;
        const url = emoticons[id]?.url ||
                    `https://static-cdn.jtvnw.net/emoticons/v1/${id}/1.0`;
        return createImg({ cls: 'emote', src: url, alt: frag.text, title: frag.text, zero: false });
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

    // —————————————————————————————————————————
    // Новые утилиты для упоминаний и ссылок
    // —————————————————————————————————————————
    function createMention(text) {
        const el = document.createElement('strong');
        el.className = 'chat-mention';
        el.textContent = text;
        return el;
    }

    function createLink(url, text) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.className = 'chat-link';
        a.textContent = text;
        return a;
    }

    // —————————————————————————————————————————
    // 8. Рендер overlay-стека
    // —————————————————————————————————————————
    function renderEmoteStack(stack) {
        let maxW = 0, maxH = 0;
        stack.forEach(tok => {
            const el = tok.element;
            const w = el.style.width ? parseInt(el.style.width) : el.width;
            const h = el.style.height ? parseInt(el.style.height) : el.height;
            maxW = Math.max(maxW, w);
            maxH = Math.max(maxH, h);
        });
        const wrap = document.createElement('span');
        wrap.className = 'emote-stack';
        Object.assign(wrap.style, {
            display: 'inline-block',
            position: 'relative',
            width: maxW + 'px',
            height: maxH + 'px',
            verticalAlign: 'middle',
            marginLeft: '0.2em'
        });
        stack.forEach((tok, i) => {
            const img = tok.element.cloneNode();
            Object.assign(img.style, {
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%,-50%)',
                zIndex: 100 + i
            });
            wrap.appendChild(img);
        });
        return wrap;
    }

    // —————————————————————————————————————————
    // 9. Обработка одного сообщения
    // —————————————————————————————————————————
    function processMessage(c) {
        const div = document.createElement('div');
        div.className = 'chat-message';
        div.dataset.time = c.content_offset_seconds;

        // timestamp
        const timestampDiv = document.createElement('div');
        timestampDiv.className = 'timestamp';
        timestampDiv.textContent = formatTime(c.content_offset_seconds);
        timestampDiv.dataset.time = c.content_offset_seconds;
        div.appendChild(timestampDiv);

        // badges + username + content
        const msgContainer = document.createElement('div');
        msgContainer.className = 'message-container';
        div.appendChild(msgContainer);

        const badgesContainer = document.createElement('div');
        badgesContainer.className = 'badges-container';
        msgContainer.appendChild(badgesContainer);
        (c.message.user_badges || []).forEach(b => {
            let src = customBadges[b._id]?.versions[b.version]
                    ? 'data:image/png;base64,' + customBadges[b._id].versions[b.version].bytes
                    : badges[b._id]?.[b.version]?.image_url_1x;
            if (!src) return;
            badgesContainer.appendChild(createImg({
                cls: 'badge', src, alt: b._id, title: b._id, width: 18, height: 18, zero: false
            }));
        });

        const usernameDiv = document.createElement('span');
        usernameDiv.className = 'username';
        usernameDiv.textContent = c.commenter.display_name;
        if (c.message.user_color) usernameDiv.style.color = c.message.user_color;
        msgContainer.appendChild(usernameDiv);

        const separator = document.createElement('span');
        separator.className = 'username-separator';
        separator.textContent = ': ';
        msgContainer.appendChild(separator);

        // fragments → tokens → nodes
        const tokens = [];
        (c.message.fragments || []).forEach(frag => {
            if (frag.emoticon) {
                tokens.push({ type: 'emote', element: createStandardEmote(frag), isZero: false });
            } else {
                frag.text.split(/(\s+)/).forEach(part => {
                    if (/^\s+$/.test(part)) {
                        tokens.push({ type: 'space', text: part });
                    } else {
                        // проверка на ссылку
                        const urlMatch = part.match(/https?:\/\/[^\s]+/);
                        if (urlMatch) {
                        const rawUrl = urlMatch[0];
                        // отрезаем любую конечную пунктуацию (.,!?;:) у URL
                        const cleanUrl = rawUrl.replace(/[.,!?;:]+$/, '');
                        // то, что было после первого пробела или сразу за URL
                        const after = part.slice(rawUrl.length);
                        // то, что мы отрезали (точки/запятые и т.п.) плюс остальной текст
                        const suffix = rawUrl.slice(cleanUrl.length) + after;

                        tokens.push({ type: 'element', element: createLink(cleanUrl, cleanUrl) });
                        if (suffix) tokens.push({ type: 'text', text: suffix });
                        return;
                        }
                        // проверка на упоминание @username
                        if (/^@[A-Za-z0-9_]+$/.test(part)) {
                            tokens.push({ type: 'element', element: createMention(part) });
                            return;
                        }
                        // кастомный эмодзи
                        if (customEmotes[part]) {
                            const el = createCustomEmote(part);
                            tokens.push({ type: 'emote', element: el, isZero: el.dataset.zero === '1' });
                        } else {
                            tokens.push({ type: 'text', text: part });
                        }
                    }
                });
            }
        });

        const out = [];
        tokens.forEach(tok => {
            if (tok.type === 'emote' && tok.isZero) {
                let j = out.length - 1;
                while (j >= 0 && out[j].nodeType === 3 && /^\s*$/.test(out[j].textContent)) j--;
                if (j >= 0) {
                    const prev = out[j];
                    if (prev.nodeType === 1 && (prev.classList.contains('emote') || prev.classList.contains('emote-stack'))) {
                        out.splice(j, 1);
                        const base = prev.classList.contains('emote-stack')
                            ? Array.from(prev.children).map(el => ({ element: el }))
                            : [{ element: prev }];
                        out.splice(j, 0, renderEmoteStack([...base, { element: tok.element }]));
                        return;
                    }
                }
            }
            if (tok.type === 'element') out.push(tok.element);
            else if (tok.type === 'emote') out.push(tok.element);
            else out.push(document.createTextNode(tok.text));
        });

        const contentDiv = document.createElement('span');
        contentDiv.className = 'message-content';
        out.forEach(node => contentDiv.appendChild(node));
        msgContainer.appendChild(contentDiv);

        return div;
    }

    // —————————————————————————————————————————
    // 10. Инициализация и автоскролл
    // —————————————————————————————————————————
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

    function update(time, seek = false) {
        if (seek) {
            chatEl.innerHTML = '';
            idx = sortedComments.findIndex(x => x.content_offset_seconds > time);
            if (idx < 0) idx = sortedComments.length;
            for (let i = 0; i < idx; i++) {
                chatEl.appendChild(processMessage(sortedComments[i]));
            }
        } else {
            while (idx < sortedComments.length && sortedComments[idx].content_offset_seconds <= time) {
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
    }

    initVK();
    chatEl.addEventListener('scroll', () => {
        autoOn = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < 1;
        manageScroll();
    });
    chatEl.addEventListener('click', e => {
        if (e.target.classList.contains('timestamp')) {
            const t = parseFloat(e.target.dataset.time);
            if (!isNaN(t) && playerInited) {
                player.seek(t);
                curTime = t;
                autoOn = true;
                update(t, true);
                manageScroll();
            }
        }
    });
    autoBtn.addEventListener('click', () => {
        autoOn = true;
        update(curTime, true);
        manageScroll();
    });
});
