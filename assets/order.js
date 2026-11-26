// Contact receipt: send the order form to /api/idea without leaving the page,
// and copy the email address for visitors whose browser has no mail app.
(function () {
  'use strict';

  var MSG = {
    sending: ['Sending your order…', '주문서를 보내는 중…'],
    sent: ['Order received! Thank you 🍪', '주문 접수 완료! 고마워요 🍪'],
    short: ['Please write a little more (5+ characters).', '조금만 더 적어 주세요 (5자 이상).'],
    email: ['That email doesn’t look right.', '이메일 형식을 확인해 주세요.'],
    slow: ['Too many orders at once. Try again in a few minutes.', '주문이 몰렸어요. 몇 분 뒤에 다시 보내 주세요.'],
    down: ['The order desk is closed right now. Please email us instead.', '지금은 접수처가 닫혀 있어요. 아래 이메일로 보내 주세요.'],
    copied: ['Copied!', '복사했어요!']
  };
  function lang() { return document.documentElement.getAttribute('data-lang') === 'ko' ? 1 : 0; }
  function say(el, key, isError) {
    el.textContent = MSG[key][lang()];
    el.classList.toggle('is-error', !!isError);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('order-form');
    var status = document.getElementById('order-status');
    var started = Date.now();

    // No-JS fallback lands back here with ?order=sent
    if (status && /[?&]order=sent\b/.test(location.search)) say(status, 'sent');
    if (status && /[?&]order=failed\b/.test(location.search)) say(status, 'down', true);

    if (form && status && window.fetch) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var data = {
          kind: (form.querySelector('input[name="kind"]:checked') || {}).value || 'idea',
          message: form.message.value.trim(),
          contact: form.contact.value.trim(),
          website: form.website.value,
          lang: lang() ? 'ko' : 'en',
          elapsed: Date.now() - started
        };
        if (data.message.length < 5) { say(status, 'short', true); form.message.focus(); return; }
        if (data.contact && !form.contact.checkValidity()) { say(status, 'email', true); form.contact.focus(); return; }
        var btn = form.querySelector('.order-btn');
        btn.disabled = true;
        say(status, 'sending');
        fetch('/api/idea', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).then(function (res) {
          if (res.ok) {
            say(status, 'sent');
            form.message.value = '';
            started = Date.now();
          } else {
            say(status, res.status === 429 ? 'slow' : res.status === 400 ? 'short' : 'down', true);
          }
        }).catch(function () {
          say(status, 'down', true);
        }).then(function () { btn.disabled = false; });
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll('.copy-mail'), function (b) {
      b.addEventListener('click', function () {
        var text = b.getAttribute('data-copy');
        var done = function () {
          var keep = b.innerHTML;
          b.textContent = MSG.copied[lang()];
          setTimeout(function () { b.innerHTML = keep; }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { window.prompt('', text); });
        } else {
          window.prompt('', text);
        }
      });
    });
  });
})();
