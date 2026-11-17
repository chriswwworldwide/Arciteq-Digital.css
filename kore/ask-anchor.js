(() => {
  const settle = () => {
    if (location.hash !== '#ask-chat') return;
    const target = document.getElementById('ask-chat');
    if (!target) return;
    const jump = () => {
      if (location.hash === '#ask-chat') target.scrollIntoView({block:'start', behavior:'instant'});
    };
    jump();
    setTimeout(jump, 350);
    setTimeout(jump, 1400);
  };
  window.addEventListener('hashchange', settle);
  window.addEventListener('load', settle);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (link && new URL(link.href).hash === '#ask-chat') setTimeout(settle, 0);
  });
})();
