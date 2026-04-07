// Force unregister old service workers and reload
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    let hadSW = false;
    regs.forEach(reg => {
      hadSW = true;
      reg.unregister();
    });
    // If we unregistered anything, reload once more
    if (hadSW && !sessionStorage.getItem('sw_cleared_v2')) {
      sessionStorage.setItem('sw_cleared_v2', 'true');
      location.reload();
    }
  });
}
