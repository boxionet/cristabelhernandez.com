/* Face explorer: hotspots por zona con modelos Mujer/Hombre.
   Zones, coordinates and treatment copy come from the markup, which is
   generated from src/_data/faceExplorer.js. Vanilla JS, no dependencies. */
(function () {
    var fig = document.getElementById('face');
    if (!fig) return;

    var NS = 'http://www.w3.org/2000/svg';
    var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var pop = document.getElementById('pop');
    var wires = document.getElementById('wires');
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.hotspot'));
    var photoMujer = fig.querySelector('.photo-mujer');
    var photoHombre = fig.querySelector('.photo-hombre');

    var DATA = {};
    var COORDS = { mujer: {}, hombre: {} };
    buttons.forEach(function (b) {
        var zone = b.getAttribute('data-zone');
        DATA[zone] = { name: b.getAttribute('data-name'), desc: b.getAttribute('data-desc') };
        COORDS.mujer[zone] = [parseFloat(b.getAttribute('data-x-mujer')), parseFloat(b.getAttribute('data-y-mujer'))];
        COORDS.hombre[zone] = [parseFloat(b.getAttribute('data-x-hombre')), parseFloat(b.getAttribute('data-y-hombre'))];
    });
    var gender = 'mujer';

    /* The hotspot pulse starts only once the section is actually on
       screen. Five infinite animations running during initial load cost
       ~3s of mobile LCP (PSI bisect, Nov 14 2026). An IntersectionObserver
       gate FAILED here: during a throttled load its first callback can
       fire while the page is still in a transient pre-stylesheet layout,
       adding the class permanently (preview-5 scored 78 with the observer
       gate, 97 with no pulse rule at all). This scroll + settled-layout
       check cannot fire spuriously: PageSpeed never scrolls, and real
       users scroll to reach this below-fold section. The post-load check
       covers hash/deep links, which jump straight to the section. */
    var section = document.getElementById('face-explorer');
    function sectionInView() {
        if (!section) return false;
        var r = section.getBoundingClientRect();
        return r.top < window.innerHeight && r.bottom > 0;
    }
    function startPulse() {
        if (!section || section.classList.contains('in-view')) return;
        if (sectionInView()) {
            section.classList.add('in-view');
            window.removeEventListener('scroll', startPulse);
        }
    }
    if (section) {
        window.addEventListener('scroll', startPulse);
        if (document.readyState === 'complete') {
            setTimeout(startPulse, 500);
        } else {
            window.addEventListener('load', function () { setTimeout(startPulse, 500); });
        }
    }

    /* The hombre photo loads only after the page's own load event, then
       when the browser is idle (or on first switch), so it can never
       compete with the hero image or the first paint on slow networks:
       on a throttled connection the main thread idles while resources
       trickle in, and an un-gated idle callback would fire mid-load. */
    var hombreLoaded = false;
    function loadHombre() {
        if (hombreLoaded) return;
        hombreLoaded = true;
        Array.prototype.slice.call(photoHombre.querySelectorAll('source[data-srcset]')).forEach(function (s) {
            s.setAttribute('srcset', s.getAttribute('data-srcset'));
        });
        var img = photoHombre.querySelector('img');
        if (img && img.getAttribute('data-src')) img.src = img.getAttribute('data-src');
    }
    function scheduleHombreLoad() {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(function () { loadHombre(); }, { timeout: 2500 });
        } else {
            setTimeout(loadHombre, 800);
        }
    }
    if (document.readyState === 'complete') {
        scheduleHombreLoad();
    } else {
        window.addEventListener('load', scheduleHombreLoad);
    }

    function setGender(g) {
        if (!COORDS[g] || g === gender) return;
        gender = g;
        if (g === 'hombre') loadHombre();
        if (current) select(null);
        fig.classList.toggle('show-hombre', g === 'hombre');
        photoMujer.setAttribute('aria-hidden', g === 'hombre' ? 'true' : 'false');
        photoHombre.setAttribute('aria-hidden', g === 'hombre' ? 'false' : 'true');
        buttons.forEach(function (b) {
            var c = COORDS[g][b.getAttribute('data-zone')];
            b.style.left = c[0] + '%';
            b.style.top = c[1] + '%';
        });
        Array.prototype.slice.call(document.querySelectorAll('.gender-switch button')).forEach(function (b) {
            b.setAttribute('aria-pressed', b.getAttribute('data-gender') === g ? 'true' : 'false');
        });
        positionThumb(true);
    }
    Array.prototype.slice.call(document.querySelectorAll('.gender-switch button')).forEach(function (b) {
        b.addEventListener('click', function (e) {
            e.stopPropagation();
            setGender(b.getAttribute('data-gender'));
        });
    });

    var thumb = document.querySelector('.gender-switch .gender-thumb');
    function positionThumb(animate) {
        var active = document.querySelector('.gender-switch button[aria-pressed="true"]');
        if (!thumb || !active) return;
        if (!animate) thumb.style.transition = 'none';
        thumb.style.width = active.offsetWidth + 'px';
        thumb.style.transform = 'translateX(' + (active.offsetLeft - 4) + 'px)';
        if (!animate) { void thumb.offsetWidth; thumb.style.transition = ''; }
    }
    positionThumb(false);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { positionThumb(false); });

    var current = null;

    function cardHTML(d) {
        return '<h3>' + d.name + '</h3>'
            + '<p class="desc">' + d.desc + '</p>'
            + '<a class="btn" href="/reservar/">Reservar cita</a>';
    }

    function drawConnector(cx, cy, ex, ey, fw, fh, instant) {
        wires.innerHTML = '';
        wires.setAttribute('viewBox', '0 0 ' + fw + ' ' + fh);
        var dx = ex - cx, dy = ey - cy;
        var dist = Math.hypot(dx, dy);
        if (dist < 12) return;
        var ux = dx / dist, uy = dy / dist;
        var x1 = cx + 20 * ux, y1 = cy + 20 * uy;
        var len = Math.hypot(ex - x1, ey - y1);
        if (len < 8) return;
        var lineEl = document.createElementNS(NS, 'line');
        lineEl.setAttribute('x1', x1);
        lineEl.setAttribute('y1', y1);
        lineEl.setAttribute('x2', ex);
        lineEl.setAttribute('y2', ey);
        lineEl.setAttribute('stroke', '#fff');
        lineEl.setAttribute('stroke-width', '2');
        lineEl.setAttribute('stroke-linecap', 'round');
        var px = -uy, py = ux;
        var bx = ex - 10 * ux, by = ey - 10 * uy;
        var arrow = document.createElementNS(NS, 'polygon');
        arrow.setAttribute('points',
            ex + ',' + ey + ' ' +
            (bx + 5 * px) + ',' + (by + 5 * py) + ' ' +
            (bx - 5 * px) + ',' + (by - 5 * py));
        arrow.setAttribute('fill', '#fff');
        wires.appendChild(lineEl);
        wires.appendChild(arrow);
        lineEl.style.strokeDasharray = String(len);
        if (!instant && !REDUCED) {
            lineEl.style.setProperty('--len', String(len));
            lineEl.classList.add('draw');
            arrow.classList.add('tip');
        }
    }

    function placePop(key, instant) {
        var btn = document.querySelector('.hotspot[data-zone="' + key + '"]');
        var fr = fig.getBoundingClientRect();
        pop.style.display = 'block';
        pop.style.visibility = 'hidden';
        var sheet = fr.width < 480;
        pop.classList.toggle('sheet', sheet);
        var cx = parseFloat(btn.style.left) / 100 * fr.width;
        var cy = parseFloat(btn.style.top) / 100 * fr.height;
        if (sheet) {
            var cardW = Math.min(260, fr.width - 24);
            var fx = cx / fr.width, fy = cy / fr.height;
            var placeTop = fy >= 0.52;
            var cardLeft;
            if (fx < 0.45) { cardLeft = fr.width - 12 - cardW; }
            else if (fx > 0.55) { cardLeft = 12; }
            else { cardLeft = (fr.width - cardW) / 2; }
            pop.style.width = cardW + 'px';
            pop.style.left = cardLeft + 'px'; pop.style.right = 'auto';
            if (placeTop) { pop.style.top = '12px'; pop.style.bottom = 'auto'; }
            else { pop.style.top = 'auto'; pop.style.bottom = '12px'; }
            var ex = cx;
            if (fx < 0.45) { ex = cx + 80; }
            else if (fx > 0.55) { ex = cx - 80; }
            ex = Math.max(cardLeft + 24, Math.min(ex, cardLeft + cardW - 24));
            var edgeY = placeTop ? pop.offsetTop + pop.offsetHeight + 4 : pop.offsetTop - 4;
            drawConnector(cx, cy, ex, edgeY, fr.width, fr.height, instant);
        } else {
            pop.style.width = '230px'; pop.style.right = 'auto'; pop.style.bottom = 'auto';
            var pw = pop.offsetWidth, ph = pop.offsetHeight;
            var gap = 48;
            var side = cx < fr.width / 2 ? 'right' : 'left';
            var left = side === 'right' ? cx + gap : cx - gap - pw;
            left = Math.max(8, Math.min(left, fr.width - pw - 8));
            var top = cy - ph / 2;
            top = Math.max(8, Math.min(top, fr.height - ph - 8));
            pop.style.left = left + 'px'; pop.style.top = top + 'px';
            var ex2 = side === 'right' ? left - 4 : left + pw + 4;
            drawConnector(cx, cy, ex2, cy, fr.width, fr.height, instant);
        }
        pop.style.visibility = 'visible';
    }

    function select(key) {
        if (key === current) key = null;
        current = key;
        buttons.forEach(function (b) {
            b.setAttribute('aria-expanded', b.dataset.zone === key ? 'true' : 'false');
        });
        if (!key) {
            pop.classList.remove('open');
            pop.style.display = 'none';
            wires.innerHTML = '';
        } else {
            pop.innerHTML = cardHTML(DATA[key]);
            placePop(key, false);
            pop.classList.remove('open');
            void pop.offsetWidth;
            pop.classList.add('open');
        }
        try {
            if (key) { history.replaceState(null, '', '#' + key); }
            else { history.replaceState(null, '', location.pathname + location.search); }
        } catch (e) { /* file:// or restricted contexts: ignore */ }
    }

    buttons.forEach(function (b) {
        b.addEventListener('click', function (e) {
            e.stopPropagation();
            select(b.dataset.zone);
        });
    });
    pop.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () { if (current) select(null); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && current) select(null);
    });
    window.addEventListener('resize', function () {
        positionThumb(false);
        if (current) placePop(current, true);
    });

    var parts = (location.hash || '').replace('#', '').split(':');
    if (COORDS[parts[0]]) setGender(parts[0]);
    var initial = COORDS[parts[0]] ? parts[1] : parts[0];
    if (DATA[initial]) select(initial);
})();
