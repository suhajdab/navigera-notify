(() => {
    const watch_list = JSON.parse(localStorage.getItem('watch_list') || '[]');
    const default_delay = 30; // s
    const delay_bump = 1.5;
    const page_title = document.title;
    const icon = '⏰';
    const btnEnabledColor = '#222';

    let previous_etag;
    let last_timestamp = false;
    let delay = default_delay;
    let enabled = false;
    let output_el;

    function init() {
        setupNotifications()
            .then(setupUI)
            .then(poll)
            .catch(console.error);
    }

    function setupUI() {
        const tmpl = document.createElement('template');
        tmpl.innerHTML = `<fieldset style="position:absolute; top: 10px; right: 10px; background: #eee; box-shadow: 0 0 0.4rem rgba(0,0,0,0.2); border: 1px solid #ccc; padding: 0.5rem">
            <legend style="border-color: #ccc; font-size: 1.5rem;">${icon}</legend>
            <label style="white-space: nowrap">
                <input type="checkbox"/>Notify
            </label>
            <output style="display: block; font-size: 0.7rem; border: 1px solid #ccc; padding: 0.2rem; margin-top: 0.5rem; background: #fafafa; color: #333;"/>
            </fieldset>`;
        tmpl.content.querySelector('input').addEventListener('click', handleCheckbox);
        output_el = tmpl.content.querySelector('output');
        
        document.body.append(tmpl.content);
        updateWatchlistOutput();

        return Promise.resolve();
    }

    function setupNotifications() {
        return new Promise((resolve, reject) => {
            if (!("Notification" in window)) {
                reject("Navigera Notification not available. This browser does not support desktop notification.")
            } else if (Notification.permission === "granted") {
                resolve();
            } else if (Notification.permission == "denied") {
                reject('Permission for Notification denied by user.');
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(function (permission) {
                    if (permission === "granted") {
                        resolve();
                    } else {
                        reject('Permission for Notification denied by user.');
                    }
                });
            }
        });
    }

    function detectChanges(resp) {
        if (resp.ok) {
            delay = default_delay;
            const newetag = resp.headers.get('etag');
            if (previous_etag !== newetag) {
                previous_etag = newetag;
                return resp.text();
            }
        } else {
            throw('Response not ok');
        }
    }

    function bumpDelay() {
        delay = delay * delay_bump;
    }

    function getTableFromHTML(html) {
        const tmpl = document.createElement('template');
        tmpl.innerHTML = html;
        return tmpl.content.querySelector('table');
    }

    function getRowDate(row) {
        let txt = row.querySelector('td:last-child').innerText;
        return new Date(Date.parse(txt));
    }

    function getRowDomain(row) {
        return row.querySelector('td:nth-child(2)').innerText;
    }

    function createButton(domain) {
        const tmpl = document.createElement('template');
        tmpl.innerHTML = `<button title="Watch ${domain}" style="margin: 0 1rem; float: right; width: 1.8rem; height: 1.8rem; border-radius: 50%; font-size:0.6rem">${icon}</button>`;

        const btn = tmpl.content.querySelector('button');
        btn.style.backgroundColor = watch_list.includes(domain) ? btnEnabledColor : '';
        btn.addEventListener('click', handleButtonClick.bind(null, domain));

        return btn;
    }

    function updateWatchlistOutput() {
        output_el.innerHTML = watch_list.join('</br>');
    }

    function filterRowsByTimestamp(row) {
        if (!last_timestamp) return false;
        return last_timestamp < getRowDate(row);
    }

    function filterDomainsByWatchlist(domain) {
        return watch_list.includes(domain);
    }

    function notify(domain) {
        if (!enabled) return;
        
        new Notification('Navigera Log', {
            body: `${domain} published`,
            requireInteraction: true
        });
    }

    function parseTable(table) {
        let rows = Array.from(table.querySelectorAll('tbody tr'));
        rows.filter(filterRowsByTimestamp)
            .map(getRowDomain)
            .filter(filterDomainsByWatchlist)
            .forEach(notify);
        
        rows.forEach(decorateRow);

        last_timestamp = getRowDate(rows[0]);
    }

    function decorateRow(row) {
        const domain = getRowDomain(row);
        const btn = createButton(domain);
        row.querySelector('td:nth-child(2)').prepend(btn);
    }

    function scheduleNextPoll() {
        setTimeout(poll, Math.ceil(delay * 1000));
    }

    function poll() {
        fetch('/api/log')
        .then(detectChanges)
        .then(handleChanges)
        .catch(bumpDelay)
        .finally(scheduleNextPoll);
    }

    function handleChanges(html) {
        if (html) {
            const fetched_table = getTableFromHTML(html);
            const document_table = document.querySelector('table');
            parseTable(fetched_table);
            document_table.parentNode.replaceChild(fetched_table, document_table);
            console.log('fetched table', fetched_table);
        }
        return Promise.resolve();
    }

    function handleButtonClick(domain, e) {
        const btn = e.target;
        if (watch_list.includes(domain)) {
            watch_list.splice(watch_list.indexOf(domain), 1);
            btn.style.backgroundColor = '';
        } else {
            watch_list.push(domain);
            btn.style.backgroundColor = btnEnabledColor;
        }
        updateWatchlistOutput();
        localStorage.setItem('watch_list', JSON.stringify(watch_list));

        console.log('watch list updated', watch_list)
    }

    function handleCheckbox(e) {
        enabled = e.target.checked
        document.title = page_title + (enabled ? icon : '');
    }

    init();
})();